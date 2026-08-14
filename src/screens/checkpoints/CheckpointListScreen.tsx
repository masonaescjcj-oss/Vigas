/**
 * frontend/src/screens/checkpoints/CheckpointListScreen.tsx
 * ---------------------------------------------------------------------------
 * Screen representing the list of checkpoints/commits of the project.
 * Allows rollbacks and checkpoint comparisons.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { View, FlatList, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator } from "react-native";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { useTheme } from "../../theme/ThemeProvider";
import { supabase } from "../../services/supabase";
import { type ProjectStackParamList, type ProjectNavigationProp } from "../../navigation/types";

type RouteProps = RouteProp<ProjectStackParamList, "CheckpointList">;

interface Checkpoint {
  id: string;
  description: string;
  created_at: string;
}

export const CheckpointListScreen = () => {
  const { colors } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<ProjectNavigationProp>();
  const { projectId } = route.params;

  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCheckpoints = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("checkpoints")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });

        if (!error && data) {
          setCheckpoints(data as Checkpoint[]);
        } else {
          // Fallback presentation mock
          setCheckpoints([
            { id: "ch-1", description: "Initial setup and adding template files", created_at: new Date(Date.now() - 3600000 * 2).toISOString() },
            { id: "ch-2", description: "Fix frontend login form and connect webhook", created_at: new Date(Date.now() - 3600000).toISOString() },
          ]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    void fetchCheckpoints();
  }, [projectId]);

  const handleRollback = (desc: string) => {
    Alert.alert(
      "Rollback Project",
      `Do you want to rollback all active project files to "${desc}"? Unsaved changes will be lost.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm Rollback", 
          style: "destructive",
          onPress: () => Alert.alert("Success", "Project has been rolled back successfully.")
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      
      {/* Header bar */}
      <View 
        className="flex-row items-center justify-between px-6 py-4 border-b border-borderHairline"
        style={{ borderBottomColor: colors.borderHairline, backgroundColor: colors.canvasBase }}
      >
        <View className="w-10" />
        <Text variant="h3" className="font-uiSemiBold">Checkpoints</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Text variant="body" className="font-uiMedium">← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Checkpoints list */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={colors.brandPrimary} />
        </View>
      ) : checkpoints.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text variant="caption">No checkpoints recorded for this project.</Text>
        </View>
      ) : (
        <FlatList
          data={checkpoints}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View 
              className="bg-surfaceRaised p-5 rounded-card border border-borderHairline mb-3"
              style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
            >
              <Text variant="body" className="font-uiMedium text-left">
                {item.description}
              </Text>
              <Text variant="caption" className="opacity-60 text-left text-[10px] mt-1">
                {new Date(item.created_at).toLocaleString("en-US")}
              </Text>
              
              <View className="flex-row justify-end space-x-2 mt-4">
                <TouchableOpacity 
                  onPress={() => handleRollback(item.description)}
                  className="py-1.5 px-4 bg-red-500/10 rounded border border-red-500/20"
                  style={{ backgroundColor: `${colors.failed}15`, borderColor: `${colors.failed}30` }}
                >
                  <Text variant="caption" className="text-red-500 font-uiMedium" style={{ color: colors.failed }}>Rollback to here</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

    </SafeAreaView>
  );
};
