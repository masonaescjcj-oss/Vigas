/**
 * frontend/src/components/Typography.tsx
 * ---------------------------------------------------------------------------
 * Every piece of text in the app, set in the right typeface.
 *
 *   Inter          Latin UI text and headings
 *   Vazirmatn      Persian and Arabic — chosen per string, because React
 *                  Native takes one family per Text and no good Latin face
 *                  covers Persian (see theme/fonts.ts)
 *   JetBrains Mono code, paths, the run log
 *
 * The family is applied as a style rather than a Tailwind class: NativeWind
 * maps `font-ui*` to a fixed name, which cannot depend on what the text says.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { Text as RNText, type TextProps } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import {
  MONO_FAMILY,
  displayFamilyFor,
  fontFamilyFor,
  textOf,
  type FontWeightName,
} from "../theme/fonts";

export type TypographyVariant =
  | "h1"
  | "h2"
  | "h3"
  | "body"
  | "bodySerif"
  | "bodySerifItalic"
  | "label"
  | "code"
  | "caption";

interface TypographyProps extends TextProps {
  variant?: TypographyVariant;
  children: React.ReactNode;
}

export const Text: React.FC<TypographyProps> = ({
  variant = "body",
  children,
  style,
  className = "",
  ...props
}) => {
  const { colors } = useTheme();

  // Map variants to Tailwind classes. The family comes from the style below;
  // these only carry size, colour and spacing.
  let variantClass = "";
  let weight: FontWeightName = "regular";
  switch (variant) {
    case "h1":
      weight = "bold";
      // Clean UI font, semibold (Inter), size 24px
      variantClass = "font-uiSemiBold text-2xl tracking-tight text-inkPrimary";
      break;
    case "h2":
      weight = "semibold";
      // Clean UI font, semibold (Inter), size 20px
      variantClass = "font-uiSemiBold text-xl tracking-tight text-inkPrimary";
      break;
    case "h3":
      weight = "medium";
      // Clean UI font, medium (Inter), size 16px
      variantClass = "font-uiMedium text-base text-inkPrimary";
      break;
    case "body":
      // Standard UI clean text
      variantClass = "font-uiRegular text-sm text-inkPrimary leading-5";
      break;
    case "bodySerif":
      // Editorial response font (Source Serif Pro) - key feature
      variantClass = "font-editorial text-base text-inkPrimary leading-6";
      break;
    case "bodySerifItalic":
      variantClass = "font-editorialItalic text-base text-inkPrimary leading-6";
      break;
    case "label":
      weight = "medium";
      // Clean UI label, medium, size 12px
      variantClass = "font-uiMedium text-xs text-inkSecondary uppercase tracking-wider";
      break;
    case "code":
      // Monospace JetBrains Mono for code blocks
      variantClass = "font-mono text-[13px] text-inkPrimary bg-surfaceCode p-2 rounded";
      break;
    case "caption":
      variantClass = "font-uiRegular text-xs text-inkSecondary";
      break;
  }

  const text = textOf(children);

  // Code keeps its monospace regardless of script: a file path in a Persian
  // sentence is still a file path. Headings get the display face — only h1 and
  // h2, where type is large enough for character to read as character rather
  // than as noise. h3 is a section label at body size and stays in Inter.
  const family = variant === "code"
    ? MONO_FAMILY
    : variant === "h1" || variant === "h2"
      ? displayFamilyFor(text, "bold")
      : fontFamilyFor(text, weight);

  return (
    <RNText
      className={`${variantClass} ${className}`}
      style={[{ color: colors.inkPrimary, fontFamily: family }, style]}
      {...props}
    >
      {children}
    </RNText>
  );
};
