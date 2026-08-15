/**
 * frontend/src/screens/projects/ProjectDetailScreen.tsx
 * ---------------------------------------------------------------------------
 * Main Project workspace coordinating the three sub-views:
 *   - Chat tab: Send prompts and stream agent tasks.
 *   - Files tab: Interactive sandbox directory file tree explorer.
 *   - History tab: Restore points, and rolling the project back to one.
 * ---------------------------------------------------------------------------
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, SafeAreaView, Alert } from "react-native";
import { confirmAction, notify } from "../../services/notify";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { FileTreeItem } from "../../components/FileTreeItem";
import { useTheme } from "../../theme/ThemeProvider";
import { useProjects } from "../../hooks/useProjects";
import { useFileTree } from "../../hooks/useFileTree";
import {
  getProjectCheckpoints,
  relativeTime,
  restoreCheckpoint,
  type CheckpointRow,
} from "../../services/checkpointService";
import { type ProjectStackParamList, type ProjectNavigationProp } from "../../navigation/types";

type RouteProps = RouteProp<ProjectStackParamList, "ProjectDetail">;

export const ProjectDetailScreen = () => {
  const { colors } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<ProjectNavigationProp>();
  const { projectId } = route.params;

  const { projects } = useProjects();
  const project = projects.find((p) => p.id === projectId);

  const [activeTab, setActiveTab] = useState<"chat" | "files" | "checkpoints">("chat");

  // Load sandbox files
  const { tree, isLoading: loadingFiles, refresh: refreshFiles, toggleFolder, expandedFolders } = useFileTree(projectId);

  // Checkpoints list
  const [checkpoints, setCheckpoints] = useState<CheckpointRow[]>([]);
  const [loadingCheckpoints, setLoadingCheckpoints] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Sandbox status indicator
  // There is no live sandbox-status endpoint; sandboxes are created per job and
  // destroyed right after, so a persistent "Running" badge would be a lie.

  const loadCheckpoints = useCallback(async () => {
    setLoadingCheckpoints(true);
    try {
      setCheckpoints(await getProjectCheckpoints(projectId));
    } catch (e: any) {
      setCheckpoints([]);
      notify("Could not load restore points", e?.message ?? "Please try again.");
    } finally {
      setLoadingCheckpoints(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadCheckpoints();
  }, [loadCheckpoints]);

  /**
   * Rollback replaces the project's files. The backend snapshots the current
   * state first, so this is destructive but reversible — which is what the
   * confirmation says.
   */
  const handleRollback = async (checkpoint: CheckpointRow) => {
    if (restoringId) return;
    const when = relativeTime(checkpoint.created_at);
    const confirmed = await confirmAction(
      "Roll back the project?",
      `Every file goes back to how it was ${when}. A restore point is saved first, so you can undo this too.`,
    );
    if (!confirmed) return;

    setRestoringId(checkpoint.id);
    try {
      const result = await restoreCheckpoint(checkpoint.id);
      notify("Rolled back", `${result.files_restored} file(s) restored.`);
      await Promise.all([loadCheckpoints(), refreshFiles()]);
    } catch (e: any) {
      notify("Rollback failed", e?.message ?? "Nothing was changed.");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      
      {/* Header bar */}
      <View 
        className="flex-row items-center justify-between px-6 py-4 border-b border-borderHairline"
        style={{ borderBottomColor: colors.borderHairline, backgroundColor: colors.canvasBase }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Text variant="body" className="font-uiMedium">← Back</Text>
        </TouchableOpacity>

        {/* Title & status dot */}
        <View className="items-start">
          <Text variant="h3" className="font-uiSemiBold">
            {project?.name || "Active Project"}
          </Text>
          <Text variant="caption" className="opacity-70 text-[10px] mt-1">
            {loadingFiles ? "Loading files…" : `${tree.length} file${tree.length === 1 ? "" : "s"}`}
          </Text>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate("ProjectSettings", { projectId })} className="p-2 bg-surfaceRaised border border-borderHairline rounded-pill" style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}>
          <Text variant="caption" className="font-uiMedium text-[11px]">Settings ⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Internal Tabs Switcher */}
      <View className="flex-row border-b border-borderHairline" style={{ borderBottomColor: colors.borderHairline }}>
        {/* Checkpoints Tab */}
        <TouchableOpacity 
          onPress={() => setActiveTab("checkpoints")}
          className="flex-1 py-3 items-center"
          style={{ borderBottomWidth: activeTab === "checkpoints" ? 2 : 0, borderBottomColor: colors.brandPrimary }}
        >
          <Text variant="caption" className={activeTab === "checkpoints" ? "font-uiMedium text-brandPrimary" : "opacity-70"}>
            History
          </Text>
        </TouchableOpacity>

        {/* Files Tab */}
        <TouchableOpacity 
          onPress={() => setActiveTab("files")}
          className="flex-1 py-3 items-center"
          style={{ borderBottomWidth: activeTab === "files" ? 2 : 0, borderBottomColor: colors.brandPrimary }}
        >
          <Text variant="caption" className={activeTab === "files" ? "font-uiMedium text-brandPrimary" : "opacity-70"}>
            Files
          </Text>
        </TouchableOpacity>

        {/* Chat Tab */}
        <TouchableOpacity 
          onPress={() => setActiveTab("chat")}
          className="flex-1 py-3 items-center"
          style={{ borderBottomWidth: activeTab === "chat" ? 2 : 0, borderBottomColor: colors.brandPrimary }}
        >
          <Text variant="caption" className={activeTab === "chat" ? "font-uiMedium text-brandPrimary" : "opacity-70"}>
            Chat
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Contents */}
      <View className="flex-1">
        {activeTab === "chat" ? (
          <View className="flex-1 items-center justify-center p-6">
            <Text variant="body" className="text-center font-uiMedium mb-3">Enter the dedicated chat for this project</Text>
            <Button
              label="Open Chat"
              onPress={() => navigation.navigate("AgentChat", { projectId })}
              className="w-full"
            />
          </View>
        ) : activeTab === "files" ? (
          <View className="flex-1">
            <View className="flex-row justify-between px-6 py-2 bg-surfaceRaised border-b border-borderHairline/20" style={{ backgroundColor: colors.surfaceRaised, borderBottomColor: colors.borderHairline }}>
              <TouchableOpacity onPress={refreshFiles} className="py-1 px-3 bg-canvasBase rounded border border-borderHairline" style={{ backgroundColor: colors.canvasBase, borderColor: colors.borderHairline }}>
                <Text variant="caption" className="text-[10px]">Refresh</Text>
              </TouchableOpacity>
              <Text variant="caption" className="font-uiMedium text-[10px] self-center">Sandbox Files</Text>
            </View>

            {loadingFiles ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="small" color={colors.brandPrimary} />
              </View>
            ) : tree.length === 0 ? (
              <View className="flex-1 items-center justify-center p-6">
                <Text variant="caption">No files exist in this project.</Text>
              </View>
            ) : (
              <ScrollView className="flex-1">
                {tree.map((node) => (
                  <FileTreeItem
                    key={node.path}
                    node={node}
                    projectId={projectId}
                    isExpanded={expandedFolders.has(node.path)}
                    onToggle={toggleFolder}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        ) : (
          <View className="flex-1">
            {loadingCheckpoints ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="small" color={colors.brandPrimary} />
              </View>
            ) : checkpoints.length === 0 ? (
              <View className="flex-1 items-center justify-center p-6">
                <Text variant="caption">No restore points yet — one is saved before every run that can change files.</Text>
              </View>
            ) : (
              <FlatList
                data={checkpoints}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                  <View 
                    className="bg-surfaceRaised p-4 rounded-card border border-borderHairline mb-3"
                    style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
                  >
                    <Text variant="body" className="font-uiMedium text-left" numberOfLines={1}>
                      {item.session_title ? `Before: ${item.session_title}` : "Restore point"}
                    </Text>
                    <Text variant="caption" className="opacity-60 text-left text-[10px] mt-1">
                      {relativeTime(item.created_at)} · {item.id.slice(0, 7)}
                    </Text>

                    <View className="flex-row justify-end mt-4">
                      <TouchableOpacity
                        onPress={() => handleRollback(item)}
                        disabled={restoringId !== null}
                        className="py-1 px-3 rounded border"
                        style={{ backgroundColor: `${colors.failed}15`, borderColor: `${colors.failed}30` }}
                      >
                        {restoringId === item.id ? (
                          <ActivityIndicator size="small" color={colors.failed} />
                        ) : (
                          <Text variant="caption" className="text-[10px] font-uiMedium" style={{ color: colors.failed }}>Roll back</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        )}
      </View>

    </SafeAreaView>
  );
};
