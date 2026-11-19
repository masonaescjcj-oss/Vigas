/**
 * frontend/src/components/Typography.tsx
 * ---------------------------------------------------------------------------
 * Every piece of text in the app, set in the right face.
 *
 *   h1 h2 h3   Bricolage Grotesque — titles
 *   body       IBM Plex Sans
 *   caption    IBM Plex Sans, one step dimmer
 *   label      IBM Plex Mono, lowercase — the printed legend on a panel
 *   code       IBM Plex Mono
 *
 * The weight a screen asks for — `font-uiSemiBold`, `font-semibold`,
 * `fontWeight: "600"` — picks the file (theme/fonts.ts explains why a custom
 * face cannot just be told to be bold). When a file is chosen, fontWeight is
 * reset to normal so the browser does not also synthesise a bold on top of an
 * already-bold file.
 *
 * Persian and Arabic keep the device's face in every variant except code.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { fontFamilyFor, textOf, weightFrom, type FontRole, type FontWeightName } from "../theme/fonts";

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

const VARIANT: Record<TypographyVariant, { cls: string; role: FontRole; weight: FontWeightName; style?: TextStyle }> = {
  h1: { cls: "text-inkPrimary", role: "display", weight: "semibold", style: { fontSize: 32, lineHeight: 36, letterSpacing: -1 } },
  h2: { cls: "text-inkPrimary", role: "display", weight: "semibold", style: { fontSize: 24, lineHeight: 29, letterSpacing: -0.6 } },
  h3: { cls: "text-inkPrimary", role: "display", weight: "semibold", style: { fontSize: 18, lineHeight: 23, letterSpacing: -0.3 } },
  body: { cls: "text-inkPrimary", role: "ui", weight: "regular", style: { fontSize: 15, lineHeight: 22 } },
  label: { cls: "text-inkMuted", role: "mono", weight: "regular", style: { fontSize: 12, lineHeight: 16, letterSpacing: 0.2, textTransform: "lowercase" } },
  code: { cls: "text-inkPrimary bg-surfaceCode p-2 rounded", role: "mono", weight: "regular", style: { fontSize: 13 } },
  caption: { cls: "text-inkSecondary", role: "ui", weight: "regular", style: { fontSize: 12.5, lineHeight: 18 } },
};

export const Text: React.FC<TypographyProps> = ({
  variant = "body",
  children,
  style,
  className = "",
  ...props
}) => {
  const { colors } = useTheme();
  const v = VARIANT[variant];

  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const weight = weightFrom(className, flat.fontWeight, v.weight);
  const family = fontFamilyFor(textOf(children), weight, v.role);

  // A call site that sizes its text with a class (`text-xs`, `text-[11px]`,
  // `leading-5`) must keep that size. Inline style beats a class on the web,
  // so the variant's own size is dropped wherever the caller named one.
  const variantStyle: TextStyle = { ...v.style };
  if (/\btext-(xs|sm|base|lg|xl|[2-6]xl|\[[\d.]+px\])\b/.test(className)) {
    delete variantStyle.fontSize;
    delete variantStyle.lineHeight;
  }
  if (/\bleading-/.test(className)) delete variantStyle.lineHeight;
  if (/\btracking-/.test(className)) delete variantStyle.letterSpacing;
  if (/\b(uppercase|lowercase|normal-case|capitalize)\b/.test(className)) delete variantStyle.textTransform;

  return (
    <RNText
      className={`${v.cls} ${className}`}
      style={[
        { color: variant === "label" ? colors.inkMuted : variant === "caption" ? colors.inkSecondary : colors.inkPrimary },
        variantStyle,
        style,
        // Last, so it wins over the caller's fontWeight: the file carries the
        // weight now. Only when a file was chosen — the system face still needs
        // fontWeight to be bold at all.
        family ? { fontFamily: family, fontWeight: "normal" } : null,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
};
