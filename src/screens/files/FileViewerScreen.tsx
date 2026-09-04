/**
 * frontend/src/screens/files/FileViewerScreen.tsx
 * ---------------------------------------------------------------------------
 * One file: read it, edit it, see what you changed.
 *
 * Reads and writes go through the project-files function. Storage is private
 * and its RLS grants the client nothing, so a direct download came back denied
 * and the save was silently rejected — this screen could not open a file, let
 * alone save one.
 *
 * The header held three pill buttons on the left ("Edit ✏️", "Diff", Save),
 * the file name in the middle and "← Back" on the right. Now: back and the
 * file name where every screen puts them, one primary action, and the Diff
 * toggle appearing only once there is a difference to look at.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { View, TextInput, ScrollView, SafeAreaView, ActivityIndicator } from "react-native";
import { notify } from "../../services/notify";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import { MONO_FAMILY } from "../../theme/mono";
import { getProjectFiles, writeProjectFile } from "../../services/fileService";
import { type ProjectStackParamList } from "../../navigation/types";

type RouteProps = RouteProp<ProjectStackParamList, "FileViewer">;

export const FileViewerScreen = () => {
  const { colors } = useTheme();
  const route = useRoute<RouteProps>();
  const { projectId, filePath } = route.params;

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileName = filePath.split("/").pop() || "File";
  const folder = filePath.split("/").slice(0, -1).join("/");
  const dirty = editedContent !== content;

  useEffect(() => {
    let cancelled = false;
    const fetchFileContent = async () => {
      setLoading(true);
      try {
        const files = await getProjectFiles(projectId);
        const text = files[filePath];
        if (cancelled) return;
        if (text === undefined) {
          notify("Cannot open this file", `${filePath} is not a text file this editor can show.`);
          return;
        }
        setContent(text);
        setEditedContent(text);
      } catch (e: any) {
        if (!cancelled) notify("Could not open the file", e.message || "Failed to read it.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchFileContent();
    return () => { cancelled = true; };
  }, [projectId, filePath]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await writeProjectFile(projectId, filePath, editedContent);
      setContent(editedContent);
      setIsEditing(false);
      setShowDiff(false);
      notify("Saved", "The file was updated in your project.");
    } catch (e: any) {
      notify("Could not save", e.message || "Failed to save the file.");
    } finally {
      setSaving(false);
    }
  };

  const code = { fontFamily: MONO_FAMILY, fontSize: 12, lineHeight: 19 };

  /**
   * Unsaved-changes diff: the buffer being edited against the version loaded
   * from Storage. (A checkpoint-to-checkpoint diff needs a backend endpoint
   * that does not exist yet.)
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
            <Text key={`ctx-${i}`} style={{ ...code, color: colors.inkSecondary, paddingHorizontal: 12 }}>
              {"  "}{before}
            </Text>,
          );
        }
        continue;
      }
      if (before !== undefined) {
        rows.push(
          <Text
            key={`del-${i}`}
            style={{ ...code, color: colors.failed, backgroundColor: colors.failedSoft, paddingHorizontal: 12 }}
          >
            {"- "}{before}
          </Text>,
        );
      }
      if (after !== undefined) {
        rows.push(
          <Text
            key={`add-${i}`}
            style={{ ...code, color: colors.success, backgroundColor: colors.successSoft, paddingHorizontal: 12 }}
          >
            {"+ "}{after}
          </Text>,
        );
      }
    }
    return rows;
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScreenHeader
        title={fileName}
        subtitle={folder || undefined}
        action={
          isEditing
            ? { label: saving ? "Saving…" : "Save", onPress: () => void handleSave() }
            : { label: "Edit", onPress: () => setIsEditing(true) }
        }
      />

      {/* Only offered once there is something to compare. */}
      {dirty ? (
        <View className="flex-row items-center px-4 py-2">
          <Button
            label={showDiff ? "Show the file" : "Show what changed"}
            tone="neutral"
            size="sm"
            onPress={() => setShowDiff((v) => !v)}
          />
          <Text variant="caption" className="ml-3" style={{ color: colors.inkMuted }}>Unsaved changes</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="small" color={colors.inkMuted} style={{ marginTop: 32 }} />
      ) : showDiff ? (
        <ScrollView className="flex-1" style={{ backgroundColor: colors.surfaceCode }} contentContainerStyle={{ paddingVertical: 12 }}>
          {renderDiffLines()}
        </ScrollView>
      ) : isEditing ? (
        <View className="flex-1" style={{ backgroundColor: colors.surfaceCode }}>
          <TextInput
            value={editedContent}
            onChangeText={setEditedContent}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 px-3 py-3"
            style={{ ...code, color: colors.inkPrimary, textAlignVertical: "top", outlineStyle: "none", outlineWidth: 0 } as object}
          />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          style={{ backgroundColor: colors.surfaceCode }}
          contentContainerStyle={{ padding: 12 }}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={{ ...code, color: colors.inkPrimary }}>{content || "This file is empty."}</Text>
          </ScrollView>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
