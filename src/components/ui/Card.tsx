/**
 * components/ui/Card.tsx
 * ---------------------------------------------------------------------------
 * A raised surface for a group of related things.
 *
 * One radius (card, 16px), one border (the hairline), no shadow. The admin
 * panel had this right and the rest of the app did not; this is that card,
 * available to everyone.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, type ViewProps } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

interface CardProps extends ViewProps {
  /** Drop the inner padding when the card holds rows that pad themselves. */
  flush?: boolean;
}

export const Card: React.FC<CardProps> = ({ flush = false, className = "", style, children, ...props }) => {
  const { colors } = useTheme();
  return (
    <View
      className={`${flush ? "" : "p-4"} rounded-card overflow-hidden ${className}`}
      style={[{ backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderHairline }, style]}
      {...props}
    >
      {children}
    </View>
  );
};
