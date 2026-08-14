/**
 * frontend/src/screens/notifications/NotificationInboxScreen.tsx
 * ---------------------------------------------------------------------------
 * Notification Inbox Screen:
 *   - Lists in-app alerts with unread badge dots.
 *   - Clicking routes directly via deep-links.
 *   - EmptyState preset hook if empty.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, FlatList, TouchableOpacity, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { EmptyState } from "../../components/EmptyState";
import { useTheme } from "../../theme/ThemeProvider";
import { useNotificationStore, type NotificationItem } from "../../stores/notificationStore";

export const NotificationInboxScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  
  const { notifications, markAsRead, markAllAsRead, clearAll } = useNotificationStore();

  const handleSelectNotif = (item: NotificationItem) => {
    markAsRead(item.id);
    if (item.targetRoute) {
      navigation.navigate(item.targetRoute as any, item.targetParams);
    }
  };

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "agent_done":
        return "🤖";
      case "usage_warning":
        return "⚠️";
      case "promo":
        return "🎁";
      case "system":
      default:
        return "📢";
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      
      {/* Header bar */}
      <View 
        className="flex-row items-center justify-between px-6 py-4 border-b border-borderHairline"
        style={{ borderBottomColor: colors.borderHairline, backgroundColor: colors.canvasBase }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Text variant="body" className="font-uiMedium">← Back</Text>
        </TouchableOpacity>

        <Text variant="h3" className="font-uiSemiBold">Notifications</Text>

        <TouchableOpacity onPress={clearAll} className="p-2">
          <Text variant="caption" className="font-uiMedium text-red-500" style={{ color: colors.failed }}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {/* Sub action row */}
      {notifications.length > 0 && (
        <View className="px-6 py-2 bg-surfaceRaised border-b border-borderHairline/20 flex-row justify-between" style={{ backgroundColor: colors.surfaceRaised, borderBottomColor: colors.borderHairline }}>
          <Text variant="caption" className="text-[10px] opacity-60">Inbox</Text>
          <TouchableOpacity onPress={markAllAsRead}>
            <Text variant="caption" className="text-brandPrimary text-[10px] font-uiMedium" style={{ color: colors.brandPrimary }}>
              Mark all as read ✓
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Inbox contents */}
      {notifications.length === 0 ? (
        <EmptyState
          title="Inbox is empty"
          description="You have no notifications at this time."
          emoji="🔔"
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleSelectNotif(item)}
              className="bg-surfaceRaised p-4 rounded-card border border-borderHairline mb-3 flex-row justify-between items-start"
              style={{ 
                backgroundColor: colors.surfaceRaised, 
                borderColor: item.read ? colors.borderHairline : colors.brandPrimary,
                borderWidth: item.read ? 1 : 1.5
              }}
              activeOpacity={0.8}
            >
              {/* Type emoji icon indicator */}
              <Text className="text-xl mr-3">{getIcon(item.type)}</Text>
              
              {/* Message details */}
              <View className="flex-1 items-start pr-2 pl-1">
                <View className="flex-row items-center justify-start">
                  <Text variant="body" className="font-uiMedium text-left">
                    {item.title}
                  </Text>
                  {!item.read && (
                    <View className="w-2 h-2 rounded-full bg-brandPrimary ml-2" style={{ backgroundColor: colors.brandPrimary }} />
                  )}
                </View>
                <Text variant="caption" className="opacity-80 text-left mt-1 leading-5">
                  {item.body}
                </Text>
                <Text variant="caption" className="opacity-60 text-[9px] mt-2 text-left">
                  {new Date(item.created_at).toLocaleTimeString("en-US")}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

    </SafeAreaView>
  );
};
