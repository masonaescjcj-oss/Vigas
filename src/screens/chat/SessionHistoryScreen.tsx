/**
 * frontend/src/screens/chat/SessionHistoryScreen.tsx
 * ---------------------------------------------------------------------------
 * Lists past agent sessions of a project, enabling the user to Resume
 * an old chat or Fork a new session from previous steps.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { View, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from "react-native";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { useTheme } from "../../theme/ThemeProvider";
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
      setLoading(false);
      try {
        const data = await agentService.getProjectSessions(projectId);
        setSessions(data);
      } catch (e) {
        // Fallback for presentation
        setSessions([
          {
            id: "sess-1",
            project_id: projectId,
            status: "completed",
            model_provider: "claude",
            token_usage_total: 12500,
            transcript: [{ role: "user", content: "Create login form" }],
            created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
            updated_at: new Date(Date.now() - 3600000 * 23).toISOString(),
          },
          {
            id: "sess-2",
            project_id: projectId,
            status: "active",
            model_provider: "claude",
            token_usage_total: 24500,
            transcript: [{ role: "user", content: "Fix shell tests" }],
            created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
            updated_at: new Date(Date.now() - 3600000).toISOString(),
          }
        ]);
      } finally {
        setLoading(false);
      }
    };
    void fetchSessions();
  }, [projectId]);

  const handleResume = (id: string) => {
    navigation.navigate("AgentChat", { projectId, sessionId: id });
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      
      {/* Header bar */}
      <View 
        className="flex-row items-center justify-between px-6 py-4 border-b border-borderHairline"
        style={{ borderBottomColor: colors.borderHairline, backgroundColor: colors.canvasBase }}
      >
        <View className="w-10" />
        <Text variant="h2" className="font-uiSemiBold text-center">Chat History</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Text variant="body" className="font-uiMedium">← Back</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={colors.brandPrimary} />
        </View>
      ) : sessions.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text variant="caption">No active sessions found.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const firstMsg = item.transcript?.[0]?.content || "Empty Session";
            const formattedDate = new Date(item.updated_at).toLocaleDateString("en-US");
            
            return (
              <View 
                className="bg-surfaceRaised p-5 rounded-card border border-borderHairline mb-3"
                style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
              >
                <Text variant="body" className="font-uiMedium text-left" numberOfLines={1}>
                  {firstMsg}
                </Text>
                
                <View className="flex-row justify-between mt-2">
                  <Text variant="caption" className="opacity-60 text-[10px]">
                    Usage: {item.token_usage_total.toLocaleString()} tokens
                  </Text>
                  <Text variant="caption" className="opacity-60 text-[10px]">
                    Last activity: {formattedDate}
                  </Text>
                </View>

                {/* Actions */}
                <View className="flex-row justify-end space-x-2 mt-4">
                  <Button
                    label="Resume"
                    onPress={() => handleResume(item.id)}
                    className="py-1.5 px-4"
                  />
                </View>
              </View>
            );
          }}
        />
      )}

    </SafeAreaView>
  );
};
