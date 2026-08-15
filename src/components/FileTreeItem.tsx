/**
 * frontend/src/components/FileTreeItem.tsx
 * ---------------------------------------------------------------------------
 * One node of the file explorer. Folders expand, files open in the viewer, and
 * a long press offers rename and delete.
 *
 * Expansion state is passed down as the whole set rather than a boolean:
 * children used to be rendered with `isExpanded={false}` hardcoded, so a folder
 * inside a folder could never be opened no matter what the hook recorded.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, TouchableOpacity, Alert } from "react-native";
import { Icon } from "../components/Icon";
import { useNavigation } from "@react-navigation/native";
import { Text } from "./Typography";
import { useTheme } from "../theme/ThemeProvider";
import { type FileNode } from "../hooks/useFileTree";
import { type ProjectNavigationProp } from "../navigation/types";

interface FileTreeItemProps {
  node: FileNode;
  projectId: string;
  expandedFolders: Set<string>;
  onToggle: (path: string) => void;
  /** Omitted when the tree is read-only. */
  onRename?: (node: FileNode) => void;
  onDelete?: (node: FileNode) => void;
  level?: number;
}

/** Monochrome lucide names — the icon map has no emoji. */
function iconFor(node: FileNode, isExpanded: boolean): string {
  if (node.isDir) return isExpanded ? "chevron-down" : "chevron-right";
  switch (node.name.split(".").pop()?.toLowerCase()) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "code";
    case "json":
      return "settings";
    case "css":
      return "type";
    case "html":
    case "htm":
      return "globe";
    case "svg":
    case "png":
    case "jpg":
    case "jpeg":
      return "image";
    default:
      return "file-text";
  }
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  projectId,
  expandedFolders,
  onToggle,
  onRename,
  onDelete,
  level = 0,
}) => {
  const { colors } = useTheme();
  const navigation = useNavigation<ProjectNavigationProp>();

  const isDir = node.isDir;
  const isExpanded = expandedFolders.has(node.path);

  const handlePress = () => {
    if (isDir) onToggle(node.path);
    else navigation.navigate("FileViewer", { projectId, filePath: node.path });
  };

  const handleLongPress = () => {
    // Folders are not objects in Storage, only prefixes, so there is nothing to
    // rename or delete for them.
    if (isDir || (!onRename && !onDelete)) return;
    const actions: Array<{ text: string; style?: "cancel" | "destructive"; onPress?: () => void }> = [
      { text: "Cancel", style: "cancel" },
    ];
    if (onRename) actions.push({ text: "Rename", onPress: () => onRename(node) });
    if (onDelete) actions.push({ text: "Delete", style: "destructive", onPress: () => onDelete(node) });
    Alert.alert(node.name, "What would you like to do with this file?", actions);
  };

  return (
    <View>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.7}
        className="flex-row items-center py-2.5 px-4 border-b border-borderHairline/10"
        style={{
          paddingLeft: 16 + level * 16, // Indent nested folder levels
          borderBottomColor: colors.borderHairline,
        }}
      >
        <View className="mr-2.5">
          <Icon name={iconFor(node, isExpanded)} size={15} color={isDir ? "#F59E0B" : colors.inkSecondary} />
        </View>
        <Text variant="body" className="flex-1 text-left font-uiRegular text-sm" numberOfLines={1}>
          {node.name}
        </Text>
      </TouchableOpacity>

      {/* Recursive children list */}
      {isDir && isExpanded && node.children && (
        <View>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              projectId={projectId}
              expandedFolders={expandedFolders}
              onToggle={onToggle}
              onRename={onRename}
              onDelete={onDelete}
              level={level + 1}
            />
          ))}
        </View>
      )}
    </View>
  );
};
