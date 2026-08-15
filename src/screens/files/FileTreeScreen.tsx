/**
 * frontend/src/screens/files/FileTreeScreen.tsx
 * ---------------------------------------------------------------------------
 * Screen representing the file tree explorer list of the project.
 * Uses useFileTree hook to fetch files recursively from the Sandbox.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView } from "react-native";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { FileTreeItem } from "../../components/FileTreeItem";
import { useTheme } from "../../theme/ThemeProvider";
import { useFileTree } from "../../hooks/useFileTree";
import { type ProjectStackParamList, type ProjectNavigationProp } from "../../navigation/types";

type RouteProps = RouteProp<ProjectStackParamList, "FileTree">;

export const FileTreeScreen = () => {
  const { colors } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<ProjectNavigationProp>();
  const { projectId } = route.params;

  const { tree, isLoading, refresh, toggleFolder, expandedFolders } = useFileTree(projectId);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      
      {/* Header bar */}
      <View 
        className="flex-row items-center justify-between px-6 py-4 border-b border-borderHairline"
        style={{ borderBottomColor: colors.borderHairline, backgroundColor: colors.canvasBase }}
      >
        <TouchableOpacity onPress={refresh} className="p-2 bg-surfaceRaised border border-borderHairline rounded-pill" style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}>
          <Text variant="caption" className="font-uiMedium text-[10px]">Refresh</Text>
        </TouchableOpacity>
        
        <Text variant="h3" className="font-uiSemiBold">File Explorer</Text>

        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Text variant="body" className="font-uiMedium">← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Explorer Tree */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={colors.brandPrimary} />
        </View>
      ) : tree.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text variant="caption">No files found in Sandbox.</Text>
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

    </SafeAreaView>
  );
};
