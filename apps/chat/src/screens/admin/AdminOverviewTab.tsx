/**
 * frontend/src/screens/admin/AdminOverviewTab.tsx
 * ---------------------------------------------------------------------------
 * Who is using the app, and how much.
 *
 * There is no revenue figure here on purpose. The money is held by Apple,
 * Google and RevenueCat; a number invented from subscription rows would look
 * authoritative and be wrong the moment someone refunds or a renewal fails.
 * What is shown instead is what this database actually knows.
 * ---------------------------------------------------------------------------
 */

import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "../../components/Typography";
import { useTheme } from "../../theme/ThemeProvider";
import { notify } from "../../services/notify";
import { fetchOverview, type AdminOverview } from "../../services/adminService";
import { Action, Card, SectionTitle, Stat, TabState } from "./adminUi";

export const AdminOverviewTab: React.FC = () => {
  const { colors } = useTheme();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchOverview());
    } catch (e: any) {
      notify("Could not load the overview", e?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const compact = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k`
    : String(n);

  return (
    <View>
      <TabState loading={loading} empty={!data} emptyText="Nothing to show yet." />

      {data ? (
        <>
          <View className="flex-row mb-1">
            <Stat label="Users" value={compact(data.users_total)} />
            <Stat label="Paying" value={compact(data.active_subscriptions)} />
          </View>
          <View className="flex-row mb-3">
            <Stat label="Builds · 30 days" value={compact(data.builds_last_30_days)} />
            <Stat label="Tokens · 30 days" value={compact(data.tokens_last_30_days)} />
          </View>

          <SectionTitle>Users by plan</SectionTitle>
          <Card>
            {Object.entries(data.users_by_tier).length === 0 ? (
              <Text variant="caption" style={{ color: colors.inkMuted }} className="text-left">
                No users yet.
              </Text>
            ) : (
              Object.entries(data.users_by_tier)
                .sort((a, b) => b[1] - a[1])
                .map(([tier, count]) => (
                  <View key={tier} className="flex-row items-center justify-between py-1.5">
                    <Text variant="body" className="text-left font-uiMedium">{tier}</Text>
                    <Text variant="body" className="font-mono" style={{ color: colors.inkSecondary }}>
                      {count.toLocaleString("en-US")}
                    </Text>
                  </View>
                ))
            )}
          </Card>

          <Card>
            <Text
              variant="caption"
              className="text-left leading-5 text-[11px]"
              style={{ color: colors.inkMuted }}
            >
              {data.revenue_note}
            </Text>
          </Card>

          <Action label="Refresh" onPress={load} className="mb-8" />
        </>
      ) : null}
    </View>
  );
};
