/**
 * A hand-written zip is only correct if something that did not write it can read
 * it, so the important test here shells out to Python's zipfile: my own reader
 * could happily share a bug with my own writer.
 */
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createZip, crc32, dosDateTime, zipEntryName } from "../shared/zipStore.ts";

const encoder = new TextEncoder();
const bytes = (text: string) => encoder.encode(text);

Deno.test("crc32 matches the known value for the standard check string", () => {
  // "123456789" -> 0xCBF43926 is the documented CRC-32 check value.
  assertEquals(crc32(bytes("123456789")), 0xcbf43926);
});

Deno.test("crc32 of nothing is zero", () => {
  assertEquals(crc32(new Uint8Array(0)), 0);
});

Deno.test("a path is normalised to forward slashes with no leading slash", () => {
  assertEquals(zipEntryName("src\\components\\App.tsx"), "src/components/App.tsx");
  assertEquals(zipEntryName("/index.html"), "index.html");
  assertEquals(zipEntryName("./src//main.ts"), "src/main.ts");
});

Deno.test("a path cannot escape the extraction directory", () => {
  // Zip-slip: an entry named ../../etc/passwd overwrites files outside the
  // folder the user extracted into.
  assertEquals(zipEntryName("../../etc/passwd"), "etc/passwd");
  assertEquals(zipEntryName("src/../../../secret"), "src/secret");
  assertEquals(zipEntryName("../"), "");
  assertEquals(zipEntryName("/"), "");
});

Deno.test("a date below the zip epoch does not wrap into a wrong date", () => {
  // (1970-1980) << 9 is negative and would pack as a plausible future date.
  const stamp = dosDateTime(new Date(Date.UTC(1970, 0, 1)));
  assertEquals(stamp.date >>> 9, 0, "year must clamp to 1980");
});

Deno.test("a date packs into MS-DOS fields", () => {
  const stamp = dosDateTime(new Date(Date.UTC(2026, 7, 17, 13, 45, 30)));
  assertEquals(stamp.date >>> 9, 46, "2026 - 1980");
  assertEquals((stamp.date >>> 5) & 0xf, 8, "August");
  assertEquals(stamp.date & 0x1f, 17);
  assertEquals(stamp.time >>> 11, 13);
  assertEquals((stamp.time >>> 5) & 0x3f, 45);
});

Deno.test("an archive starts with the local header signature and ends with the EOCD", async () => {
  const zip = await createZip([{ path: "a.txt", data: bytes("hello") }]);
  assertEquals([...zip.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assertEquals([...zip.slice(-22, -18)], [0x50, 0x4b, 0x05, 0x06]);
});

Deno.test("the entry count in the EOCD matches what was written", async () => {
  const zip = await createZip([
    { path: "a.txt", data: bytes("a") },
    { path: "b/c.txt", data: bytes("c") },
    { path: "../escape", data: bytes("x") },
  ]);
  const view = new DataView(zip.buffer, zip.byteOffset);
  assertEquals(view.getUint16(zip.length - 14, true), 3, "including the normalised path");
});

Deno.test("an entry whose path normalises to nothing is dropped, not written unnamed", async () => {
  const zip = await createZip([
    { path: "keep.txt", data: bytes("k") },
    { path: "../", data: bytes("junk") },
  ]);
  const view = new DataView(zip.buffer, zip.byteOffset);
  assertEquals(view.getUint16(zip.length - 14, true), 1);
});

Deno.test("an empty archive is still a valid zip", async () => {
  const zip = await createZip([]);
  assertEquals(zip.length, 22, "just an EOCD");
  assertEquals([...zip.slice(0, 4)], [0x50, 0x4b, 0x05, 0x06]);
});

Deno.test("compressible content is deflated, and incompressible content is stored", async () => {
  const repetitive = bytes("x".repeat(5000));
  const zip = await createZip([{ path: "r.txt", data: repetitive }]);
  // Method lives at offset 8 of the local header.
  const method = new DataView(zip.buffer, zip.byteOffset).getUint16(8, true);
  assertEquals(method, 8, "deflate");
  assertEquals(zip.length < repetitive.length, true, "and it actually got smaller");

  // A short random-ish string deflates larger than it started, so it is stored.
  const tiny = bytes("ab");
  const tinyZip = await createZip([{ path: "t.txt", data: tiny }]);
  assertEquals(new DataView(tinyZip.buffer, tinyZip.byteOffset).getUint16(8, true), 0, "store");
});

Deno.test("the same input twice produces byte-identical output", async () => {
  // No wall-clock in the default path, so an export is reproducible.
  const make = () => createZip([{ path: "a.txt", data: bytes("hello") }]);
  assertEquals([...(await make())], [...(await make())]);
});

Deno.test("a supplied timestamp does change the bytes", async () => {
  const a = await createZip([{ path: "a.txt", data: bytes("hello") }]);
  const b = await createZip([
    { path: "a.txt", data: bytes("hello"), modifiedAt: new Date(Date.UTC(2026, 0, 2, 3, 4, 6)) },
  ]);
  assertNotEquals([...a].join(","), [...b].join(","));
});

/**
 * The one that matters: a reader nobody here wrote.
 */
Deno.test("a real unzip reads the archive, its names and its contents", async () => {
  const files: Record<string, string> = {
    "index.html": "<h1>Hello</h1>\n",
    "src/App.tsx": "export const App = () => null;\n".repeat(40),
    "assets/notes fa.txt": "سلام دنیا\n",
    // A non-ASCII *name*, which is what the UTF-8 flag in the header is for.
    // Supabase Storage refuses such an object key, so no project can produce
    // one — but the writer must still be correct, and only this test can say so.
    "assets/فارسی.txt": "نام فایل هم فارسی است\n",
    "deep/a/b/c/d.json": JSON.stringify({ ok: true, nested: [1, 2, 3] }),
  };

  const zip = await createZip(
    Object.entries(files).map(([path, text]) => ({ path, data: bytes(text) })),
  );

  const dir = await Deno.makeTempDir();
  const zipPath = `${dir}/export.zip`;
  await Deno.writeFile(zipPath, zip);

  // Result goes to a file, not stdout: a Windows console defaults to a legacy
  // codepage and cannot print the Persian entry, which made this test "pass"
  // while actually proving nothing.
  const resultPath = `${dir}/result.json`;
  const script = `
import json, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    bad = z.testzip()
    out = {"error": "crc failed for " + bad} if bad is not None else {
        "files": {n: z.read(n).decode("utf-8") for n in z.namelist()}
    }
with open(sys.argv[2], "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False)
`;
  const scriptPath = `${dir}/read.py`;
  await Deno.writeTextFile(scriptPath, script);

  try {
    const result = await new Deno.Command("python", { args: [scriptPath, zipPath, resultPath] }).output();
    // Only a missing interpreter is a skip. Python running and then failing means
    // the archive is bad, and that must not be reported as "not checked".
    if (!result.success) {
      throw new Error(`python failed reading the archive:\n${new TextDecoder().decode(result.stderr)}`);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log("SKIP: python is not on PATH, so the independent read was not performed");
      await Deno.remove(dir, { recursive: true });
      return;
    }
    throw error;
  }

  const parsed = JSON.parse(await Deno.readTextFile(resultPath));
  assertEquals(parsed.error, undefined, `python rejected the archive: ${parsed.error}`);
  // Every name and every byte survives the round trip, non-ASCII included.
  assertEquals(parsed.files, files);

  await Deno.remove(dir, { recursive: true });
});
