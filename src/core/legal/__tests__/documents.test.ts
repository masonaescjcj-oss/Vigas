import { describe, expect, it } from "vitest";
import {
  PRIVACY_POLICY,
  SUPPORT_EMAIL,
  TERMS_OF_SERVICE,
  bulletText,
  isBullet,
  splitRich,
} from "../documents.ts";

describe("splitRich", () => {
  it("marks the emphasised part and leaves the rest alone", () => {
    expect(splitRich("**Your account.** An email address.")).toEqual([
      { text: "Your account.", bold: true },
      { text: " An email address.", bold: false },
    ]);
  });

  it("handles a line with no markup", () => {
    expect(splitRich("Plain sentence.")).toEqual([{ text: "Plain sentence.", bold: false }]);
  });

  it("handles emphasis in the middle", () => {
    expect(splitRich("we do **not** sell your data")).toEqual([
      { text: "we do ", bold: false },
      { text: "not", bold: true },
      { text: " sell your data", bold: false },
    ]);
  });

  it("does not swallow a stray asterisk", () => {
    // An unmatched marker must render as itself rather than eating the line.
    expect(splitRich("2 ** 8 is 256").map((s) => s.text).join("")).toBe("2 ** 8 is 256");
    expect(splitRich("an * asterisk").map((s) => s.text).join("")).toBe("an * asterisk");
  });

  it("never loses characters, over every line the documents actually contain", () => {
    // The property that matters: rendering must not drop text from a legal
    // document. A unit test on invented input would not have caught a line
    // these documents really use.
    const lines = [...PRIVACY_POLICY.sections, ...TERMS_OF_SERVICE.sections]
      .flatMap((s) => s.body)
      .concat(PRIVACY_POLICY.intro, TERMS_OF_SERVICE.intro);

    for (const line of lines) {
      const rebuilt = splitRich(line).map((s) => s.text).join("");
      expect(rebuilt, line).toBe(line.replace(/\*\*/g, ""));
    }
  });
});

describe("bullets", () => {
  it("recognises and strips the marker", () => {
    expect(isBullet("- a point")).toBe(true);
    expect(bulletText("- a point")).toBe("a point");
  });

  it("leaves a paragraph alone", () => {
    expect(isBullet("A sentence - with a dash.")).toBe(false);
    expect(bulletText("A sentence - with a dash.")).toBe("A sentence - with a dash.");
  });
});

describe("the documents themselves", () => {
  it("disclose the third-party model provider", () => {
    // The single most significant thing this product does with someone's data,
    // and the text this replaced left it out entirely.
    const text = PRIVACY_POLICY.sections.flatMap((s) => s.body).join(" ");
    expect(text).toMatch(/third-party model provider/i);
  });

  it("say how to delete an account", () => {
    const text = PRIVACY_POLICY.sections.flatMap((s) => s.body).join(" ");
    expect(text).toMatch(/delete your account/i);
  });

  it("give a contact address, which the store listing requires", () => {
    for (const doc of [PRIVACY_POLICY, TERMS_OF_SERVICE]) {
      expect(doc.sections.flatMap((s) => s.body).join(" ")).toContain(SUPPORT_EMAIL);
    }
  });

  it("have no empty sections", () => {
    for (const doc of [PRIVACY_POLICY, TERMS_OF_SERVICE]) {
      for (const section of doc.sections) {
        expect(section.heading.length, doc.title).toBeGreaterThan(0);
        expect(section.body.length, `${doc.title} / ${section.heading}`).toBeGreaterThan(0);
      }
    }
  });

  it("leave no unresolved interpolation in the rendered text", () => {
    // These strings are also parsed by make-legal-pages.mjs, which resolves
    // ${SUPPORT_EMAIL} itself. A marker reaching a published policy would be
    // visible to every reader.
    for (const doc of [PRIVACY_POLICY, TERMS_OF_SERVICE]) {
      for (const line of doc.sections.flatMap((s) => s.body)) {
        expect(line, doc.title).not.toContain("${");
      }
    }
  });
});
