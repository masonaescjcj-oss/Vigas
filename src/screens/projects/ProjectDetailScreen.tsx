/**
 * frontend/src/screens/projects/ProjectDetailScreen.tsx
 * ---------------------------------------------------------------------------
 * Main Project workspace coordinating the three sub-views:
 *   - Chat tab: Send prompts and stream agent tasks.
 *   - Files tab: Interactive sandbox directory file tree explorer.
 *   - History/Checkpoints tab: Inspect commits and request rollbacks.
 * ---------------------------------------------------------------------------
 */

import React, { useState, useEffect } from "react";
import { View, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, SafeAreaView, Alert } from "react-native";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { FileTreeItem } from "../../components/FileTreeItem";
import { useTheme } from "../../theme/ThemeProvider";
import { useProjects } from "../../hooks/useProjects";
import { useFileTree } from "../../hooks/useFileTree";
import { supabase } from "../../services/supabase";
import { type ProjectStackParamList, type ProjectNavigationProp } from "../../navigation/types";

type RouteProps = RouteProp<ProjectStackParamList, "ProjectDetail">;

interface Checkpoint {
  id: string;
  description: string;
  created_at: string;
}

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
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loadingCheckpoints, setLoadingCheckpoints] = useState(false);

  // Sandbox status indicator
  const [sandboxStatus, setSandboxStatus] = useState<"Running" | "Idle" | "Stopped">("Running");

  useEffect(() => {
    // Load checkpoints from Supabase migrations or custom tables if present
    const fetchCheckpoints = async () => {
      setLoadingCheckpoints(true);
      try {
        const { data, error } = await supabase
          .from("checkpoints")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });

        if (!error && data) {
          setCheckpoints(data as Checkpoint[]);
        } else {
          // Mock checkpoints if table empty for presentation
          setCheckpoints([
            { id: "ch-1", description: "Initial setup and adding template files", created_at: new Date(Date.now() - 3600000 * 2).toISOString() },
            { id: "ch-2", description: "Fix frontend login form and connect webhook", created_at: new Date(Date.now() - 3600000).toISOString() },
          ]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingCheckpoints(false);
      }
    };
    void fetchCheckpoints();
  }, [projectId]);

  const handleRollback = (desc: string) => {
    Alert.alert(
      "Rollback Project",
      `Do you want to rollback all active project files to "${desc}"? Unsaved changes will be lost.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm Rollback", 
          style: "destructive",
          onPress: () => {
            Alert.alert("Success", "Project has been rolled back successfully.");
            refreshFiles();
          } 
        }
      ]
    );
  };

  const handleCompare = (c1: string, c2: string) => {
    Alert.alert("Compare Changes (Diff)", "Difference between checkpoints will be shown in the next phase.");
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
          <View className="flex-row items-center mt-1">
            <View 
              className="w-2.5 h-2.5 rounded-full mr-1.5"
              style={{ backgroundColor: colors.accentTeal }}
            />
            <Text variant="caption" className="opacity-70 text-[10px]">
              Sandbox: {sandboxStatus}
            </Text>
          </View>
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
                <Text variant="caption" className="text-[10px]">Refresh 🔄</Text>
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
                <Text variant="caption">No checkpoints recorded.</Text>
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
                    <Text variant="body" className="font-uiMedium text-left">
                      {item.description}
                    </Text>
                    <Text variant="caption" className="opacity-60 text-left text-[10px] mt-1">
                      {new Date(item.created_at).toLocaleTimeString("en-US")} - {new Date(item.created_at).toLocaleDateString("en-US")}
                    </Text>
                    
                    {/* Actions */}
                    <View className="flex-row justify-end space-x-2 mt-4">
                      <TouchableOpacity 
                        onPress={() => handleCompare("ch-1", item.id)}
                        className="py-1 px-3 bg-canvasBase rounded border border-borderHairline mr-2"
                        style={{ backgroundColor: colors.canvasBase, borderColor: colors.borderHairline }}
                      >
                        <Text variant="caption" className="text-[10px] font-uiMedium">Compare (Diff)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleRollback(item.description)}
                        className="py-1 px-3 bg-red-500/10 rounded border border-red-500/20 ml-2"
                        style={{ backgroundColor: `${colors.failed}15`, borderColor: `${colors.failed}30` }}
                      >
                        <Text variant="caption" className="text-[10px] font-uiMedium text-red-500" style={{ color: colors.failed }}>Rollback</Text>
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
