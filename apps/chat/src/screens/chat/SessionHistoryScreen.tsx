/**
 * frontend/src/screens/chat/SessionHistoryScreen.tsx
 * ---------------------------------------------------------------------------
 * Past chats in this project, newest first. Tapping one reopens it.
 *
 * Each was a card with a "Resume" button in its corner, which asked the user
 * to aim at a small target inside a large one that did nothing. The row is the
 * button now. The title comes from the session, falling back to its first
 * message — a session titled by the agent is more use than "Empty Session".
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from "react-native";
import { notify } from "../../services/notify";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Card } from "../../components/ui/Card";
import { Pill } from "../../components/ui/Pill";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import { directionStyleFor } from "../../theme/direction";
import { relativeTime } from "../../services/formatting";
import { agentService, type AgentSessionData } from "../../services/agentService";
import { type ProjectStackParamList, type ProjectNavigationProp } from "../../navigation/types";

type RouteProps = RouteProp<ProjectStackParamList, "SessionHistory">;

export const SessionHistoryScreen = () => {
  const { colors } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<ProjectNavigationProp>();
  const { projectId } = route.params;

  const [sessions, setSessions] = useState<AgentSessionData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      try {
        setSessions(await agentService.getProjectSessions(projectId));
      } catch (e: any) {
        setSessions([]);
        notify("Could not load chat history", e?.message ?? "Please try again.");
      } finally {
        setLoading(false);
      }
    };
    void fetchSessions();
  }, [projectId]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScreenHeader
        title="Chat history"
        subtitle={sessions.length ? `${sessions.length} chat${sessions.length === 1 ? "" : "s"}` : undefined}
        divider={false}
      />

      {loading ? (
        <ActivityIndicator size="small" color={colors.inkMuted} style={{ marginTop: 32 }} />
      ) : sessions.length === 0 ? (
        <View className="px-4 pt-2">
          <Card>
            <Text variant="caption" style={{ color: colors.inkMuted, lineHeight: 18 }}>
              No chats in this project yet.
            </Text>
          </Card>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Card flush className="mt-2">
            {sessions.map((item, index) => {
              const title = item.title || item.transcript?.[0]?.content || "Untitled chat";
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => navigation.navigate("AgentChat", { projectId, sessionId: item.id })}
                  className="px-4 py-3"
                  style={{
                    borderBottomWidth: index === sessions.length - 1 ? 0 : 1,
                    borderBottomColor: colors.borderHairline,
                  }}
                  activeOpacity={0.6}
                >
                  <View className="flex-row items-center">
                    <Text
                      style={{ color: colors.inkPrimary, ...directionStyleFor(title) }}
                      className="text-sm flex-1 mr-2"
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    {item.status === "failed" ? <Pill tone="failed">Failed</Pill> : null}
                  </View>
                  <Text variant="caption" className="mt-0.5" style={{ color: colors.inkMuted }}>
                    {relativeTime(item.updated_at)}
                    {item.token_usage_total ? ` · ${item.token_usage_total.toLocaleString("en-US")} tokens` : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
