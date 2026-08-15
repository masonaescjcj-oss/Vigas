/**
 * frontend/src/components/FileTreeItem.tsx
 * ---------------------------------------------------------------------------
 * Renders a single node (file or directory) in the file explorer tree.
 * Folders can be expanded/collapsed. Clicking a file navigates to the FileViewer.
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
  isExpanded: boolean;
  onToggle: (path: string) => void;
  level?: number;
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  projectId,
  isExpanded,
  onToggle,
  level = 0,
}) => {
  const { colors } = useTheme();
  const navigation = useNavigation<ProjectNavigationProp>();

  const isDir = node.isDir;

  const handlePress = () => {
    if (isDir) {
      onToggle(node.path);
    } else {
      // Open file in FileViewer
      navigation.navigate("FileViewer", { projectId, filePath: node.path });
    }
  };

  const handleLongPress = () => {
    Alert.alert("عملیات فایل", `مدیریت فایل/پوشه "${node.name}"`, [
      { text: "انصراف", style: "cancel" },
      { text: "تغییر نام (Rename)", onPress: () => Alert.alert("تغییر نام", "در نسخه دمو غیرفعال است.") },
      { text: "حذف (Delete)", style: "destructive", onPress: () => Alert.alert("حذف", "در نسخه دمو غیرفعال است.") },
    ]);
  };

  // Get file icon marker
  const getIcon = () => {
    if (isDir) {
      return isExpanded ? "folder" : "folder";
    }
    const ext = node.name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "ts":
      case "tsx":
      case "js":
      case "jsx":
        return "⚛️";
      case "json":
        return "⚙️";
      case "md":
        return "file-text";
      case "css":
      case "html":
        return "image";
      default:
        return "file-text";
    }
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
          borderBottomColor: colors.borderHairline 
        }}
      >
        <Text variant="body" className="mr-2.5 text-base">
          <Icon name={getIcon()} size={15} color={node.isDir ? "#F59E0B" : colors.inkSecondary} />
        </Text>
        <Text variant="body" className="flex-1 text-right font-uiRegular text-sm">
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
              isExpanded={false} // controlled locally or resolved via hook
              onToggle={onToggle}
              level={level + 1}
            />
          ))}
        </View>
      )}
    </View>
  );
};
