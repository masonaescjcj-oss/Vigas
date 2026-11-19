/**
 * frontend/src/screens/admin/AdminModelsTab.tsx
 * ---------------------------------------------------------------------------
 * Which models users are offered.
 *
 * This list is both the picker in the app and the server's allow-list: turning
 * a model off here stops it being shown *and* stops it being accepted if
 * someone asks for it directly. One switch, not two that can disagree.
 * ---------------------------------------------------------------------------
 */

import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "../../components/Typography";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { confirmAction, notify } from "../../services/notify";
import { successFeedback } from "../../services/haptics";
import {
  deleteModel,
  listModels,
  listPlans,
  type ModelRow,
  type PlanRow,
  saveModel,
} from "../../services/adminService";
import { Action, Card, Field, Pill, SectionTitle, TabState } from "./adminUi";

/**
 * What a plan key is called. Falls back to the key so a model gated on a plan
 * that has since been removed still reads as gated rather than as free.
 */
function planName(plans: PlanRow[], key: string): string {
  return plans.find((plan) => plan.key === key)?.display_name ?? key;
}

export const AdminModelsTab: React.FC = () => {
  const { colors } = useTheme();

  const [models, setModels] = useState<ModelRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [modelId, setModelId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Plans as well as models: min_tier holds a plan *key*, and the tier
      // control has to offer the plans that exist rather than a hardcoded set.
      const [loadedModels, loadedPlans] = await Promise.all([listModels(), listPlans()]);
      setModels(loadedModels);
      setPlans(loadedPlans);
    } catch (e: any) {
      notify("Could not load models", e?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!modelId.trim() || !displayName.trim() || saving) return;
    setSaving(true);
    try {
      await saveModel({
        modelId: modelId.trim(),
        displayName: displayName.trim(),
        description: description.trim() || null,
        sortOrder: models.length,
      });
      successFeedback();
      setModelId("");
      setDisplayName("");
      setDescription("");
      await load();
    } catch (e: any) {
      notify("Could not save that model", e?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (model: ModelRow) => {
    setBusyId(model.id);
    try {
      await saveModel({
        modelId: model.id,
        displayName: model.display_name,
        description: model.description,
        tone: model.tone,
        icon: model.icon,
        minTier: model.min_tier,
        isDefault: model.is_default,
        isActive: !model.is_active,
        sortOrder: model.sort_order,
      });
      await load();
    } catch (e: any) {
      notify("Could not update it", e?.message ?? "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Move a model along the plan ladder: Free → the cheapest paid plan → … → Free.
   *
   * A cycle rather than a picker because the ladder is short and the question is
   * binary most of the time. min_tier null is what "free for everyone" means in
   * the table, so wrapping back to null is how a model is made free again.
   */
  const handleCycleTier = async (model: ModelRow) => {
    const paid = [...plans]
      .sort((a, b) => a.sort_order - b.sort_order)
      .filter((plan) => plan.sort_order > 0);
    if (paid.length === 0) {
      notify("No paid plans configured", "Add a plan above the free tier before gating a model.");
      return;
    }
    const at = paid.findIndex((plan) => plan.key === model.min_tier);
    const next = model.min_tier === null
      ? paid[0].key
      : at >= 0 && at < paid.length - 1
        ? paid[at + 1].key
        : null;

    setBusyId(model.id);
    try {
      await saveModel({
        modelId: model.id,
        displayName: model.display_name,
        description: model.description,
        tone: model.tone,
        icon: model.icon,
        minTier: next,
        isDefault: model.is_default,
        isActive: model.is_active,
        sortOrder: model.sort_order,
      });
      successFeedback();
      await load();
    } catch (e: any) {
      notify("Could not change who can use it", e?.message ?? "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleMakeDefault = async (model: ModelRow) => {
    setBusyId(model.id);
    try {
      await saveModel({
        modelId: model.id,
        displayName: model.display_name,
        description: model.description,
        tone: model.tone,
        icon: model.icon,
        minTier: model.min_tier,
        isDefault: true,
        isActive: true,
        sortOrder: model.sort_order,
      });
      successFeedback();
      await load();
    } catch (e: any) {
      notify("Could not set the default", e?.message ?? "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (model: ModelRow) => {
    const confirmed = await confirmAction(
      `Remove ${model.display_name}?`,
      "It disappears from the picker. Chats that already used it are unaffected.",
      { destructive: true, confirmLabel: "Remove" },
    );
    if (!confirmed) return;
    setBusyId(model.id);
    try {
      await deleteModel(model.id);
      await load();
    } catch (e: any) {
      notify("Could not remove it", e?.message ?? "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View>
      <Text
        variant="caption"
        className="text-left leading-5 mb-3"
        style={{ color: colors.inkSecondary }}
      >
        Turning a model off hides it from the picker and stops the server accepting it.
        A paid model shows its plan in the picker and sends anyone below that plan
        to the payment screen instead of running.
      </Text>

      <TabState loading={loading} empty={models.length === 0} emptyText="No models configured." />

      {models.map((model) => (
        <Card key={model.id}>
          <View className="flex-row items-center mb-1">
            <Icon name={model.icon} size={13} color={colors[model.tone]} style={{ marginRight: 8 }} />
            <Text variant="body" className="font-uiMedium text-left flex-1" numberOfLines={1}>
              {model.display_name}
            </Text>
            {/* Who can use it, in the same words the picker shows the user. */}
            {model.min_tier
              ? <Pill tone="warning">{planName(plans, model.min_tier)}</Pill>
              : <Pill tone="success">Free</Pill>}
            {model.is_default ? <Pill tone="success">Default</Pill> : null}
            {!model.is_active ? <Pill tone="muted">Off</Pill> : null}
          </View>

          <Text
            variant="caption"
            className="text-left text-[11px] font-mono"
            style={{ color: colors.inkMuted }}
            numberOfLines={1}
          >
            {model.id}
          </Text>
          {model.description ? (
            <Text
              variant="caption"
              className="text-left text-[11px] mt-0.5"
              style={{ color: colors.inkSecondary }}
            >
              {model.description}
            </Text>
          ) : null}

          <View className="flex-row justify-end mt-3">
            <Action
              label={model.min_tier ? `${planName(plans, model.min_tier)} →` : "Make paid"}
              onPress={() => handleCycleTier(model)}
              busy={busyId === model.id}
              className="mr-2"
            />
            {!model.is_default ? (
              <Action
                label="Make default"
                onPress={() => handleMakeDefault(model)}
                disabled={busyId !== null}
                className="mr-2"
              />
            ) : null}
            <Action
              label={model.is_active ? "Hide" : "Show"}
              onPress={() => handleToggle(model)}
              busy={busyId === model.id}
              className="mr-2"
            />
            <Action label="Remove" tone="danger" onPress={() => handleDelete(model)} disabled={busyId !== null} />
          </View>
        </Card>
      ))}

      <SectionTitle hint="The id is sent to the provider verbatim, so it must match their spelling exactly.">
        Add a model
      </SectionTitle>

      <Field
        label="Model id"
        value={modelId}
        onChangeText={setModelId}
        placeholder="anthropic/claude-sonnet-4"
      />
      <Field label="Shown as" value={displayName} onChangeText={setDisplayName} placeholder="Claude Sonnet 4" />
      <Field
        label="Description (optional)"
        value={description}
        onChangeText={setDescription}
        placeholder="Best for long refactors"
      />

      <Action
        label="Add model"
        tone="primary"
        onPress={handleAdd}
        busy={saving}
        disabled={!modelId.trim() || !displayName.trim()}
        className="mb-8"
      />
    </View>
  );
};
