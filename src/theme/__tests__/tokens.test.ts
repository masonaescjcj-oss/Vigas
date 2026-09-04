import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { themeColors, type ColorTokens } from "../theme";

/**
 * Every colour token has to exist in three places for a class like
 * `bg-surfaceMuted` to do anything: the palette, the Tailwind config, and the
 * ThemeProvider's CSS variables. Eleven tokens were in the palette and nowhere
 * else, so the classes silently did nothing and 76 places across the screens
 * reached for Tailwind's default purple, slate and red instead.
 *
 * This reads the two config files as text rather than importing them, because
 * one is CommonJS and the other renders a React tree — and because the thing
 * being checked is literally "is the string present".
 */
const ROOT = join(__dirname, "..", "..", "..");
const tailwind = readFileSync(join(ROOT, "tailwind.config.js"), "utf8");
const provider = readFileSync(join(ROOT, "src", "theme", "ThemeProvider.tsx"), "utf8");

const keys = Object.keys(themeColors.darkest) as Array<keyof ColorTokens>;

describe("every colour token is reachable from a className", () => {
  it("is registered in tailwind.config.js", () => {
    const missing = keys.filter((k) => !tailwind.includes(`${k}: "var(--${k})"`));
    expect(missing, `add to tailwind.config.js colors: ${missing.join(", ")}`).toEqual([]);
  });

  it("is injected as a CSS variable by the ThemeProvider", () => {
    const missing = keys.filter((k) => !provider.includes(`"--${k}": colors.${k}`));
    expect(missing, `add to ThemeProvider themeStyles: ${missing.join(", ")}`).toEqual([]);
  });

  it("is defined in all three palettes with the same keys", () => {
    for (const mode of ["light", "dark", "darkest"] as const) {
      expect(Object.keys(themeColors[mode]).sort(), mode).toEqual([...keys].sort());
    }
  });

  it("uses no default Tailwind hue names as token names", () => {
    // If a token were called `purple`, `bg-purple` would be ambiguous between
    // ours and Tailwind's, and the leak this guards against comes straight back.
    const tailwindHues = ["purple", "slate", "sky", "gray", "zinc", "red", "amber", "emerald", "green", "blue", "indigo", "violet", "white", "black"];
    expect(keys.filter((k) => tailwindHues.includes(k))).toEqual([]);
  });
});
