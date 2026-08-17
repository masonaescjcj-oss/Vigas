/**
 * supabase/functions/shared/zipStore.ts
 * ---------------------------------------------------------------------------
 * Writing a zip file, by hand.
 *
 * People will not build anything serious in a tool they cannot get their work
 * out of, so "download my project" is a trust feature more than a convenience
 * one. That makes it worth doing without a dependency: this is one well-specified
 * binary format, and a hand-written writer can be tested against a real unzip.
 *
 * DEFLATE comes from the runtime's CompressionStream. Where that is unavailable
 * the entry is stored uncompressed instead of failing — a larger zip still opens,
 * and an export that errors does not.
 *
 * Deliberately not implemented: zip64. Above 4 GB the format needs a different
 * header layout, and an export that large is not a phone-sized problem. The
 * caller enforces a much smaller cap.
 * ---------------------------------------------------------------------------
 */

/** Zip's own epoch. Used as the default so output is byte-for-byte reproducible. */
const DOS_EPOCH = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

/** Bit 11 tells the reader the name is UTF-8, which matters for non-ASCII paths. */
const FLAG_UTF8 = 0x0800;

const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS packed time/date. Two seconds of resolution is all the format has. */
export function dosDateTime(date: Date): { time: number; date: number } {
  // Below 1980 is unrepresentable, and a negative year silently wraps into a
  // plausible-looking wrong date.
  const year = Math.max(1980, date.getUTCFullYear());
  return {
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
}

/**
 * Normalise a path for a zip entry.
 *
 * Forward slashes only, no leading slash, no `..` segment: an archive that can
 * write outside the directory it is extracted into is the classic zip-slip, and
 * refusing it here means no consumer has to remember to.
 */
export function zipEntryName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/")
    .filter((part) => part && part !== "." && part !== "..");
  return parts.join("/");
}

export interface ZipEntry {
  path: string;
  data: Uint8Array;
  modifiedAt?: Date;
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  const Compression = (globalThis as { CompressionStream?: typeof CompressionStream }).CompressionStream;
  if (!Compression) return null;
  try {
    // "deflate-raw" is what zip stores: DEFLATE with no zlib wrapper.
    const stream = new Compression("deflate-raw");
    const writer = stream.writable.getWriter();
    // Copied into a plain ArrayBuffer: a Uint8Array may be backed by a
    // SharedArrayBuffer, which is not a BufferSource. The copy is bounded by the
    // caller's per-file size cap.
    const source = new Uint8Array(new ArrayBuffer(bytes.length));
    source.set(bytes);
    void writer.write(source);
    void writer.close();
    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  } catch {
    return null;
  }
}

class ByteWriter {
  private chunks: Uint8Array[] = [];
  length = 0;

  push(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  u16(value: number): void {
    const view = new Uint8Array(2);
    new DataView(view.buffer).setUint16(0, value, true);
    this.push(view);
  }

  u32(value: number): void {
    const view = new Uint8Array(4);
    new DataView(view.buffer).setUint32(0, value >>> 0, true);
    this.push(view);
  }

  concat(): Uint8Array {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

/**
 * Build a zip archive.
 *
 * Entries keep the order given, and an entry whose path normalises to nothing is
 * dropped rather than written under a meaningless name.
 */
export async function createZip(entries: ZipEntry[]): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const body = new ByteWriter();
  const central = new ByteWriter();
  let count = 0;

  for (const entry of entries) {
    const name = zipEntryName(entry.path);
    if (!name) continue;

    const nameBytes = encoder.encode(name);
    const stamp = dosDateTime(entry.modifiedAt ?? DOS_EPOCH);
    const checksum = crc32(entry.data);

    const compressed = await deflate(entry.data);
    // Only worth it if it actually got smaller — deflate can inflate already
    // compressed bytes, and a PNG stored is smaller than a PNG deflated.
    const useDeflate = compressed !== null && compressed.length < entry.data.length;
    const payload = useDeflate ? compressed! : entry.data;
    const method = useDeflate ? METHOD_DEFLATE : METHOD_STORE;

    const offset = body.length;

    body.u32(SIG_LOCAL);
    body.u16(20);            // version needed
    body.u16(FLAG_UTF8);
    body.u16(method);
    body.u16(stamp.time);
    body.u16(stamp.date);
    body.u32(checksum);
    body.u32(payload.length);
    body.u32(entry.data.length);
    body.u16(nameBytes.length);
    body.u16(0);             // extra length
    body.push(nameBytes);
    body.push(payload);

    central.u32(SIG_CENTRAL);
    central.u16(20);         // version made by
    central.u16(20);         // version needed
    central.u16(FLAG_UTF8);
    central.u16(method);
    central.u16(stamp.time);
    central.u16(stamp.date);
    central.u32(checksum);
    central.u32(payload.length);
    central.u32(entry.data.length);
    central.u16(nameBytes.length);
    central.u16(0);          // extra
    central.u16(0);          // comment
    central.u16(0);          // disk number
    central.u16(0);          // internal attrs
    // 0o644 in the high 16 bits, so extracting on Unix does not produce a file
    // with no permissions at all.
    central.u32((0o100644 << 16) >>> 0);
    central.u32(offset);
    central.push(nameBytes);

    count += 1;
  }

  const out = new ByteWriter();
  const bodyBytes = body.concat();
  const centralBytes = central.concat();
  out.push(bodyBytes);
  out.push(centralBytes);

  out.u32(SIG_EOCD);
  out.u16(0);                       // this disk
  out.u16(0);                       // disk with the central directory
  out.u16(count);
  out.u16(count);
  out.u32(centralBytes.length);
  out.u32(bodyBytes.length);
  out.u16(0);                       // comment length

  return out.concat();
}
