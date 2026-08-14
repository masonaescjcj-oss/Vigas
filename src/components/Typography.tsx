/**
 * frontend/src/components/Typography.tsx
 * ---------------------------------------------------------------------------
 * Dual typography system:
 *   - Clean Grotesk font (Inter) for UI elements (buttons, labels, headings)
 *   - Editorial Serif font (Source Serif) for agent responses (Perplexity style)
 *   - Monospace (JetBrains Mono) for code blocks and terminal elements
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { Text as RNText, type TextProps } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

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

  // Map variants to Tailwind classes
  let variantClass = "";
  switch (variant) {
    case "h1":
      // Clean UI font, semibold (Inter), size 24px
      variantClass = "font-uiSemiBold text-2xl tracking-tight text-inkPrimary";
      break;
    case "h2":
      // Clean UI font, semibold (Inter), size 20px
      variantClass = "font-uiSemiBold text-xl tracking-tight text-inkPrimary";
      break;
    case "h3":
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

  return (
    <RNText
      className={`${variantClass} ${className}`}
      style={[{ color: colors.inkPrimary }, style]}
      {...props}
    >
      {children}
    </RNText>
  );
};
