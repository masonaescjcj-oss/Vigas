/**
 * React Native takes one family per Text, so this rule decides whether Persian
 * renders in a typeface designed for it or in whatever the system substitutes.
 * Getting the detection wrong is not subtle: Persian set in Inter falls back to
 * a system face mid-sentence.
 */
import { describe, expect, it } from "vitest";
import {
  ALL_FONT_FAMILIES,
  MONO_FAMILY,
  displayFamilyFor,
  fontFamilyFor,
  hasArabicScript,
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

describe("the display face", () => {
  it("sets a Latin heading in Inter at a heading weight", () => {
    expect(displayFamilyFor("Build something", "bold")).toBe("Inter_800ExtraBold");
    expect(displayFamilyFor("Build something", "medium")).toBe("Inter_700Bold");
  });

  it("falls back to Vazirmatn for a Persian heading", () => {
    // Inter has no Arabic coverage. Setting a Persian heading in
    // it renders boxes, or drops to a system font in the middle of the
    // interface — worse than simply not using the display face there.
    expect(displayFamilyFor("یک اپ بساز", "bold")).toBe("Vazirmatn_700Bold");
    expect(displayFamilyFor("یک اپ بساز", "medium")).toBe("Vazirmatn_600SemiBold");
  });

  it("treats a mixed heading as Persian", () => {
    // Consistent with fontFamilyFor: one family across a line reads better
    // than a typeface that changes mid-sentence.
    expect(displayFamilyFor("فایل index.html را بساز")).toBe("Vazirmatn_700Bold");
  });

  it("uses the display face for non-string children", () => {
    // A heading whose children are nodes rather than text — an icon plus a
    // label — should still be a heading, not fall to the body face.
    expect(displayFamilyFor(42)).toBe("Inter_800ExtraBold");
    expect(displayFamilyFor(null)).toBe("Inter_800ExtraBold");
  });

  it("is listed among the families the app loads", () => {
    // ALL_FONT_FAMILIES exists so the loader and this module cannot drift: a
    // family used here but never registered renders as the system font.
    expect(ALL_FONT_FAMILIES).toContain("Inter_800ExtraBold");
    expect(ALL_FONT_FAMILIES).toContain("Inter_700Bold");
  });
});
