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
 * ---------------------------------------------------------------------------
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { confirmAction, notify } from "../../services/notify";
import { errorFeedback, successFeedback, tapFeedback } from "../../services/haptics";
import {
  addProvider,
  deleteProvider,
  listProviders,
  testProvider,
  type UserProvider,
} from "../../services/providerService";
import { relativeTime } from "../../services/formatting";

export const ProvidersScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();

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

  const canSave = label.trim() && baseUrl.trim() && apiKey.trim() && !saving;

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

  const field = {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderHairline,
    color: colors.inkPrimary,
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <View
        className="flex-row items-center justify-between px-6 py-4 border-b"
        style={{ borderBottomColor: colors.borderHairline }}
      >
        <View className="w-16" />
        <Text variant="h3" className="font-uiSemiBold">Your AI providers</Text>
        <TouchableOpacity onPress={() => { tapFeedback(); navigation.goBack(); }} className="p-2 w-16 items-end">
          <Text variant="body" className="font-uiMedium">Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <Text variant="caption" className="text-left leading-5 mb-5" style={{ color: colors.inkSecondary }}>
          Add a key from any OpenAI-compatible provider and your runs use it, so
          the tokens are billed to you. The key is encrypted before it is stored
          and is never shown again — only the last four characters.
        </Text>

        {/* Existing providers */}
        {loading ? (
          <ActivityIndicator size="small" color={colors.brandPrimary} />
        ) : providers.length === 0 ? (
          <View
            className="p-4 rounded-2xl border mb-6"
            style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
          >
            <Text variant="caption" style={{ color: colors.inkMuted }} className="text-left leading-5">
              No providers yet. Runs use the built-in one.
            </Text>
          </View>
        ) : (
          <View className="mb-6">
            {providers.map((provider) => (
              <View
                key={provider.id}
                className="p-4 rounded-2xl border mb-3"
                style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
              >
                <View className="flex-row items-center mb-1">
                  <Icon
                    name={provider.verified_at ? "check" : "alert"}
                    size={13}
                    color={provider.verified_at ? colors.success : colors.warning}
                    style={{ marginRight: 8 }}
                  />
                  <Text variant="body" className="font-uiMedium text-left flex-1" numberOfLines={1}>
                    {provider.label}
                  </Text>
                  <Text variant="caption" style={{ color: colors.inkMuted }} className="text-[10px]">
                    ····{provider.key_last4}
                  </Text>
                </View>

                <Text variant="caption" style={{ color: colors.inkSecondary }} className="text-left text-[11px]" numberOfLines={1}>
                  {provider.base_url}
                </Text>
                {provider.model ? (
                  <Text variant="caption" style={{ color: colors.inkMuted }} className="text-left text-[11px] mt-0.5">
                    Model: {provider.model}
                  </Text>
                ) : null}

                <Text variant="caption" style={{ color: provider.verified_at ? colors.inkMuted : colors.warning }} className="text-left text-[11px] mt-1 leading-4">
                  {provider.verified_at
                    ? `Last worked ${relativeTime(provider.verified_at)}`
                    : provider.last_error ?? "Never verified"}
                </Text>

                <View className="flex-row justify-end mt-3">
                  <TouchableOpacity
                    onPress={() => handleTest(provider)}
                    disabled={busyId !== null}
                    className="px-3 py-1.5 rounded-lg mr-2"
                    style={{ backgroundColor: colors.surfaceMuted }}
                  >
                    {busyId === provider.id ? (
                      <ActivityIndicator size="small" color={colors.brandPrimary} />
                    ) : (
                      <Text variant="caption" className="text-[11px] font-uiMedium" style={{ color: colors.brandPrimary }}>
                        Test
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(provider)}
                    disabled={busyId !== null}
                    className="px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: colors.failedSoft }}
                  >
                    <Text variant="caption" className="text-[11px] font-uiMedium" style={{ color: colors.failed }}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Add a provider */}
        <Text variant="label" className="text-left mb-3">Add a provider</Text>

        <Text variant="caption" style={{ color: colors.inkMuted }} className="text-left mb-1.5 text-[11px]">Name</Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="My OpenRouter key"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
          className="rounded-xl border px-3 py-3 text-sm mb-4"
          style={field}
        />

        <Text variant="caption" style={{ color: colors.inkMuted }} className="text-left mb-1.5 text-[11px]">
          Endpoint — the base URL, usually ending in /v1
        </Text>
        <TextInput
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder="https://openrouter.ai/api/v1"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          className="rounded-xl border px-3 py-3 text-sm mb-4"
          style={field}
        />

        <Text variant="caption" style={{ color: colors.inkMuted }} className="text-left mb-1.5 text-[11px]">API key</Text>
        <TextInput
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="sk-..."
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          className="rounded-xl border px-3 py-3 text-sm mb-4"
          style={field}
        />

        <Text variant="caption" style={{ color: colors.inkMuted }} className="text-left mb-1.5 text-[11px]">
          Default model (optional)
        </Text>
        <TextInput
          value={model}
          onChangeText={setModel}
          placeholder="anthropic/claude-sonnet-4"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-xl border px-3 py-3 text-sm mb-5"
          style={field}
        />

        <TouchableOpacity
          onPress={handleAdd}
          disabled={!canSave}
          className="py-3.5 rounded-2xl items-center justify-center"
          style={{ backgroundColor: colors.brandPrimary, opacity: canSave ? 1 : 0.4 }}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.canvasBase} />
          ) : (
            <Text variant="body" className="font-uiSemiBold" style={{ color: colors.canvasBase }}>
              Check and save
            </Text>
          )}
        </TouchableOpacity>

        <Text variant="caption" style={{ color: colors.inkMuted }} className="text-left leading-5 mt-4 text-[11px]">
          Saving makes one small test call to the provider, so a wrong key or
          endpoint is caught now. Builds still count against your plan's daily
          limit — the key covers the model, not the machine it runs on.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};
