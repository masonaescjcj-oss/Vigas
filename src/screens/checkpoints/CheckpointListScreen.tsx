/**
 * frontend/src/screens/checkpoints/CheckpointListScreen.tsx
 * ---------------------------------------------------------------------------
 * Every restore point saved for a project, newest first, and the way back to
 * any of them. A snapshot is taken automatically before each run that can write
 * files, so this list reads as the project's history.
 * ---------------------------------------------------------------------------
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from "react-native";
import { confirmAction, notify } from "../../services/notify";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { useTheme } from "../../theme/ThemeProvider";
import {
  getProjectCheckpoints,
  relativeTime,
  restoreCheckpoint,
  type CheckpointRow,
} from "../../services/checkpointService";
import { type ProjectStackParamList, type ProjectNavigationProp } from "../../navigation/types";

type RouteProps = RouteProp<ProjectStackParamList, "CheckpointList">;

export const CheckpointListScreen = () => {
  const { colors } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<ProjectNavigationProp>();
  const { projectId } = route.params;

  const [checkpoints, setCheckpoints] = useState<CheckpointRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCheckpoints(await getProjectCheckpoints(projectId));
    } catch (e: any) {
      setCheckpoints([]);
      notify("Could not load restore points", e?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Rollback overwrites the project's working files, so it confirms first. The
   * backend snapshots the current state before swapping, which is what makes
   * "you can undo this" true rather than reassuring.
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
      await load();
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
        <View className="w-10" />
        <Text variant="h3" className="font-uiSemiBold">Restore points</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Text variant="body" className="font-uiMedium">← Back</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={colors.brandPrimary} />
        </View>
      ) : checkpoints.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text variant="body" className="font-uiMedium mb-2">No restore points yet</Text>
          <Text variant="caption" className="opacity-60 text-center leading-5">
            One is saved automatically before every run that can change your files.
          </Text>
        </View>
      ) : (
        <FlatList
          data={checkpoints}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListHeaderComponent={
            <Text variant="caption" className="opacity-60 text-left leading-5 mb-4 px-1">
              Each one is how the project looked before that run. Rolling back saves a restore
              point first, so it can be undone.
            </Text>
          }
          renderItem={({ item }) => (
            <View
              className="bg-surfaceRaised p-5 rounded-card border border-borderHairline mb-3"
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
                  className="py-1.5 px-4 rounded border"
                  style={{ backgroundColor: `${colors.failed}15`, borderColor: `${colors.failed}30` }}
                >
                  {restoringId === item.id ? (
                    <ActivityIndicator size="small" color={colors.failed} />
                  ) : (
                    <Text variant="caption" className="font-uiMedium" style={{ color: colors.failed }}>
                      Roll back to here
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

    </SafeAreaView>
  );
};
