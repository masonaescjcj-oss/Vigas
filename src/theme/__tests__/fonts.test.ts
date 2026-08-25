/**
 * The app sets no typeface: text inherits whichever face the device uses, which
 * is also how Persian gets a Persian face without any detection.
 *
 * What is still worth testing is that the module keeps saying so. A family
 * accidentally reintroduced here would apply to Latin and leave Arabic script
 * falling back mid-sentence, which is the failure this file used to guard
 * against from the other direction.
 *
 * hasArabicScript stays because direction and alignment still depend on it.
 */
import { describe, expect, it } from "vitest";
import {
  ALL_FONT_FAMILIES,
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

describe("no family is set", () => {
  it("returns undefined for every weight and script", () => {
    // undefined means "inherit" to both React Native and react-native-web, so
    // the device picks — including its Arabic-script face.
    for (const weight of ["regular", "medium", "semibold", "bold"] as const) {
      expect(fontFamilyFor("a", weight)).toBeUndefined();
      expect(fontFamilyFor("ا", weight)).toBeUndefined();
    }
    expect(fontFamilyFor()).toBeUndefined();
  });

  it("headings inherit too — size and weight separate them", () => {
    expect(displayFamilyFor("Build something", "bold")).toBeUndefined();
    expect(displayFamilyFor("بساز", "medium")).toBeUndefined();
  });

  it("loads nothing", () => {
    // The loader reads this list. Anything in it would be downloaded, which is
    // the 2.4 MB this change removed.
    expect(ALL_FONT_FAMILIES).toEqual([]);
  });
});

