/**
 * frontend/src/components/UsageChart.tsx
 * ---------------------------------------------------------------------------
 * Tokens per period, as bars.
 *
 * One series, so one colour and no legend — the card's title names it. The
 * value was printed above every bar, which is a table drawn as a chart: the
 * numbers competed with the shape they were meant to annotate. Only the tallest
 * bar and the most recent one are labelled, which is what a reader actually
 * looks for ("how bad did it get" and "where am I now").
 *
 * The bars sit on a baseline with a recessive top reference line, so a bar's
 * height can be read against something rather than only against its neighbours.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View } from "react-native";
import { Text } from "./Typography";
import { useTheme } from "../theme/ThemeProvider";

interface ChartDataPoint {
  dayLabel: string;
  value: number;
}

interface UsageChartProps {
  data: ChartDataPoint[];
  /** Floor for the scale, so a quiet week does not make one token look huge. */
  maxVal?: number;
  title?: string;
}

/** 12300 → "12.3k". Charts are read at a glance; six digits are not. */
function short(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

const PLOT_HEIGHT = 120;

export const UsageChart: React.FC<UsageChartProps> = ({ data, maxVal = 0, title = "Tokens used" }) => {
  const { colors } = useTheme();
  if (data.length === 0) return null;

  const values = data.map((d) => d.value);
  const peak = Math.max(...values, maxVal, 1);
  const peakIndex = values.indexOf(Math.max(...values));
  const lastIndex = data.length - 1;

  return (
    <View
      className="p-4 rounded-card"
      style={{ backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderHairline }}
    >
      <View className="flex-row items-baseline justify-between mb-1">
        <Text variant="label">{title}</Text>
        <Text variant="caption" style={{ color: colors.inkMuted, fontVariant: ["tabular-nums"] }}>
          peak {short(peak)}
        </Text>
      </View>

      <View style={{ height: PLOT_HEIGHT, marginTop: 14 }}>
        {/* The reference the bars are read against. One line, hairline weight. */}
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 1,
            backgroundColor: colors.borderHairline,
          }}
        />
        <View className="flex-row items-end" style={{ height: PLOT_HEIGHT }}>
          {data.map((point, index) => {
            const height = Math.max(2, Math.round((point.value / peak) * PLOT_HEIGHT));
            // Label the worst period and the current one; anything more is a
            // table. If they are the same bar, it is labelled once.
            const labelled = index === peakIndex || index === lastIndex;
            return (
              <View key={`${point.dayLabel}-${index}`} className="flex-1 items-center justify-end">
                {labelled ? (
                  <Text
                    variant="caption"
                    style={{ color: colors.inkSecondary, fontSize: 10, fontVariant: ["tabular-nums"], marginBottom: 3 }}
                  >
                    {short(point.value)}
                  </Text>
                ) : null}
                <View
                  style={{
                    height,
                    // A 2px gap of surface between neighbours, so bars read as
                    // separate marks without a border around each one.
                    width: "100%",
                    marginHorizontal: 1,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    backgroundColor: colors.brandPrimary,
                    opacity: index === lastIndex ? 1 : 0.55,
                  }}
                />
              </View>
            );
          })}
        </View>
      </View>

      {/* Baseline, then the period labels under it. */}
      <View style={{ height: 1, backgroundColor: colors.borderHairline, marginTop: 0 }} />
      <View className="flex-row mt-1.5">
        {data.map((point, index) => (
          <View key={`label-${point.dayLabel}-${index}`} className="flex-1 items-center">
            <Text variant="caption" style={{ color: colors.inkMuted, fontSize: 10 }} numberOfLines={1}>
              {point.dayLabel}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};
