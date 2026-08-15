/**
 * frontend/src/screens/projects/ProjectSettingsScreen.tsx
 * ---------------------------------------------------------------------------
 * Project Settings Screen:
 *   - Edit project metadata (name, description).
 *   - Delete project (with name confirmation verification).
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, TextInput, Alert, ScrollView, TouchableOpacity, SafeAreaView } from "react-native";
import { notify } from "../../services/notify";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { useTheme } from "../../theme/ThemeProvider";
import { useProjects } from "../../hooks/useProjects";
import { type ProjectStackParamList, type ProjectNavigationProp } from "../../navigation/types";

type RouteProps = RouteProp<ProjectStackParamList, "ProjectSettings">;

export const ProjectSettingsScreen = () => {
  const { colors } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<ProjectNavigationProp>();
  const { projectId } = route.params;

  const { projects, updateProject, deleteProject } = useProjects();
  const project = projects.find((p) => p.id === projectId);

  const [name, setName] = useState(project?.name || "");
  const [desc, setDesc] = useState(project?.description || "");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      notify("Error", "Project name cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      await updateProject({
        id: projectId,
        updates: { name, description: desc },
      });
      notify("Success", "Project settings updated successfully.");
      navigation.goBack();
    } catch (e: any) {
      notify("Error", e.message || "An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== project?.name) {
      notify("Error", "To confirm deletion, please type the project name exactly.");
      return;
    }

    setDeleting(true);
    try {
      await deleteProject(projectId);
      notify("Deleted successfully", "Project and its sandbox were successfully deleted.");
      navigation.popToTop(); // Go back to Project list screen
    } catch (e: any) {
      notify("Delete Error", e.message || "Failed to delete project.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        
        {/* Header */}
        <View className="mb-6 items-start">
          <Text variant="h2" className="font-uiSemiBold">
            Project Settings
          </Text>
        </View>

        {/* Metadata section */}
        <View className="space-y-4 mb-6">
          <View>
            <Text variant="caption" className="mb-1.5 font-uiMedium text-left">Project Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              className="w-full bg-surfaceRaised p-3.5 rounded-input border border-borderHairline font-uiRegular text-sm text-left"
              style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline, color: colors.inkPrimary }}
            />
          </View>

          <View className="mt-3">
            <Text variant="caption" className="mb-1.5 font-uiMedium text-left">Short Description</Text>
            <TextInput
              value={desc}
              onChangeText={setDesc}
              className="w-full bg-surfaceRaised p-3.5 rounded-input border border-borderHairline font-uiRegular text-sm text-left"
              style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline, color: colors.inkPrimary }}
            />
          </View>

          <Button
            label="Save Changes"
            onPress={handleSave}
            loading={saving}
            className="w-full mt-4"
          />
        </View>

        {/* Divider */}
        <View className="h-[1px] bg-borderHairline my-6" style={{ backgroundColor: colors.borderHairline }} />

        {/* Divider */}
        <View className="h-[1px] bg-borderHairline my-6" style={{ backgroundColor: colors.borderHairline }} />

        {/* Danger zone */}
        <View 
          className="p-5 rounded-card border-2"
          style={{ borderColor: `${colors.failed}30`, backgroundColor: `${colors.failed}05` }}
        >
          <Text variant="h3" className="font-uiSemiBold text-red-500 text-left mb-2" style={{ color: colors.failed }}>
            Danger Zone
          </Text>
          
          <Text variant="caption" className="text-left mb-2 opacity-90">
            To delete completely, type the exact project name ({project?.name}):
          </Text>
          <TextInput
            value={deleteConfirmText}
            onChangeText={setDeleteConfirmText}
            placeholder="Type project name..."
            placeholderTextColor={colors.inkSecondary}
            className="w-full bg-surfaceRaised p-3 rounded-input border border-borderHairline font-uiRegular text-sm text-left mb-4"
            style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline, color: colors.inkPrimary }}
          />
          <Button
            label="Delete Project"
            onPress={handleDelete}
            loading={deleting}
            className="w-full bg-red-600"
            style={{ backgroundColor: colors.failed }}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};
