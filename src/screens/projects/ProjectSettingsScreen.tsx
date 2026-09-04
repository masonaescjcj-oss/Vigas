/**
 * frontend/src/screens/projects/ProjectSettingsScreen.tsx
 * ---------------------------------------------------------------------------
 * The project's name, its description, and the way to delete it.
 *
 * Same shape as Account settings: sections with quiet titles, the app's own
 * fields, and the destructive action last in the danger tone rather than as a
 * solid red block inside a double-bordered box. The typed-name gate stays —
 * deleting a project takes its sandbox and its files with it.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { ScrollView, SafeAreaView, KeyboardAvoidingView, Platform } from "react-native";
import { notify } from "../../services/notify";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { Button } from "../../components/Button";
import { Input } from "../../components/ui/Input";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
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
      notify("Missing name", "A project needs a name.");
      return;
    }
    setSaving(true);
    try {
      await updateProject({ id: projectId, updates: { name, description: desc } });
      notify("Saved", "The project has been updated.");
      navigation.goBack();
    } catch (e: any) {
      notify("Could not save", e.message || "An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== project?.name) {
      notify("Not deleted", "Type the project's name exactly to confirm.");
      return;
    }
    setDeleting(true);
    try {
      await deleteProject(projectId);
      notify("Deleted", "The project and its sandbox are gone.");
      navigation.popToTop();
    } catch (e: any) {
      notify("Could not delete", e.message || "Failed to delete the project.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScreenHeader title="Project settings" divider={false} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <SectionTitle first>Details</SectionTitle>
          <Input label="Name" value={name} onChangeText={setName} placeholder="Project name" autoCapitalize="sentences" />
          <Input
            label="Description"
            hint="Optional — a line about what this is"
            value={desc}
            onChangeText={setDesc}
            placeholder="A coffee roastery landing page"
            autoCapitalize="sentences"
          />
          <Button label="Save" size="sm" tone="neutral" loading={saving} disabled={!name.trim()} onPress={() => void handleSave()} />

          <SectionTitle hint="The project, its chats, its restore points and its sandbox files are erased and cannot be recovered.">
            Delete project
          </SectionTitle>
          <Input
            value={deleteConfirmText}
            onChangeText={setDeleteConfirmText}
            placeholder={`Type “${project?.name ?? "the name"}” to confirm`}
          />
          <Button
            label="Delete this project"
            tone="danger"
            block
            loading={deleting}
            disabled={!project || deleteConfirmText !== project.name}
            onPress={() => void handleDelete()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
