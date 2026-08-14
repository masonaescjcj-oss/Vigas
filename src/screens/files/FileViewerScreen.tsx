/**
 * frontend/src/screens/files/FileViewerScreen.tsx
 * ---------------------------------------------------------------------------
 * Screen to view and edit file contents:
 *   - Fetches content from Supabase Storage.
 *   - Allows manual editing and syncing back to Sandbox.
 *   - Diff Viewer showing added (green) and removed (red) lines when changes occur.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { View, TextInput, ScrollView, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator } from "react-native";
import { notify } from "../../services/notify";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { useTheme } from "../../theme/ThemeProvider";
import { supabase } from "../../services/supabase";
import { type ProjectStackParamList } from "../../navigation/types";

type RouteProps = RouteProp<ProjectStackParamList, "FileViewer">;

export const FileViewerScreen = () => {
  const { colors } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const { projectId, filePath } = route.params;

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileTitle = filePath.split("/").pop() || "File";

  useEffect(() => {
    const fetchFileContent = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from("project-files")
          .download(filePath);

        if (error) throw error;
        
        const text = await data.text();
        setContent(text);
        setEditedContent(text);
      } catch (e: any) {
        notify("Load Error", e.message || "Failed to read file.");
      } finally {
        setLoading(false);
      }
    };
    void fetchFileContent();
  }, [filePath]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const blob = new Blob([editedContent], { type: "text/plain" } as unknown as BlobOptions);
      const { error } = await supabase.storage
        .from("project-files")
        .upload(filePath, blob, { upsert: true });

      if (error) throw error;
      
      setContent(editedContent);
      setIsEditing(false);
      notify("Saved Successfully", "Changes sent to Sandbox.");
    } catch (e: any) {
      notify("Save Error", e.message || "Failed to save file.");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Unsaved-changes diff: compares the buffer being edited against the version
   * loaded from Storage. (A checkpoint-to-checkpoint diff needs a backend
   * endpoint that does not exist yet.)
   */
  const renderDiffLines = () => {
    const originalLines = content.split("\n");
    const editedLines = editedContent.split("\n");
    const max = Math.max(originalLines.length, editedLines.length);
    const rows: React.ReactNode[] = [];

    for (let i = 0; i < max; i += 1) {
      const before = originalLines[i];
      const after = editedLines[i];
      if (before === after) {
        if (before !== undefined) {
          rows.push(
            <View key={`ctx-${i}`} className="px-2 py-0.5">
              <Text variant="code" className="text-xs">{before}</Text>
            </View>,
          );
        }
        continue;
      }
      if (before !== undefined) {
        rows.push(
          <View key={`del-${i}`} className="px-2 py-0.5 border-l-2" style={{ backgroundColor: `${colors.failed}15`, borderLeftColor: colors.failed }}>
            <Text variant="code" className="text-xs" style={{ color: colors.failed }}>- {before}</Text>
          </View>,
        );
      }
      if (after !== undefined) {
        rows.push(
          <View key={`add-${i}`} className="px-2 py-0.5 border-l-2" style={{ backgroundColor: `${colors.success}15`, borderLeftColor: colors.success }}>
            <Text variant="code" className="text-xs" style={{ color: colors.success }}>+ {after}</Text>
          </View>,
        );
      }
    }

    if (rows.length === 0 || content === editedContent) {
      return (
        <View className="py-8 items-center">
          <Text variant="caption" className="opacity-70">No unsaved changes.</Text>
        </View>
      );
    }
    return rows;
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      
      {/* Header bar */}
      <View 
        className="flex-row items-center justify-between px-6 py-4 border-b border-borderHairline"
        style={{ borderBottomColor: colors.borderHairline, backgroundColor: colors.canvasBase }}
      >
        <View className="flex-row space-x-2">
          {isEditing ? (
            <TouchableOpacity onPress={handleSave} className="p-2 bg-brandPrimary/10 border border-brandPrimary/20 rounded-pill mr-2" style={{ backgroundColor: `${colors.brandPrimary}15`, borderColor: `${colors.brandPrimary}30` }}>
              {saving ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Text variant="caption" className="font-uiMedium text-[10px] text-brandPrimary" style={{ color: colors.brandPrimary }}>Save 💾</Text>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setIsEditing(true)} className="p-2 bg-surfaceRaised border border-borderHairline rounded-pill mr-2" style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}>
              <Text variant="caption" className="font-uiMedium text-[10px]">Edit ✏️</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => setShowDiff(!showDiff)} className="p-2 bg-surfaceRaised border border-borderHairline rounded-pill ml-2" style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}>
            <Text variant="caption" className="font-uiMedium text-[10px]">{showDiff ? "Viewer 📄" : "Diff 🔄"}</Text>
          </TouchableOpacity>
        </View>

        <Text variant="h3" className="font-uiSemiBold">{fileTitle}</Text>

        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Text variant="body" className="font-uiMedium">← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Main content body */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={colors.brandPrimary} />
        </View>
      ) : showDiff ? (
        <ScrollView className="flex-1 p-4 bg-surfaceCode" style={{ backgroundColor: colors.surfaceCode }}>
          {renderDiffLines()}
        </ScrollView>
      ) : isEditing ? (
        <View className="flex-1 p-4 bg-surfaceCode" style={{ backgroundColor: colors.surfaceCode }}>
          <TextInput
            value={editedContent}
            onChangeText={setEditedContent}
            multiline
            className="flex-grow font-mono text-xs text-left"
            style={{ color: colors.inkPrimary, textAlignVertical: "top" }}
          />
        </View>
      ) : (
        <ScrollView className="flex-1 p-4 bg-surfaceCode" style={{ backgroundColor: colors.surfaceCode }}>
          <Text variant="code" className="text-xs">
            {content || "File is empty."}
          </Text>
        </ScrollView>
      )}

    </SafeAreaView>
  );
};
