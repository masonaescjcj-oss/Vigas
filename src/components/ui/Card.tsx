/**
 * components/ui/Card.tsx
 * ---------------------------------------------------------------------------
 * A raised panel for a group of related things.
 *
 * One radius (18px), one hairline, no drop shadow — the panel stands up from
 * the body by being a step lighter, the way a key cap does. Keys go on it;
 * wells sink into it.
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
      className={`${flush ? "" : "p-4"} overflow-hidden ${className}`}
      style={[
        { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderHairline, borderRadius: 18 },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};
