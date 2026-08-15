/**
 * frontend/src/screens/search/GlobalSearchScreen.tsx
 * ---------------------------------------------------------------------------
 * Global search workspace screen:
 *   - Auto-focuses query input.
 *   - Lists matching results filtered by category: Projects, Chats, or Files.
 *   - Displays recent search logs.
 *   - EmptyState preset hook if nothing found.
 * ---------------------------------------------------------------------------
 */

import React, { useState, useEffect } from "react";
import { View, TextInput, ScrollView, TouchableOpacity, FlatList, SafeAreaView } from "react-native";
import { Icon } from "../../components/Icon";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { EmptyState } from "../../components/EmptyState";
import { useTheme } from "../../theme/ThemeProvider";
import { useProjects } from "../../hooks/useProjects";
import { type ProjectNavigationProp } from "../../navigation/types";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: "projects" | "chats" | "files";
  targetId: string;
}

export const GlobalSearchScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<ProjectNavigationProp>();
  const { projects } = useProjects();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([
    "Payment Service",
    "Sandbox Shell Test",
  ]);

  // Handle query changes and search matching items
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matches: SearchResult[] = [];

    // Search Projects
    projects.forEach((p) => {
      if (p.name.toLowerCase().includes(lowerQuery) || p.description?.toLowerCase().includes(lowerQuery)) {
        matches.push({
          id: p.id,
          title: p.name,
          subtitle: p.description || "Active Project",
          category: "projects",
          targetId: p.id
        });
      }
    });

    // Chat and file search need a server-side full-text endpoint, which does not
    // exist yet — inventing results here would be worse than showing none.

    setResults(matches);
  }, [query, projects]);

  const handleSelectResult = (res: SearchResult) => {
    // Add to recents
    if (!recentSearches.includes(query) && query.trim()) {
      setRecentSearches([query, ...recentSearches.slice(0, 4)]);
    }

    if (res.category === "projects" || res.category === "chats") {
      navigation.navigate("ProjectDetail", { projectId: res.targetId });
    } else {
      navigation.navigate("ProjectDetail", { projectId: res.targetId });
    }
  };

  const handleSelectRecent = (q: string) => {
    setQuery(q);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      
      {/* Top Search bar */}
      <View 
        className="flex-row items-center px-4 py-3 border-b border-borderHairline"
        style={{ borderBottomColor: colors.borderHairline, backgroundColor: colors.canvasBase }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 mr-2">
          <Text variant="body" className="font-uiMedium">Cancel</Text>
        </TouchableOpacity>
        
        {/* Input box */}
        <View className="flex-1 bg-surfaceRaised px-3 py-1.5 rounded-pill border border-borderHairline flex-row items-center justify-between" style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}>
          <Icon name="search" size={15} color={colors.inkSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search projects, chats, and files..."
            placeholderTextColor={colors.inkSecondary}
            autoFocus
            className="flex-grow font-uiRegular text-sm text-left pl-2"
            style={{ color: colors.inkPrimary, textAlign: "left" }}
          />
        </View>
      </View>

      {/* Contents */}
      {!query.trim() ? (
        // Recent searches list
        <View className="p-6">
          <Text variant="label" className="text-left mb-4">Recent Searches</Text>
          {recentSearches.map((q, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => handleSelectRecent(q)}
              className="py-3 border-b border-borderHairline/10 flex-row justify-between items-center"
              style={{ borderBottomColor: colors.borderHairline }}
            >
              <Text variant="body" className="opacity-90">{q}</Text>
              <Text className="opacity-40">➔</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : results.length === 0 ? (
        // EmptyState hook
        <EmptyState
          title="No Results Found"
          description={`No results found for "${query}" in your projects or files. Try searching for something else.`}
          emoji="search"
        />
      ) : (
        // Results list grouped
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const categoryIcon = item.category === "projects" ? "folder" : item.category === "chats" ? "inbox" : "file-text";
            return (
              <TouchableOpacity
                onPress={() => handleSelectResult(item)}
                className="bg-surfaceRaised p-4 rounded-card border border-borderHairline mb-3 flex-row justify-between items-center"
                style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
                activeOpacity={0.8}
              >
                <View className="items-start flex-1 pl-4">
                  <Text variant="body" className="font-uiMedium text-left">
                    {item.title}
                  </Text>
                  <Text variant="caption" className="opacity-70 mt-0.5 text-left" numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>

                <Text variant="caption" className="opacity-60 text-[10px] uppercase font-uiMedium">
                  {item.category} 
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

    </SafeAreaView>
  );
};
