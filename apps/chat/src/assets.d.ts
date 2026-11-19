/**
 * frontend/src/assets.d.ts
 * ---------------------------------------------------------------------------
 * Font files are imported directly, so TypeScript needs to know what they are.
 *
 * Metro resolves a `.ttf` import to an asset handle — a number on native, a URL
 * on web — and `expo-font` takes it either way. The reason the imports are
 * per-file rather than from each font package's root is in useAppFonts.ts:
 * the root re-exports every weight, and an asset `require` cannot be
 * tree-shaken, so four Inter imports shipped nine faces.
 * ---------------------------------------------------------------------------
 */

declare module "*.ttf" {
  const asset: number | string;
  export default asset;
}

declare module "*.otf" {
  const asset: number | string;
  export default asset;
}
