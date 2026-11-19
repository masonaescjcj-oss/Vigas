/**
 * frontend/src/screens/subscription/TokenUsageScreen.tsx
 * ---------------------------------------------------------------------------
 * How much has been used, and how much is left.
 *
 * Two half-dials first: builds and chat messages in the rolling window, the
 * limits a person actually runs into. They are read from the same counters the
 * server refuses requests on, so the dial and the refusal cannot disagree.
 * When the server does not send them (a count failed, or an older function),
 * the dials are simply left out and the token figures stand alone.
 *
 * The headline is the number, not a label above it. A meter is only drawn when
 * there is a limit to measure against — a zero limit used to produce
 * `width: "NaN%"`, which renders as a full bar: the worst possible lie for a
 * usage meter.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { View, ScrollView, SafeAreaView, ActivityIndicator } from "react-native";
import { notify } from "../../services/notify";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../types/navigation";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { UsageChart } from "../../components/UsageChart";
import { Card } from "../../components/ui/Card";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import { PURCHASES } from "../../services/distributionChannel";
import { supabase } from "../../services/supabase";
import { Gauge } from "../../components/ui/Gauge";
import { getQuota, type QuotaReading } from "../../services/usageService";

/** "resets in 7h 20m" for a full window, "rolling 12h" otherwise. */
function windowDetail(q: QuotaReading, now = Date.now()): string {
  if (q.limit !== null && q.used >= q.limit && q.nextFreeAt) {
    const ms = Math.max(0, new Date(q.nextFreeAt).getTime() - now);
    const h = Math.floor(ms / 3_600_000);
    const m = Math.round((ms % 3_600_000) / 60_000);
    return h > 0 ? `next in ${h}h ${m}m` : `next in ${m}m`;
  }
  return `rolling ${q.windowHours}h`;
}

export const TokenUsageScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [quota, setQuota] = useState<{ build: QuotaReading; chat: QuotaReading } | null>(null);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [tokensLimit, setTokensLimit] = useState(0);
  const [loading, setLoading] = useState(false);

  // Real per-period history from usage_metering (one row per period).
  const [usageHistory, setUsageHistory] = useState<Array<{ dayLabel: string; value: number }>>([]);

  useEffect(() => {
    const fetchUsage = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("usage_metering")
          .select("tokens_used, plan_limit_tokens, period_start")
          .order("period_start", { ascending: false })
          .limit(7);

        if (error) throw error;
        const rows = data ?? [];
        if (rows.length > 0) {
          setTokensUsed(rows[0].tokens_used ?? 0);
          setTokensLimit(rows[0].plan_limit_tokens ?? 0);
          setUsageHistory(
            [...rows].reverse().map((row) => ({
              dayLabel: new Date(row.period_start).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
              value: row.tokens_used ?? 0,
            })),
          );
        } else {
          setTokensUsed(0);
          setTokensLimit(0);
          setUsageHistory([]);
        }
      } catch (e: any) {
        notify("Could not load usage", e?.message ?? "Please try again.");
      } finally {
        setLoading(false);
      }
    };
    void fetchUsage();
    // Separate from the token read: a failure here costs the dials, not the page.
    getQuota().then(setQuota).catch(() => setQuota(null));
  }, []);

  // A missing or zero plan limit is normal (no metering row yet, or an
  // unmetered plan), and there is nothing to draw a meter against.
  const hasLimit = tokensLimit > 0;
  const usagePercent = hasLimit ? Math.min((tokensUsed / tokensLimit) * 100, 100) : 0;
  const isCloseToLimit = hasLimit && usagePercent >= 75;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScreenHeader title="Usage" subtitle={quota ? `rolling ${quota.build.windowHours}-hour window` : undefined} divider={false} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.inkMuted} style={{ marginTop: 32 }} />
        ) : (
          <>
            {quota ? (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 12 }}>
                <Card style={{ flex: 1, alignItems: "center", paddingTop: 18, paddingBottom: 16 }}>
                  <Gauge used={quota.build.used} limit={quota.build.limit} label="builds" detail={windowDetail(quota.build)} />
                </Card>
                <Card style={{ flex: 1, alignItems: "center", paddingTop: 18, paddingBottom: 16 }}>
                  <Gauge used={quota.chat.used} limit={quota.chat.limit} label="messages" detail={windowDetail(quota.chat)} />
                </Card>
              </View>
            ) : null}
            <Card className="mt-2">
              <Text
                style={{
                  color: colors.inkPrimary,
                  fontSize: 30,
                  fontWeight: "600",
                  letterSpacing: -0.5,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {tokensUsed.toLocaleString("en-US")}
              </Text>
              <Text variant="caption" style={{ color: colors.inkMuted }}>
                {hasLimit ? `of ${tokensLimit.toLocaleString("en-US")} tokens this period` : "tokens this period"}
              </Text>

              {hasLimit ? (
                <>
                  <View
                    className="rounded-pill mt-4 overflow-hidden"
                    style={{ height: 6, backgroundColor: colors.surfaceMuted }}
                  >
                    <View
                      className="h-full rounded-pill"
                      style={{
                        width: `${usagePercent}%`,
                        backgroundColor: isCloseToLimit ? colors.warning : colors.brandPrimary,
                      }}
                    />
                  </View>
                  <Text
                    variant="caption"
                    className="mt-2"
                    style={{ color: isCloseToLimit ? colors.warning : colors.inkMuted }}
                  >
                    {isCloseToLimit
                      ? `${Math.round(100 - usagePercent)}% left before runs are blocked`
                      : `${(tokensLimit - tokensUsed).toLocaleString("en-US")} left`}
                  </Text>
                </>
              ) : (
                <Text variant="caption" className="mt-3" style={{ color: colors.inkMuted, lineHeight: 18 }}>
                  No token limit is set on this plan.
                </Text>
              )}
            </Card>

            {usageHistory.length > 1 ? (
              <>
                <SectionTitle>History</SectionTitle>
                <UsageChart data={usageHistory} title="Tokens per period" />
              </>
            ) : null}

            {/* Only where there is something to upgrade to. */}
            {isCloseToLimit && PURCHASES.canMentionPlans ? (
              <Card className="mt-4">
                <Text variant="body" className="font-uiMedium">Running out</Text>
                <Text variant="caption" className="mt-1" style={{ color: colors.inkSecondary, lineHeight: 18 }}>
                  A paid plan removes the token cap, so a long build does not stop halfway.
                </Text>
                <Button label="See plans" size="sm" className="mt-3" onPress={() => navigation.navigate("Paywall", {})} />
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
