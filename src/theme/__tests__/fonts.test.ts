/**
 * React Native takes one family per Text, so this rule decides whether Persian
 * renders in a typeface designed for it or in whatever the system substitutes.
 * Getting the detection wrong is not subtle: Persian set in Inter falls back to
 * a system face mid-sentence.
 */
import { describe, expect, it } from "vitest";
import {
  ALL_FONT_FAMILIES,
  fontFamilyFor,
  hasArabicScript,
  MONO_FAMILY,
  textOf,
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

describe("fontFamilyFor", () => {
  it("sets Latin in Inter", () => {
    expect(fontFamilyFor("Hello")).toBe("Inter_400Regular");
    expect(fontFamilyFor("Hello", "semibold")).toBe("Inter_600SemiBold");
  });

  it("sets Persian in Vazirmatn", () => {
    expect(fontFamilyFor("سلام")).toBe("Vazirmatn_400Regular");
    expect(fontFamilyFor("سلام", "bold")).toBe("Vazirmatn_700Bold");
  });

  it("keeps a mixed string in one family rather than switching mid-line", () => {
    expect(fontFamilyFor("the فایل")).toBe("Vazirmatn_400Regular");
  });

  it("honours every weight in both scripts", () => {
    for (const weight of ["regular", "medium", "semibold", "bold"] as const) {
      expect(fontFamilyFor("a", weight)).toContain("Inter_");
      expect(fontFamilyFor("ا", weight)).toContain("Vazirmatn_");
    }
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

describe("ALL_FONT_FAMILIES", () => {
  it("lists every family the picker can return, so the loader cannot drift", () => {
    const picked = new Set<string>();
    for (const weight of ["regular", "medium", "semibold", "bold"] as const) {
      picked.add(fontFamilyFor("a", weight));
      picked.add(fontFamilyFor("ا", weight));
    }
    picked.add(MONO_FAMILY);
    for (const family of picked) {
      expect(ALL_FONT_FAMILIES).toContain(family);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(ALL_FONT_FAMILIES).size).toBe(ALL_FONT_FAMILIES.length);
  });
});
