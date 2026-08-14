/**
 * frontend/src/components/ProjectCard.tsx
 * ---------------------------------------------------------------------------
 * Displays a project card with swipe-to-delete native behavior.
 * Uses a horizontal ScrollView to reveal a delete button when swiped left.
 * ---------------------------------------------------------------------------
 */

import React, { useRef } from "react";
import { View, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { Text } from "./Typography";
import { useTheme } from "../theme/ThemeProvider";
import { type Project } from "../services/projectService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ProjectCardProps {
  project: Project;
  onPress: () => void;
  onDelete: () => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onPress,
  onDelete,
}) => {
  const { colors } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const handleClose = () => {
    scrollViewRef.current?.scrollTo({ x: 0, animated: true });
  };

  const triggerDelete = () => {
    onDelete();
    handleClose();
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={80} // snap to the delete button width
      decelerationRate="fast"
      contentContainerStyle={{ width: SCREEN_WIDTH + 80 }}
      className="mb-3"
    >
      {/* 1. Main Project Card (Full Screen Width) */}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        className="bg-surfaceRaised p-4 rounded-card border border-borderHairline flex-row justify-between items-center"
        style={{ 
          width: SCREEN_WIDTH - 32, // Padding subtracted
          backgroundColor: colors.surfaceRaised, 
          borderColor: colors.borderHairline,
          marginLeft: 16,
        }}
      >
        <View className="flex-1 pr-4">
          <Text variant="h3" className="font-uiMedium text-right">
            {project.name}
          </Text>
          {project.description && (
            <Text variant="caption" className="mt-1 text-right opacity-80" numberOfLines={2}>
              {project.description}
            </Text>
          )}
          <Text variant="caption" className="mt-2 text-right opacity-60 text-[10px]">
            آخرین بازدید: {new Date(project.last_opened_at).toLocaleDateString("fa-IR")}
          </Text>
        </View>
        <Text variant="body" className="opacity-40">◀ swipe</Text>
      </TouchableOpacity>

      {/* 2. Hidden Delete Action Button (Width: 80px) */}
      <TouchableOpacity
        onPress={triggerDelete}
        activeOpacity={0.8}
        className="w-[80px] h-full items-center justify-center rounded-r-card mr-4"
        style={{ backgroundColor: colors.failed }}
      >
        <Text variant="caption" className="font-uiSemiBold text-canvasBase" style={{ color: colors.canvasBase }}>
          حذف
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};
