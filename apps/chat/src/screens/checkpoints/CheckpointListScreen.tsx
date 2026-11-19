/**
 * frontend/src/screens/checkpoints/CheckpointListScreen.tsx
 * ---------------------------------------------------------------------------
 * Every restore point saved for a project, newest first, and the way back to
 * any of them. A snapshot is taken automatically before each run that can write
 * files, so this list reads as the project's history.
 *
 * Same rows as the chat's restore-points sheet, so the two places you can roll
 * a project back look like one feature rather than two.
 * ---------------------------------------------------------------------------
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, SafeAreaView, ActivityIndicator } from "react-native";
import { confirmAction, notify } from "../../services/notify";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { Card } from "../../components/ui/Card";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import {
  getProjectCheckpoints,
  relativeTime,
  restoreCheckpoint,
  type CheckpointRow,
} from "../../services/checkpointService";
import { type ProjectStackParamList } from "../../navigation/types";

type RouteProps = RouteProp<ProjectStackParamList, "CheckpointList">;

export const CheckpointListScreen = () => {
  const { colors } = useTheme();
  const route = useRoute<RouteProps>();
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

  useEffect(() => { void load(); }, [load]);

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
      { destructive: true, confirmLabel: "Roll back" },
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
      <ScreenHeader
        title="Restore points"
        subtitle={checkpoints.length ? `${checkpoints.length} saved` : undefined}
        divider={false}
      />

      {loading ? (
        <ActivityIndicator size="small" color={colors.inkMuted} style={{ marginTop: 32 }} />
      ) : checkpoints.length === 0 ? (
        <View className="px-4 pt-2">
          <Card>
            <Text variant="body" className="font-uiMedium">Nothing saved yet</Text>
            <Text variant="caption" className="mt-1" style={{ color: colors.inkSecondary, lineHeight: 18 }}>
              One is saved automatically before every run that can change your files.
            </Text>
          </Card>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Text variant="caption" className="px-1 py-3" style={{ color: colors.inkMuted, lineHeight: 18 }}>
            Each one is how the project looked before that run. Rolling back saves a restore point
            first, so it can be undone too.
          </Text>
          <Card flush>
            {checkpoints.map((item, index) => (
              <View
                key={item.id}
                className="flex-row items-center px-4 py-3"
                style={{
                  borderBottomWidth: index === checkpoints.length - 1 ? 0 : 1,
                  borderBottomColor: colors.borderHairline,
                }}
              >
                <View className="flex-1 mr-3">
                  <Text style={{ color: colors.inkPrimary }} className="text-sm" numberOfLines={1}>
                    {item.session_title ? `Before “${item.session_title}”` : "Restore point"}
                  </Text>
                  <Text variant="caption" className="mt-0.5" style={{ color: colors.inkMuted }}>
                    {relativeTime(item.created_at)} · {item.id.slice(0, 7)}
                  </Text>
                </View>
                <Button
                  label="Restore"
                  tone="neutral"
                  size="sm"
                  loading={restoringId === item.id}
                  disabled={restoringId !== null}
                  onPress={() => void handleRollback(item)}
                />
              </View>
            ))}
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
