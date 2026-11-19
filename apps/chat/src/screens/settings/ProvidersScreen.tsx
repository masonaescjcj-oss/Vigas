/**
 * frontend/src/screens/settings/ProvidersScreen.tsx
 * ---------------------------------------------------------------------------
 * Bring your own AI provider.
 *
 * Any OpenAI-compatible endpoint is accepted — not a menu of famous companies,
 * because the provider worth adding is often a new one. The screen is honest
 * about the two things a user needs to know: their key is stored encrypted and
 * cannot be read back, and it is checked against the provider before it is
 * saved so a typo fails here rather than mid-build.
 *
 * Layout: the header's back control is on the left like every other pushed
 * screen (it had a "Done" on the right, alone). Each provider is a card with a
 * status pill; the form under them uses the app's fields.
 * ---------------------------------------------------------------------------
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { Pill } from "../../components/ui/Pill";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import { confirmAction, notify } from "../../services/notify";
import { errorFeedback, successFeedback } from "../../services/haptics";
import {
  addProvider,
  deleteProvider,
  listProviders,
  testProvider,
  type UserProvider,
} from "../../services/providerService";
import { relativeTime } from "../../services/formatting";

/** You.com's Agents API host. The backend recognises keys saved against it. */
const YOUCOM_ENDPOINT = "https://api.you.com";

export const ProvidersScreen = () => {
  const { colors } = useTheme();

  const [providers, setProviders] = useState<UserProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProviders(await listProviders());
    } catch (e: any) {
      notify("Could not load providers", e?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const canSave = !!(label.trim() && baseUrl.trim() && apiKey.trim()) && !saving;

  const handleAdd = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await addProvider({ label, baseUrl, apiKey, model });
      successFeedback();
      // Clear the key first: it must not sit in state longer than it has to.
      setApiKey("");
      setLabel("");
      setBaseUrl("");
      setModel("");
      await load();
    } catch (e: any) {
      errorFeedback();
      notify("Could not add that provider", e?.message ?? "Please check the details.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (provider: UserProvider) => {
    setBusyId(provider.id);
    try {
      const result = await testProvider(provider.id);
      if (result.ok) successFeedback();
      else errorFeedback();
      notify(result.ok ? "Working" : "That provider refused", result.ok ? `${provider.label} answered.` : result.detail);
      await load();
    } catch (e: any) {
      notify("Test failed", e?.message ?? "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (provider: UserProvider) => {
    const confirmed = await confirmAction(
      `Remove ${provider.label}?`,
      "The stored key is deleted. Runs go back to the built-in provider.",
      { destructive: true, confirmLabel: "Remove" },
    );
    if (!confirmed) return;
    setBusyId(provider.id);
    try {
      await deleteProvider(provider.id);
      await load();
    } catch (e: any) {
      notify("Could not remove it", e?.message ?? "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScreenHeader title="Your AI providers" divider={false} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <Text variant="body" className="px-1 pt-1 pb-5" style={{ color: colors.inkSecondary, lineHeight: 22 }}>
            Add a key from any OpenAI-compatible provider and your runs use it, so the tokens are billed to you.
            The key is encrypted before it is stored and never shown again — only its last four characters.
          </Text>

          {loading ? (
            <ActivityIndicator size="small" color={colors.inkMuted} style={{ marginVertical: 16 }} />
          ) : providers.length === 0 ? (
            <Card>
              <Text variant="caption" style={{ color: colors.inkMuted, lineHeight: 18 }}>
                No providers yet. Runs use the built-in one.
              </Text>
            </Card>
          ) : (
            providers.map((provider) => {
              const verified = !!provider.verified_at;
              return (
                <Card key={provider.id} className="mb-3">
                  <View className="flex-row items-center">
                    <Text variant="body" className="font-uiMedium flex-1 mr-2" numberOfLines={1}>{provider.label}</Text>
                    <Pill tone={verified ? "success" : "warning"}>{verified ? "Working" : "Unverified"}</Pill>
                  </View>

                  <Text variant="caption" className="mt-1.5" style={{ color: colors.inkSecondary }} numberOfLines={1}>
                    {provider.base_url}
                  </Text>
                  <Text variant="caption" className="mt-0.5" style={{ color: colors.inkMuted }} numberOfLines={1}>
                    {provider.model ? `${provider.model} · ` : ""}key ····{provider.key_last4}
                  </Text>
                  <Text variant="caption" className="mt-0.5" style={{ color: verified ? colors.inkMuted : colors.warning, lineHeight: 16 }}>
                    {verified ? `Last worked ${relativeTime(provider.verified_at!)}` : provider.last_error ?? "Never verified"}
                  </Text>

                  <View className="flex-row mt-3">
                    <Button
                      label="Test"
                      tone="neutral"
                      size="sm"
                      loading={busyId === provider.id}
                      disabled={busyId !== null}
                      onPress={() => void handleTest(provider)}
                    />
                    <View style={{ width: 8 }} />
                    <Button
                      label="Remove"
                      tone="ghost"
                      size="sm"
                      disabled={busyId !== null}
                      onPress={() => void handleDelete(provider)}
                    />
                  </View>
                </Card>
              );
            })
          )}

          <SectionTitle hint="Any OpenAI-compatible endpoint, or a You.com key.">Add a provider</SectionTitle>
          {/* You.com speaks its own API, not OpenAI's, so its endpoint is not one
              people would guess. One tap fills it in. */}
          <View className="px-1 mb-4" style={{ gap: 8 }}>
            <Button
              label="Use a You.com key"
              icon="globe"
              tone="neutral"
              size="sm"
              onPress={() => { setLabel("You.com"); setBaseUrl(YOUCOM_ENDPOINT); setModel(""); }}
            />
            <Text variant="caption" style={{ color: colors.inkMuted, lineHeight: 18 }}>
              A You.com key (ydc-sk-…) answers your Chat with live web search and sources. Build keeps using an
              OpenAI-compatible model, since You.com's agents cannot run tools.
            </Text>
          </View>
          <View className="px-1">
            <Input label="Name" value={label} onChangeText={setLabel} placeholder="My OpenRouter key" />
            <Input
              label="Endpoint"
              hint="The base URL, usually ending in /v1"
              value={baseUrl}
              onChangeText={setBaseUrl}
              placeholder="https://openrouter.ai/api/v1"
              keyboardType="url"
            />
            <Input
              label="API key"
              value={apiKey}
              onChangeText={(value) => {
                setApiKey(value);
                // A pasted You.com key needs You.com's endpoint; fill it in if
                // nothing else has been typed there.
                if (value.trim().startsWith("ydc-sk-") && !baseUrl.trim()) {
                  setBaseUrl(YOUCOM_ENDPOINT);
                  if (!label.trim()) setLabel("You.com");
                }
              }}
              placeholder="sk-… or ydc-sk-…"
              secureTextEntry
            />
            <Input
              label="Default model"
              hint="Optional"
              value={model}
              onChangeText={setModel}
              placeholder="anthropic/claude-sonnet-4"
            />
            <Button label="Check and save" block loading={saving} disabled={!canSave} onPress={() => void handleAdd()} />
            <Text variant="caption" className="mt-4" style={{ color: colors.inkMuted, lineHeight: 18 }}>
              Saving makes one small test call, so a wrong key or endpoint is caught now. Builds still count
              against your limit — the key covers the model, not the machine it runs on.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
