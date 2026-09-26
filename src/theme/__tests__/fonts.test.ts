/**
 * Plex and Bricolage for Latin, the device's own face for Persian, and nothing
 * at all until the files have loaded.
 *
 * The two failures worth pinning: a family named before it is registered (a
 * red screen on iOS, Times on the web), and a Latin family applied to Arabic
 * script, which falls back glyph by glyph mid-sentence.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ALL_FONT_FAMILIES,
  FAMILIES,
  fontFamilyFor,
  hasArabicScript,
  setFontsReady,
  textOf,
  weightFrom,
} from "../fonts";

describe("hasArabicScript", () => {
  it("detects Persian", () => {
    expect(hasArabicScript("سلام دنیا")).toBe(true);
    expect(hasArabicScript("پروژه")).toBe(true);
    expect(hasArabicScript("گچپژ")).toBe(true);
  });

  it("detects Arabic", () => {
    expect(hasArabicScript("مرحبا")).toBe(true);
  });

  it("does not fire on Latin, digits or punctuation", () => {
    expect(hasArabicScript("Create a page")).toBe(false);
    expect(hasArabicScript("src/app.js")).toBe(false);
    expect(hasArabicScript("1234 — ok!")).toBe(false);
    expect(hasArabicScript("")).toBe(false);
  });

  it("ignores non-strings rather than throwing", () => {
    expect(hasArabicScript(undefined)).toBe(false);
    expect(hasArabicScript(42)).toBe(false);
    expect(hasArabicScript(null)).toBe(false);
  });

  it("fires on a single Persian word inside an English sentence", () => {
    expect(hasArabicScript("open the فایل please")).toBe(true);
  });
});

describe("textOf", () => {
  it("reads a plain string or number", () => {
    expect(textOf("hi")).toBe("hi");
    expect(textOf(7)).toBe("7");
  });

  it("joins an array of children", () => {
    expect(textOf(["Count: ", 3])).toBe("Count: 3");
  });

  it("reaches into nested elements", () => {
    const node = { props: { children: ["outer ", { props: { children: "سلام" } }] } };
    expect(textOf(node)).toBe("outer سلام");
    expect(hasArabicScript(textOf(node))).toBe(true);
  });

  it("returns nothing for an empty or unreadable child", () => {
    expect(textOf(null)).toBe("");
    expect(textOf(undefined)).toBe("");
    expect(textOf({})).toBe("");
  });
});

describe("fontFamilyFor", () => {
  afterEach(() => setFontsReady(false));

  it("names nothing before the files have loaded", () => {
    for (const weight of ["regular", "medium", "semibold", "bold"] as const) {
      expect(fontFamilyFor("a", weight)).toBeUndefined();
      expect(fontFamilyFor("a", weight, "display")).toBeUndefined();
      expect(fontFamilyFor("a", weight, "mono")).toBeUndefined();
    }
  });

  it("picks the file by weight, since a custom face ignores fontWeight", () => {
    setFontsReady(true);
    expect(fontFamilyFor("a")).toBe("IBMPlexSans_400Regular");
    expect(fontFamilyFor("a", "medium")).toBe("IBMPlexSans_500Medium");
    expect(fontFamilyFor("a", "semibold")).toBe("IBMPlexSans_600SemiBold");
    expect(fontFamilyFor("a", "bold")).toBe("IBMPlexSans_600SemiBold");
  });

  it("sets titles in Bricolage and code in Plex Mono", () => {
    setFontsReady(true);
    expect(fontFamilyFor("Sign in", "regular", "display")).toBe("BricolageGrotesque_600SemiBold");
    expect(fontFamilyFor("src/app.js", "regular", "mono")).toBe("IBMPlexMono_400Regular");
    expect(fontFamilyFor("src/app.js", "medium", "mono")).toBe("IBMPlexMono_500Medium");
  });

  it("leaves Persian to the device, except in code", () => {
    setFontsReady(true);
    expect(fontFamilyFor("سلام دنیا")).toBeUndefined();
    expect(fontFamilyFor("پروژه", "semibold", "display")).toBeUndefined();
    // A path is still a path in a Persian sentence.
    expect(fontFamilyFor("فایل.ts", "regular", "mono")).toBe("IBMPlexMono_400Regular");
  });

  it("loads every family it can hand out", () => {
    // A name handed out but never registered is a crash on iOS.
    expect(ALL_FONT_FAMILIES.sort()).toEqual(Object.values(FAMILIES).sort());
    const loader = readFileSync(join(__dirname, "..", "useAppFonts.ts"), "utf8");
    const missing = Object.keys(FAMILIES).filter((k) => !loader.includes(`[FAMILIES.${k}]`));
    expect(missing, "register in useAppFonts FILES").toEqual([]);
  });
});

describe("weightFrom", () => {
  it("reads the weight classes the screens already use", () => {
    expect(weightFrom("text-sm font-uiSemiBold", undefined, "regular")).toBe("semibold");
    expect(weightFrom("text-xs font-semibold", undefined, "regular")).toBe("semibold");
    expect(weightFrom("font-medium", undefined, "regular")).toBe("medium");
    expect(weightFrom("font-bold mr-2", undefined, "regular")).toBe("bold");
  });

  it("reads an inline fontWeight", () => {
    expect(weightFrom("", "600", "regular")).toBe("semibold");
    expect(weightFrom("", 500, "regular")).toBe("medium");
    expect(weightFrom("", "bold", "regular")).toBe("bold");
  });

  it("falls back to the variant's own weight", () => {
    expect(weightFrom("text-xs opacity-70", undefined, "medium")).toBe("medium");
    expect(weightFrom(undefined, undefined, "regular")).toBe("regular");
  });

  it("does not mistake a size class for a weight", () => {
    expect(weightFrom("text-base leading-6", undefined, "regular")).toBe("regular");
  });
});
