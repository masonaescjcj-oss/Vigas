/**
 * frontend/src/screens/projects/ProjectDetailScreen.tsx
 * ---------------------------------------------------------------------------
 * One project: how big it is, what is in it, and the ways on from here.
 *
 * It was three tabs — Chat, Files, History — where "Chat" was an empty pane
 * holding a single button, and "History" duplicated the Restore points screen
 * that already exists one route away. Tabs are for views you switch between
 * often; these were three destinations wearing a tab bar.
 *
 * So: the two numbers worth knowing, a group of rows that go somewhere, and
 * the file tree underneath — the thing you actually came to look at.
 * ---------------------------------------------------------------------------
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, SafeAreaView } from "react-native";
import { notify } from "../../services/notify";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { FileTreeItem } from "../../components/FileTreeItem";
import { TextPromptModal } from "../../components/TextPromptModal";
import { Card } from "../../components/ui/Card";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { SettingsRow } from "../../components/SettingsRow";
import { useTheme } from "../../theme/ThemeProvider";
import { useProjects } from "../../hooks/useProjects";
import { useFileTree } from "../../hooks/useFileTree";
import { useFileActions } from "../../hooks/useFileActions";
import { getProjectCheckpoints, type CheckpointRow } from "../../services/checkpointService";
import { type ProjectStackParamList, type ProjectNavigationProp } from "../../navigation/types";

type RouteProps = RouteProp<ProjectStackParamList, "ProjectDetail">;

/** One number and what it counts. */
const Stat = ({ value, label }: { value: string; label: string }) => {
  const { colors } = useTheme();
  return (
    <Card className="flex-1">
      <Text style={{ color: colors.inkPrimary, fontSize: 22, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      <Text variant="caption" style={{ color: colors.inkMuted }}>{label}</Text>
    </Card>
  );
};

export const ProjectDetailScreen = () => {
  const { colors } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<ProjectNavigationProp>();
  const { projectId } = route.params;

  const { projects } = useProjects();
  const project = projects.find((p) => p.id === projectId);

  const { tree, isLoading: loadingFiles, refresh: refreshFiles, toggleFolder, expandedFolders } = useFileTree(projectId);
  const fileActions = useFileActions(projectId, refreshFiles);

  // Only the count is shown here; rolling back lives on its own screen, which
  // is where the confirmation and the explanation already are.
  const [checkpoints, setCheckpoints] = useState<CheckpointRow[]>([]);

  const loadCheckpoints = useCallback(async () => {
    try {
      setCheckpoints(await getProjectCheckpoints(projectId));
    } catch (e: any) {
      setCheckpoints([]);
      notify("Could not load restore points", e?.message ?? "Please try again.");
    }
  }, [projectId]);

  useEffect(() => { void loadCheckpoints(); }, [loadCheckpoints]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScreenHeader
        title={project?.name || "Project"}
        subtitle={project?.description || undefined}
        divider={false}
        action={{ icon: "settings", onPress: () => navigation.navigate("ProjectSettings", { projectId }) }}
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <View className="flex-row mt-2" style={{ gap: 10 }}>
          <Stat value={loadingFiles ? "—" : String(tree.length)} label={tree.length === 1 ? "file" : "files"} />
          <Stat value={String(checkpoints.length)} label={checkpoints.length === 1 ? "restore point" : "restore points"} />
        </View>

        <Card flush className="mt-4">
          <SettingsRow label="Open chat" icon="search" hint="Build and ask in this project" onPress={() => navigation.navigate("AgentChat", { projectId })} />
          <SettingsRow label="Chat history" icon="inbox" onPress={() => navigation.navigate("SessionHistory", { projectId })} />
          <SettingsRow label="Restore points" icon="rotate-ccw" onPress={() => navigation.navigate("CheckpointList", { projectId })} last />
        </Card>

        <SectionTitle hint={loadingFiles ? undefined : "Tap a file to open it"}>Files</SectionTitle>
        {loadingFiles ? (
          <ActivityIndicator size="small" color={colors.inkMuted} style={{ marginVertical: 24 }} />
        ) : tree.length === 0 ? (
          <Card>
            <Text variant="caption" style={{ color: colors.inkMuted, lineHeight: 18 }}>
              Nothing here yet. Open the chat and ask for something to be built.
            </Text>
          </Card>
        ) : (
          <Card flush>
            {tree.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                projectId={projectId}
                expandedFolders={expandedFolders}
                onToggle={toggleFolder}
                onRename={fileActions.requestRename}
                onDelete={fileActions.requestDelete}
              />
            ))}
          </Card>
        )}
      </ScrollView>

      <TextPromptModal
        visible={fileActions.renaming !== null}
        title="Rename file"
        description="The file keeps its folder — this is just the name."
        initialValue={fileActions.renaming?.name ?? ""}
        confirmLabel="Rename"
        onCancel={fileActions.cancelRename}
        onConfirm={fileActions.confirmRename}
      />
    </SafeAreaView>
  );
};
