/**
 * frontend/src/screens/search/GlobalSearchScreen.tsx
 * ---------------------------------------------------------------------------
 * Search across projects and chats.
 *
 * Projects match locally; chats are matched server-side by title, scoped to
 * the caller by RLS. File contents are not searched — that needs a full-text
 * index, and downloading every project to grep it on the phone is not that.
 * Recent searches persist on the device.
 *
 * The field is the whole header now, with the focus ring the rest of the app
 * uses, and results are rows in two labelled groups rather than a flat list of
 * cards each ending in an uppercase category word.
 * ---------------------------------------------------------------------------
 */

import React, { useState, useEffect } from "react";
import { View, TextInput, ScrollView, TouchableOpacity, SafeAreaView } from "react-native";
import { Icon } from "../../components/Icon";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Card } from "../../components/ui/Card";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { useTheme } from "../../theme/ThemeProvider";
import { directionStyleFor } from "../../theme/direction";
import { selectionFeedback } from "../../services/haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useProjects } from "../../hooks/useProjects";
import { agentService } from "../../services/agentService";
import { relativeTime } from "../../services/formatting";
import { type ProjectNavigationProp } from "../../navigation/types";

const RECENTS_KEY = "retrocode.recentSearches";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: "projects" | "chats";
  targetId: string;
}

export const GlobalSearchScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<ProjectNavigationProp>();
  const { projects } = useProjects();

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  // Seeded with two invented phrases before; recents are the user's own now,
  // and survive a restart.
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    void AsyncStorage.getItem(RECENTS_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setRecentSearches(parsed.filter((q) => typeof q === "string"));
      } catch { /* a corrupt entry is not worth surfacing */ }
    });
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const lowerQuery = query.toLowerCase();
    const matches: SearchResult[] = [];
    projects.forEach((p) => {
      if (p.name.toLowerCase().includes(lowerQuery) || p.description?.toLowerCase().includes(lowerQuery)) {
        matches.push({
          id: p.id,
          title: p.name,
          subtitle: p.description || "Project",
          category: "projects",
          targetId: p.id,
        });
      }
    });
    setResults(matches);
  }, [query, projects]);

  // Chats are searched server-side by title, scoped to the caller by RLS.
  useEffect(() => {
    const term = query.trim();
    if (!term) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const sessions = await agentService.searchSessionsByTitle(term);
        if (cancelled) return;
        setResults((prev) => [
          ...prev.filter((r) => r.category !== "chats"),
          ...sessions.map((s) => ({
            id: `chat_${s.id}`,
            title: s.title || "Untitled chat",
            subtitle: relativeTime(s.updated_at),
            category: "chats" as const,
            targetId: s.project_id,
          })),
        ]);
      } catch { /* the project matches above still stand */ }
    }, 250); // debounce: this runs on every keystroke
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const handleSelectResult = (res: SearchResult) => {
    const term = query.trim();
    if (term && !recentSearches.includes(term)) {
      const next = [term, ...recentSearches].slice(0, 5);
      setRecentSearches(next);
      void AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    }
    // Both kinds resolve to a project; a chat result carries its project id.
    navigation.navigate("ProjectDetail", { projectId: res.targetId });
  };

  const projectHits = results.filter((r) => r.category === "projects");
  const chatHits = results.filter((r) => r.category === "chats");

  const group = (title: string, items: SearchResult[], icon: string, first?: boolean) =>
    items.length === 0 ? null : (
      <View>
        <SectionTitle first={first}>{title}</SectionTitle>
        <Card flush>
          {items.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => handleSelectResult(item)}
              className="flex-row items-center px-4 py-3"
              style={{
                borderBottomWidth: index === items.length - 1 ? 0 : 1,
                borderBottomColor: colors.borderHairline,
              }}
              activeOpacity={0.6}
            >
              <Icon name={icon} size={16} color={colors.inkSecondary} style={{ marginRight: 12 }} />
              <View className="flex-1 mr-2">
                <Text style={{ color: colors.inkPrimary, ...directionStyleFor(item.title) }} className="text-sm" numberOfLines={1}>
                  {item.title}
                </Text>
                <Text
                  variant="caption"
                  className="mt-0.5"
                  style={{ color: colors.inkMuted, ...directionStyleFor(item.subtitle) }}
                  numberOfLines={1}
                >
                  {item.subtitle}
                </Text>
              </View>
              <Icon name="chevron-right" size={14} color={colors.inkMuted} />
            </TouchableOpacity>
          ))}
        </Card>
      </View>
    );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <View className="flex-row items-center px-4" style={{ height: 60 }}>
        <View
          className="flex-1 flex-row items-center rounded-input px-3 mr-2"
          style={{
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: focused ? colors.brandPrimary : colors.borderHairline,
            minHeight: 44,
          }}
        >
          <Icon name="search" size={15} color={colors.inkMuted} style={{ marginRight: 8 }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Projects and chats"
            placeholderTextColor={colors.inkMuted}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            className="flex-1 text-sm"
            style={{ color: colors.inkPrimary, outlineStyle: "none", outlineWidth: 0 } as object}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} accessibilityLabel="Clear search" className="p-1">
              <Icon name="x" size={13} color={colors.inkSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} className="px-1 py-2" activeOpacity={0.6}>
          <Text variant="body" style={{ color: colors.brandPrimary }}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {!query.trim() ? (
          recentSearches.length === 0 ? (
            <Text variant="caption" className="px-1 pt-4" style={{ color: colors.inkMuted, lineHeight: 18 }}>
              Search matches project names, descriptions and chat titles.
            </Text>
          ) : (
            <View>
              <SectionTitle first>Recent</SectionTitle>
              <Card flush>
                {recentSearches.map((q, index) => (
                  <TouchableOpacity
                    key={q}
                    onPress={() => { selectionFeedback(); setQuery(q); }}
                    className="flex-row items-center px-4 py-3"
                    style={{
                      borderBottomWidth: index === recentSearches.length - 1 ? 0 : 1,
                      borderBottomColor: colors.borderHairline,
                    }}
                    activeOpacity={0.6}
                  >
                    <Text style={{ color: colors.inkPrimary }} className="text-sm flex-1">{q}</Text>
                    <Icon name="arrow-up" size={14} color={colors.inkMuted} style={{ transform: [{ rotate: "-45deg" }] }} />
                  </TouchableOpacity>
                ))}
              </Card>
            </View>
          )
        ) : results.length === 0 ? (
          <Text variant="caption" className="px-1 pt-6 text-center" style={{ color: colors.inkMuted, lineHeight: 18 }}>
            Nothing matches “{query}”.
          </Text>
        ) : (
          <>
            {group("Projects", projectHits, "folder", true)}
            {group("Chats", chatHits, "inbox", projectHits.length === 0)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
