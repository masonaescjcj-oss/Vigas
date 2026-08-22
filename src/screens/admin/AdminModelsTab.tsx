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
import { deleteModel, listModels, saveModel, type ModelRow } from "../../services/adminService";
import { Action, Card, Field, Pill, SectionTitle, TabState } from "./adminUi";

export const AdminModelsTab: React.FC = () => {
  const { colors } = useTheme();

  const [models, setModels] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [modelId, setModelId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setModels(await listModels());
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
      </Text>

      <TabState loading={loading} empty={models.length === 0} emptyText="No models configured." />

      {models.map((model) => (
        <Card key={model.id}>
          <View className="flex-row items-center mb-1">
            <Icon name={model.icon} size={13} color={colors[model.tone]} style={{ marginRight: 8 }} />
            <Text variant="body" className="font-uiMedium text-left flex-1" numberOfLines={1}>
              {model.display_name}
            </Text>
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
