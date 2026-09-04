/**
 * frontend/src/screens/files/FileTreeScreen.tsx
 * ---------------------------------------------------------------------------
 * The project's files, as they sit in the sandbox.
 *
 * The header had Refresh on the left, the title in the middle and "← Back" on
 * the right — back on the side every other screen puts the primary action.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, ScrollView, ActivityIndicator, SafeAreaView } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { FileTreeItem } from "../../components/FileTreeItem";
import { TextPromptModal } from "../../components/TextPromptModal";
import { Card } from "../../components/ui/Card";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import { useFileTree } from "../../hooks/useFileTree";
import { useFileActions } from "../../hooks/useFileActions";
import { type ProjectStackParamList } from "../../navigation/types";

type RouteProps = RouteProp<ProjectStackParamList, "FileTree">;

export const FileTreeScreen = () => {
  const { colors } = useTheme();
  const route = useRoute<RouteProps>();
  const { projectId } = route.params;

  const { tree, isLoading, refresh, toggleFolder, expandedFolders } = useFileTree(projectId);
  const fileActions = useFileActions(projectId, refresh);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScreenHeader
        title="Files"
        subtitle={isLoading ? undefined : `${tree.length} at the top level`}
        divider={false}
        action={{ icon: "rotate-ccw", onPress: refresh }}
      />

      {isLoading ? (
        <ActivityIndicator size="small" color={colors.inkMuted} style={{ marginTop: 32 }} />
      ) : tree.length === 0 ? (
        <View className="px-4 pt-2">
          <Card>
            <Text variant="caption" style={{ color: colors.inkMuted, lineHeight: 18 }}>
              This project has no files yet.
            </Text>
          </Card>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Card flush className="mt-2">
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
        </ScrollView>
      )}

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
