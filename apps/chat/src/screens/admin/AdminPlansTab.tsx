/**
 * frontend/src/screens/admin/AdminPlansTab.tsx
 * ---------------------------------------------------------------------------
 * What each tier is allowed to do.
 *
 * These numbers are enforced, not decorative: the build limit is read from
 * here on every run. Blank means unlimited, and the fields say so — an empty
 * box that silently meant zero would lock a whole tier out.
 * ---------------------------------------------------------------------------
 */

import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "../../components/Typography";
import { useTheme } from "../../theme/ThemeProvider";
import { notify } from "../../services/notify";
import { successFeedback } from "../../services/haptics";
import { limitLabel, listPlans, parseLimit, updatePlan, type PlanRow } from "../../services/adminService";
import { Action, Card, Field, Pill, TabState } from "./adminUi";

/** The edit buffer for one plan, as text so a field can be blanked. */
interface Draft {
  builds: string;
  tokens: string;
  projects: string;
  price: string;
}

const draftOf = (plan: PlanRow): Draft => ({
  builds: plan.build_runs_per_day === null ? "" : String(plan.build_runs_per_day),
  tokens: plan.token_limit_per_day === null ? "" : String(plan.token_limit_per_day),
  projects: plan.max_projects === null ? "" : String(plan.max_projects),
  price: plan.price_label ?? "",
});

export const AdminPlansTab: React.FC = () => {
  const { colors } = useTheme();

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listPlans();
      setPlans(rows);
      setDrafts(Object.fromEntries(rows.map((p) => [p.key, draftOf(p)])));
    } catch (e: any) {
      notify("Could not load plans", e?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const edit = (key: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const handleSave = async (plan: PlanRow) => {
    const draft = drafts[plan.key];
    if (!draft) return;
    setBusyKey(plan.key);
    try {
      await updatePlan(plan.key, {
        buildRunsPerDay: parseLimit(draft.builds),
        tokenLimitPerDay: parseLimit(draft.tokens),
        maxProjects: parseLimit(draft.projects),
        priceLabel: draft.price.trim() || null,
      });
      successFeedback();
      await load();
    } catch (e: any) {
      notify("Could not save that plan", e?.message ?? "Please try again.");
    } finally {
      setBusyKey(null);
    }
  };

  const dirty = (plan: PlanRow) =>
    JSON.stringify(drafts[plan.key]) !== JSON.stringify(draftOf(plan));

  return (
    <View>
      <Text
        variant="caption"
        className="text-left leading-5 mb-3"
        style={{ color: colors.inkSecondary }}
      >
        Leave a limit blank for unlimited. Questions are always free and unmetered —
        only builds count, because they occupy a worker and a sandbox.
      </Text>

      <TabState loading={loading} empty={plans.length === 0} emptyText="No plans configured." />

      {plans.map((plan) => {
        const draft = drafts[plan.key];
        if (!draft) return null;
        return (
          <Card key={plan.key}>
            <View className="flex-row items-center mb-3">
              <Text variant="body" className="font-uiSemiBold text-left flex-1">
                {plan.display_name}
              </Text>
              <Text
                variant="caption"
                className="text-[10px] font-mono mr-2"
                style={{ color: colors.inkMuted }}
              >
                {plan.key}
              </Text>
              {!plan.is_active ? <Pill tone="muted">Off</Pill> : null}
            </View>

            <Field
              label={`Builds per day — now ${limitLabel(plan.build_runs_per_day)}`}
              value={draft.builds}
              onChangeText={(v) => edit(plan.key, { builds: v })}
              placeholder="Unlimited"
              keyboardType="number-pad"
            />
            <Field
              label={`Tokens per day — now ${limitLabel(plan.token_limit_per_day)}`}
              value={draft.tokens}
              onChangeText={(v) => edit(plan.key, { tokens: v })}
              placeholder="Unlimited"
              keyboardType="number-pad"
            />
            <Field
              label={`Projects — now ${limitLabel(plan.max_projects)}`}
              value={draft.projects}
              onChangeText={(v) => edit(plan.key, { projects: v })}
              placeholder="Unlimited"
              keyboardType="number-pad"
            />
            <Field
              label="Price shown on the paywall"
              value={draft.price}
              onChangeText={(v) => edit(plan.key, { price: v })}
              placeholder="Pro"
              hint="A label only. The real amount is set in the App Store and Google Play."
            />

            <Action
              label={dirty(plan) ? "Save changes" : "Saved"}
              tone={dirty(plan) ? "primary" : "neutral"}
              onPress={() => handleSave(plan)}
              busy={busyKey === plan.key}
              disabled={!dirty(plan)}
            />
          </Card>
        );
      })}

      <View className="mb-8" />
    </View>
  );
};
