/**
 * frontend/src/screens/projects/NewProjectScreen.tsx
 * ---------------------------------------------------------------------------
 * Screen to configure and launch a new project.
 * Supports choosing templates (Blank, React Native, Next.js, Python).
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, TextInput, Alert, ScrollView, TouchableOpacity, SafeAreaView } from "react-native";
import { notify } from "../../services/notify";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { useTheme } from "../../theme/ThemeProvider";
import { useProjects } from "../../hooks/useProjects";
import { type ProjectNavigationProp } from "../../navigation/types";

interface Template {
  key: string;
  name: string;
  desc: string;
  emoji: string;
}

export const NewProjectScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<ProjectNavigationProp>();
  const { createProject } = useProjects();

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [activeTemplate, setActiveTemplate] = useState("landing");
  const [creating, setCreating] = useState(false);

  // Must mirror supabase/functions/shared/templates.ts — anything else is
  // rejected by projects-create with UNKNOWN_TEMPLATE.
  const templates: Template[] = [
    { key: "landing", name: "Landing Page", desc: "Hero, features and a call to action", emoji: "🚀" },
    { key: "todo", name: "Todo App", desc: "Task list saved in the browser", emoji: "✅" },
    { key: "gallery", name: "Photo Gallery", desc: "Responsive grid with a lightbox", emoji: "🖼️" },
    { key: "blog", name: "Blog", desc: "Post list and reading view", emoji: "📝" },
    { key: "quiz", name: "Quiz App", desc: "Multiple-choice quiz with scoring", emoji: "🧠" },
    { key: "blank", name: "Blank Project", desc: "Empty workspace — the agent starts from scratch", emoji: "📁" },
  ];

  const handleCreate = async () => {
    if (!name.trim()) {
      notify("Error", "Please enter a project name.");
      return;
    }

    setCreating(true);
    try {
      const created = await createProject({
        name: name.trim(),
        description: desc.trim() || undefined,
        template: activeTemplate,
      });
      // Navigate straight to the detail page
      navigation.replace("ProjectDetail", { projectId: created.id });
    } catch (e: any) {
      notify("Error creating project", e.message || "Operation failed.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        
        {/* Header Header */}
        <View className="mb-6 items-start">
          <Text variant="h2" className="font-uiSemiBold">
            Create New Project
          </Text>
          <Text variant="caption" className="opacity-70 mt-1">
            Configure your isolated development sandbox.
          </Text>
        </View>

        {/* Inputs */}
        <View className="space-y-4">
          <View>
            <Text variant="caption" className="mb-1.5 font-uiMedium text-left">Project Name *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Translation Telegram Bot"
              placeholderTextColor={colors.inkSecondary}
              className="w-full bg-surfaceRaised p-3.5 rounded-input border border-borderHairline font-uiRegular text-sm text-left"
              style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline, color: colors.inkPrimary }}
            />
          </View>

          <View className="mt-3">
            <Text variant="caption" className="mb-1.5 font-uiMedium text-left">Project Description</Text>
            <TextInput
              value={desc}
              onChangeText={setDesc}
              placeholder="Explain what the project does or technologies used"
              placeholderTextColor={colors.inkSecondary}
              className="w-full bg-surfaceRaised p-3.5 rounded-input border border-borderHairline font-uiRegular text-sm text-left"
              style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline, color: colors.inkPrimary }}
            />
          </View>
        </View>

        {/* Templates Selection */}
        <View className="mt-6">
          <Text variant="label" className="text-left mb-3">Project Template</Text>
          {templates.map((tpl) => {
            const isSelected = activeTemplate === tpl.key;
            return (
              <TouchableOpacity
                key={tpl.key}
                onPress={() => setActiveTemplate(tpl.key)}
                className="flex-row items-center p-4 bg-surfaceRaised rounded-card border mb-3"
                style={{ 
                  backgroundColor: colors.surfaceRaised, 
                  borderColor: isSelected ? colors.brandPrimary : colors.borderHairline,
                  borderWidth: isSelected ? 2 : 1
                }}
                activeOpacity={0.8}
              >
                {/* Selector indicator */}
                <View 
                  className="w-4 h-4 rounded-full border items-center justify-center mr-3"
                  style={{ borderColor: isSelected ? colors.brandPrimary : colors.inkSecondary }}
                >
                  {isSelected && (
                    <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.brandPrimary }} />
                  )}
                </View>

                {/* Details */}
                <View className="flex-1 items-start">
                  <Text variant="body" className="font-uiMedium text-left">
                    {tpl.emoji} {tpl.name}
                  </Text>
                  <Text variant="caption" className="opacity-70 mt-0.5 text-left">
                    {tpl.desc}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Buttons */}
        <View className="space-y-3 mt-6">
          <Button
            label="Create & Launch Sandbox"
            onPress={handleCreate}
            loading={creating}
            className="w-full"
          />

          <Button
            label="Cancel"
            variant="secondary"
            onPress={() => navigation.goBack()}
            className="w-full"
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};
