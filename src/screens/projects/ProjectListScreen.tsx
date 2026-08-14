/**
 * frontend/src/screens/projects/ProjectListScreen.tsx
 * ============================================================================
 * PURE UI/UX PRESENTATIONAL SCREEN — (NO BUSINESS LOGIC / NO API CALLS)
 * ============================================================================
 * Visual layout showcase for Projects List with Modal dialog for creating projects.
 * Uses static mock data for clean UI/UX demonstration.
 * ============================================================================
 */

import React, { useState } from "react";
import { View, FlatList, TouchableOpacity, Modal, TextInput, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { useTheme } from "../../theme/ThemeProvider";
import { MOCK_PROJECTS } from "../../services/mockData";
import { type ProjectNavigationProp } from "../../navigation/types";

export const ProjectListScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<ProjectNavigationProp>();

  // Static Presentation State
  const [projectsList, setProjectsList] = useState(MOCK_PROJECTS);
  const [modalVisible, setModalVisible] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  const handleCreateMockProject = () => {
    if (!newProjectName.trim()) return;
    const newProj = {
      id: `proj_mock_${Date.now()}`,
      name: newProjectName,
      description: newProjectDesc || "پروژه جدید شبیه‌سازی‌شده",
      sandbox_path: `users/mock/projects/${newProjectName.toLowerCase()}`,
      last_opened_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    setProjectsList([newProj, ...projectsList]);
    setModalVisible(false);
    setNewProjectName("");
    setNewProjectDesc("");
    navigation.navigate("ChatSession", { projectId: newProj.id });
  };

  const handleDeleteMockProject = (id: string) => {
    setProjectsList(projectsList.filter(p => p.id !== id));
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      
      {/* Top Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-borderHairline" style={{ borderBottomColor: colors.borderHairline }}>
        <Text variant="h2" className="font-uiSemiBold">
          پروژه‌ها
        </Text>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="w-9 h-9 rounded-full items-center justify-center"
          style={{ backgroundColor: `${colors.brandPrimary}20` }}
        >
          <Text variant="h3" style={{ color: colors.brandPrimary }}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Projects List */}
      {projectsList.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text variant="h3" className="text-center font-uiMedium">هنوز پروژه‌ای ندارید</Text>
          <Text variant="caption" className="text-center mt-2 opacity-70">
            برای شروع کدنویسی با ایجنت هوشمند، اولین پروژه خود را بسازید.
          </Text>
          <Button 
            label="ساخت اولین پروژه" 
            onPress={() => setModalVisible(true)} 
            className="mt-6 w-full"
          />
        </View>
      ) : (
        <FlatList
          data={projectsList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate("ChatSession", { projectId: item.id })}
              className="bg-surfaceRaised p-4 rounded-card border border-borderHairline mb-3 flex-row justify-between items-center shadow-sm"
              style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
              activeOpacity={0.9}
            >
              {/* Project Details */}
              <View className="flex-1 pr-4">
                <Text variant="h3" className="font-uiMedium text-left">
                  {item.name}
                </Text>
                {item.description && (
                  <Text variant="caption" className="mt-1 text-left opacity-80" numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
                <Text variant="caption" className="mt-2 text-left opacity-50 text-[10px]">
                  آخرین بازدید: {new Date(item.last_opened_at).toLocaleDateString("fa-IR")}
                </Text>
              </View>

              {/* Action Button */}
              <TouchableOpacity
                onPress={() => handleDeleteMockProject(item.id)}
                className="p-2 rounded-full"
                style={{ backgroundColor: `${colors.failed}15` }}
              >
                <Text variant="caption" style={{ color: colors.failed }}>🗑️</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Create Project UI Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-center bg-black/50 px-6">
          <View 
            className="p-6 rounded-card border border-borderHairline shadow-xl"
            style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
          >
            <Text variant="h3" className="font-uiSemiBold mb-4 text-left">
              ساخت پروژه جدید
            </Text>

            <View className="space-y-4">
              <View>
                <Text variant="caption" className="mb-1 font-uiMedium text-left">
                  نام پروژه *
                </Text>
                <TextInput
                  value={newProjectName}
                  onChangeText={setNewProjectName}
                  placeholder="مثال: اپلیکیشن فروشگاهی Next.js"
                  placeholderTextColor={colors.inkSecondary}
                  className="w-full bg-canvasBase p-3.5 rounded-input border border-borderHairline font-uiRegular text-sm text-left"
                  style={{ backgroundColor: colors.canvasBase, borderColor: colors.borderHairline, color: colors.inkPrimary }}
                />
              </View>

              <View className="mt-3">
                <Text variant="caption" className="mb-1 font-uiMedium text-left">
                  توضیحات کوتاه
                </Text>
                <TextInput
                  value={newProjectDesc}
                  onChangeText={setNewProjectDesc}
                  placeholder="پروژه فرانت‌اند همراه با اتصال به API"
                  placeholderTextColor={colors.inkSecondary}
                  className="w-full bg-canvasBase p-3.5 rounded-input border border-borderHairline font-uiRegular text-sm text-left"
                  style={{ backgroundColor: colors.canvasBase, borderColor: colors.borderHairline, color: colors.inkPrimary }}
                />
              </View>
            </View>

            <View className="flex-row mt-6 space-x-3">
              <Button
                label="انصراف"
                variant="secondary"
                onPress={() => setModalVisible(false)}
                className="flex-1 mr-2"
              />
              <Button
                label="ایجاد پروژه"
                onPress={handleCreateMockProject}
                className="flex-1 ml-2"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};
