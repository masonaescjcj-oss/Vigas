/**
 * Most of the text this app shows is Persian, because that is what its users
 * write. The interesting cases are the mixed ones — a file path inside a Persian
 * sentence must not flip the sentence, and Persian inside a line of code must not
 * flip the code.
 */
import { describe, expect, it } from "vitest";
import { alignmentOf, directionOf, directionStyleFor } from "../direction";

describe("directionOf", () => {
  it("reads Persian as right-to-left", () => {
    expect(directionOf("سلام دنیا")).toBe("rtl");
    expect(directionOf("یک صفحه لندینگ ساده میخوام")).toBe("rtl");
  });

  it("reads English as left-to-right", () => {
    expect(directionOf("Create a landing page")).toBe("ltr");
  });

  it("keeps a Persian sentence right-to-left despite an embedded file name", () => {
    // The exact shape of a real answer: "save it as index.html and open it".
    expect(directionOf("آن را با نام index.html ذخیره و در مرورگر باز کنید")).toBe("rtl");
  });

  it("keeps a line of code left-to-right despite a Persian string literal", () => {
    expect(directionOf('console.log("سلام دنیا")')).toBe("ltr");
    expect(directionOf('const title = "صفحه اصلی";')).toBe("ltr");
  });

  it("counts a mostly-Persian markup fragment as Persian, which is the accepted limit", () => {
    // `<h1>سلام</h1>` is four Persian letters against two Latin ones, so the
    // dominant-script rule calls it rtl. That is arguably wrong for markup — but
    // this helper is only ever applied to prose. Code blocks are rendered in the
    // monospace path with no alignment of their own, so a fragment like this
    // never reaches here in practice. Recorded rather than papered over.
    expect(directionOf("<h1>سلام</h1>")).toBe("rtl");
  });

  it("treats a path or identifier as left-to-right", () => {
    expect(directionOf("src/components/App.tsx")).toBe("ltr");
    expect(directionOf("npm install expo-clipboard")).toBe("ltr");
  });

  it("does not flip on a single Persian word among many English ones", () => {
    expect(directionOf("The project is called پروژه and lives here")).toBe("ltr");
  });

  it("handles text with no letters at all", () => {
    expect(directionOf("1234 — ...")).toBe("ltr");
    expect(directionOf("")).toBe("ltr");
  });

  it("does not throw on values that are not strings", () => {
    // Children props arrive as numbers, arrays and nodes.
    expect(directionOf(undefined)).toBe("ltr");
    expect(directionOf(null)).toBe("ltr");
    expect(directionOf(42)).toBe("ltr");
    expect(directionOf(["سلام", " دنیا"])).toBe("rtl");
  });
});

describe("alignmentOf", () => {
  it("puts Persian on the right and English on the left", () => {
    expect(alignmentOf("سلام دنیا")).toBe("right");
    expect(alignmentOf("hello world")).toBe("left");
  });
});

describe("directionStyleFor", () => {
  it("returns alignment and direction together, so neither can be forgotten", () => {
    expect(directionStyleFor("سلام دنیا")).toEqual({ textAlign: "right", writingDirection: "rtl" });
    expect(directionStyleFor("hello")).toEqual({ textAlign: "left", writingDirection: "ltr" });
  });
});
