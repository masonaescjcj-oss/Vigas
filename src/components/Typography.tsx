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
import { fontFamilyFor, textOf, type FontWeightName } from "../theme/fonts";
import { MONO_FAMILY } from "../theme/mono";

export type TypographyVariant =
  | "h1"
  | "h2"
  | "h3"
  | "body"
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
    case "label":
      weight = "medium";
      // A section heading that does not shout: small and one step dimmer than
      // body. It was uppercase with letter-spacing, which made every settings
      // page read as a form.
      variantClass = "font-uiMedium text-xs text-inkSecondary";
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
  // sentence is still a file path. Everything else is the UI face, chosen per
  // string so Persian gets Vazirmatn.
  const family = variant === "code" ? MONO_FAMILY : fontFamilyFor(text, weight);

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
