/**
 * frontend/src/screens/admin/AdminKeysTab.tsx
 * ---------------------------------------------------------------------------
 * The API key pool.
 *
 * The list is ordered exactly as the pool tries keys — priority, then least
 * recently used — so what you see is the order requests will take. Each key
 * says plainly whether it is working, resting after running out of credit, or
 * has never worked at all, because "why is nothing answering" is the question
 * this screen exists to answer at 2am.
 * ---------------------------------------------------------------------------
 */

import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "../../components/Typography";
import { useTheme } from "../../theme/ThemeProvider";
import { confirmAction, notify } from "../../services/notify";
import { errorFeedback, successFeedback } from "../../services/haptics";
import { relativeTime } from "../../services/formatting";
import {
  addKey,
  deleteKey,
  healthLabel,
  keyHealth,
  listKeys,
  testAllKeys,
  testKey,
  updateKey,
  type PoolKeySummary,
} from "../../services/adminService";
import { Action, Card, Field, Pill, SectionTitle, TabState } from "./adminUi";

const PILL_TONE = {
  working: "success",
  resting: "warning",
  off: "muted",
  untested: "failed",
} as const;

export const AdminKeysTab: React.FC = () => {
  const { colors } = useTheme();

  const [keys, setKeys] = useState<PoolKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);
  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [priority, setPriority] = useState("100");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setKeys(await listKeys());
    } catch (e: any) {
      notify("Could not load the key pool", e?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!label.trim() || !baseUrl.trim() || !apiKey.trim() || saving) return;
    setSaving(true);
    try {
      const result = await addKey({
        label,
        baseUrl,
        apiKey,
        model,
        priority: Number(priority) || 100,
      });
      // The key is stored either way; a failed probe is recorded rather than
      // refused, so adding twenty keys is not twenty arguments.
      if (result.verified) successFeedback();
      else notify("Saved, but it did not answer", result.detail);
      setApiKey("");
      setLabel("");
      await load();
    } catch (e: any) {
      errorFeedback();
      notify("Could not add that key", e?.message ?? "Check the endpoint and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (key: PoolKeySummary) => {
    setBusyId(key.id);
    try {
      const result = await testKey(key.id);
      if (result.ok) successFeedback();
      else errorFeedback();
      notify(result.ok ? "Working" : `${key.label} refused`, result.ok ? "It answered." : result.detail);
      await load();
    } catch (e: any) {
      notify("Test failed", e?.message ?? "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleTestAll = async () => {
    setTestingAll(true);
    try {
      const results = await testAllKeys();
      const ok = results.filter((r) => r.ok).length;
      if (ok === results.length) successFeedback();
      else errorFeedback();
      notify(
        `${ok} of ${results.length} working`,
        results.filter((r) => !r.ok).map((r) => `${r.label}: ${r.detail}`).join("\n") || "All keys answered.",
      );
      await load();
    } catch (e: any) {
      notify("Could not test the pool", e?.message ?? "Please try again.");
    } finally {
      setTestingAll(false);
    }
  };

  const handleToggle = async (key: PoolKeySummary) => {
    setBusyId(key.id);
    try {
      // Re-enabling is the operator saying "I topped it up", so the backend
      // also clears the rest timer and the failure count.
      await updateKey(key.id, { isActive: !key.is_active });
      await load();
    } catch (e: any) {
      notify("Could not update it", e?.message ?? "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (key: PoolKeySummary) => {
    const confirmed = await confirmAction(
      `Remove ${key.label}?`,
      "The stored key is deleted. Requests move to the next key in the pool.",
    );
    if (!confirmed) return;
    setBusyId(key.id);
    try {
      await deleteKey(key.id);
      await load();
    } catch (e: any) {
      notify("Could not remove it", e?.message ?? "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const working = keys.filter((k) => keyHealth(k) === "working").length;

  return (
    <View>
      <View className="flex-row items-center justify-between mb-3">
        <Text variant="caption" className="text-left flex-1 mr-3 leading-5" style={{ color: colors.inkSecondary }}>
          {keys.length === 0
            ? "No keys yet. Requests fall back to the key in the server's environment."
            : `${working} of ${keys.length} working. Requests try them top to bottom.`}
        </Text>
        {keys.length > 0 ? (
          <Action label="Test all" icon="zap" onPress={handleTestAll} busy={testingAll} />
        ) : null}
      </View>

      <TabState loading={loading} empty={keys.length === 0} emptyText="Add your first key below." />

      {keys.map((key, index) => {
        const health = keyHealth(key);
        return (
          <Card key={key.id}>
            <View className="flex-row items-center mb-1.5">
              <Text
                variant="caption"
                className="text-[10px] font-mono mr-2"
                style={{ color: colors.inkMuted }}
              >
                #{index + 1}
              </Text>
              <Text variant="body" className="font-uiMedium text-left flex-1" numberOfLines={1}>
                {key.label}
              </Text>
              <Pill tone={PILL_TONE[health]}>{healthLabel(health)}</Pill>
            </View>

            <Text
              variant="caption"
              className="text-left text-[11px]"
              style={{ color: colors.inkSecondary }}
              numberOfLines={1}
            >
              {key.base_url}
            </Text>
            <Text
              variant="caption"
              className="text-left text-[11px] mt-0.5 font-mono"
              style={{ color: colors.inkMuted }}
            >
              ····{key.key_last4} · priority {key.priority}
              {key.model ? ` · ${key.model}` : ""}
            </Text>

            <Text
              variant="caption"
              className="text-left text-[11px] mt-1 leading-4"
              style={{ color: health === "working" ? colors.inkMuted : colors.warning }}
            >
              {health === "working" && key.last_ok_at
                ? `Last answered ${relativeTime(key.last_ok_at)}`
                : key.last_error ?? "Not tried yet"}
            </Text>

            <View className="flex-row justify-end mt-3">
              <Action
                label="Test"
                onPress={() => handleTest(key)}
                busy={busyId === key.id}
                className="mr-2"
              />
              <Action
                label={key.is_active ? "Disable" : "Enable"}
                onPress={() => handleToggle(key)}
                disabled={busyId !== null}
                className="mr-2"
              />
              <Action label="Remove" tone="danger" onPress={() => handleDelete(key)} disabled={busyId !== null} />
            </View>
          </Card>
        );
      })}

      <SectionTitle hint="Keys sharing a priority take turns, so ten from one site share the load. A lower number runs first.">
        Add a key
      </SectionTitle>

      <Field label="Name" value={label} onChangeText={setLabel} placeholder="OpenRouter #1" />
      <Field
        label="Endpoint"
        value={baseUrl}
        onChangeText={setBaseUrl}
        placeholder="https://openrouter.ai/api/v1"
        keyboardType="url"
        hint="The base URL, usually ending in /v1."
      />
      <Field label="API key" value={apiKey} onChangeText={setApiKey} placeholder="sk-..." secureTextEntry />
      <Field label="Default model (optional)" value={model} onChangeText={setModel} placeholder="gpt-5.6-luna" />
      <Field
        label="Priority"
        value={priority}
        onChangeText={setPriority}
        placeholder="100"
        keyboardType="number-pad"
        hint="Lower runs first. Give the cheap provider a lower number."
      />

      <Action
        label="Check and add"
        tone="primary"
        onPress={handleAdd}
        busy={saving}
        disabled={!label.trim() || !baseUrl.trim() || !apiKey.trim()}
        className="mb-8"
      />
    </View>
  );
};
