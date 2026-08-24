/**
 * frontend/src/screens/admin/AdminFunnelTab.tsx
 * ---------------------------------------------------------------------------
 * How far people get.
 *
 * Counted by distinct person, not by event: "312 builds started" and "40 people
 * started a build" are different facts, and only the second one tells you
 * whether the product works. Both are shown, because the ratio between them is
 * itself the interesting number — a handful of people doing everything looks
 * identical to a crowd in the totals alone.
 *
 * Drop-off is shown against the previous step rather than the first, so a stage
 * that is losing people is visible instead of being flattened by whatever
 * happened at signup.
 * ---------------------------------------------------------------------------
 */

import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "../../components/Typography";
import { useTheme } from "../../theme/ThemeProvider";
import { notify } from "../../services/notify";
import { fetchFunnel, type AdminFunnel } from "../../services/adminService";
import { Card, SectionTitle, TabState } from "./adminUi";

/** The path a user is meant to walk, in order. */
const STEPS: Array<{ event: string; label: string }> = [
  { event: "signed_in", label: "Signed in" },
  { event: "project_created", label: "Created a project" },
  { event: "build_started", label: "Started a build" },
  { event: "build_finished", label: "Finished a build" },
  { event: "preview_opened", label: "Opened the preview" },
  { event: "share_published", label: "Published a share" },
];

/** Steps that are about money rather than about building. */
const INTENT: Array<{ event: string; label: string }> = [
  { event: "model_locked_tapped", label: "Tapped a locked model" },
  { event: "paywall_seen", label: "Saw the paywall" },
  { event: "checkout_started", label: "Started checkout" },
];

export const AdminFunnelTab: React.FC = () => {
  const { colors } = useTheme();
  const [data, setData] = useState<AdminFunnel | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchFunnel());
    } catch (e: any) {
      notify("Could not load the funnel", e?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const users = data?.users_by_event ?? {};
  const totals = data?.events_total ?? {};

  const row = (
    label: string,
    event: string,
    previous: number | null,
  ) => {
    const people = users[event] ?? 0;
    const count = totals[event] ?? 0;
    // Against the previous step, not the first: otherwise every later stage
    // reads as catastrophic and the one actually losing people is invisible.
    const kept = previous && previous > 0 ? Math.round((people / previous) * 100) : null;

    return (
      <View key={event} className="flex-row items-center py-2">
        <View className="flex-1">
          <Text variant="caption" className="font-uiMedium text-left">{label}</Text>
          <Text variant="caption" className="text-[11px] opacity-50 text-left">
            {count} event{count === 1 ? "" : "s"}
          </Text>
        </View>
        <Text variant="body" className="font-uiSemiBold mr-3">{people}</Text>
        <View style={{ width: 52 }}>
          {kept !== null ? (
            <Text
              variant="caption"
              className="text-[11px] text-right"
              style={{ color: kept >= 50 ? colors.success : kept >= 20 ? colors.warning : colors.failed }}
            >
              {kept}%
            </Text>
          ) : (
            <Text variant="caption" className="text-[11px] text-right opacity-30">—</Text>
          )}
        </View>
      </View>
    );
  };

  const outcomes = data?.build_outcomes ?? {};
  const outcomeTotal = Object.values(outcomes).reduce((sum, n) => sum + n, 0);

  return (
    <View>
      <Text
        variant="caption"
        className="text-left leading-5 mb-3"
        style={{ color: colors.inkSecondary }}
      >
        Last 30 days. The bold number is distinct people; the percentage is how
        many of the previous step got this far. Nothing here records what anyone
        typed or built.
      </Text>

      <TabState
        loading={loading}
        empty={!loading && (data?.events_recorded ?? 0) === 0}
        emptyText="No events recorded yet."
      />

      {data && data.events_recorded > 0 ? (
        <>
          <Card>
            {STEPS.map((step, index) =>
              row(
                step.label,
                step.event,
                index === 0 ? null : (users[STEPS[index - 1].event] ?? 0),
              ),
            )}
          </Card>

          <SectionTitle hint="Whether anyone is trying to pay, and where they stop.">
            Intent to buy
          </SectionTitle>
          <Card>
            {INTENT.map((step, index) =>
              row(
                step.label,
                step.event,
                index === 0 ? null : (users[INTENT[index - 1].event] ?? 0),
              ),
            )}
          </Card>

          {outcomeTotal > 0 ? (
            <>
              <SectionTitle hint="Recorded by the worker, so a run that failed after the app closed still counts.">
                How builds end
              </SectionTitle>
              <Card>
                {Object.entries(outcomes)
                  .sort((a, b) => b[1] - a[1])
                  .map(([outcome, count]) => (
                    <View key={outcome} className="flex-row items-center py-1.5">
                      <Text variant="caption" className="flex-1 text-left font-uiMedium">
                        {outcome}
                      </Text>
                      <Text variant="caption" className="mr-3 opacity-60">{count}</Text>
                      <Text
                        variant="caption"
                        className="text-[11px]"
                        style={{
                          width: 42,
                          textAlign: "right",
                          color: outcome === "failed" ? colors.failed : colors.inkSecondary,
                        }}
                      >
                        {Math.round((count / outcomeTotal) * 100)}%
                      </Text>
                    </View>
                  ))}
              </Card>
            </>
          ) : null}

          {data.truncated ? (
            <Text variant="caption" className="text-[11px] mt-3" style={{ color: colors.warning }}>
              Showing the first 50,000 events — the real numbers are higher.
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
};
