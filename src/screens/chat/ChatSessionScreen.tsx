/**
 * frontend/src/screens/chat/ChatSessionScreen.tsx
 * ---------------------------------------------------------------------------
 * Main coding workspace screen.
 * Exposes chat history (editorial Serif), PlanModeCard, and live ToolCallCard
 * status updates populated via Supabase Realtime subscriptions.
 * ---------------------------------------------------------------------------
 */

import React, { useState, useEffect, useRef } from "react";
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from "react-native";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { ChatBubble } from "../../components/ChatBubble";
import { ToolCallCard } from "../../components/ToolCallCard";
import { PlanModeCard, type PlanStepItem } from "../../components/PlanModeCard";
import { InputComposer } from "../../components/InputComposer";
import { useTheme } from "../../theme/ThemeProvider";
import { useAgentSession } from "../../hooks/useAgentSession";
import { type ProjectStackParamList } from "../../navigation/types";

type ChatScreenRouteProp = RouteProp<ProjectStackParamList, "ChatSession">;

export const ChatSessionScreen = () => {
  const { colors } = useTheme();
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation();
  
  const { projectId } = route.params;
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(route.params.sessionId);
  
  const scrollViewRef = useRef<ScrollView>(null);

  // Load chat session & real-time task triggers
  const {
    session,
    isSessionLoading,
    tasks,
    sendPrompt,
    isSending,
    forkSession,
  } = useAgentSession(activeSessionId);

  // Scroll to bottom when messages or tasks change
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }, [session?.transcript?.length, tasks?.length]);

  const handleSendPrompt = async (text: string) => {
    try {
      if (activeSessionId) {
        // Resume session
        await sendPrompt({ projectId, prompt: text });
      } else {
        // Start a brand-new session
        const res = await sendPrompt({ 
          projectId, 
          prompt: text,
          title: text.slice(0, 30) // Use beginning of prompt as session title
        });
        if (res.session_id) {
          setActiveSessionId(res.session_id);
        }
      }
    } catch (e: any) {
      Alert.alert("خطا در ارتباط با ایجنت", e.message || "شروع ایجنت با خطا مواجه شد.");
    }
  };

  const handleFork = () => {
    if (!session || !session.transcript || session.transcript.length === 0) return;
    
    // Choose a middle message to fork from
    const midIndex = Math.floor(session.transcript.length / 2);
    Alert.alert(
      "انشعاب (Fork) نشست چت",
      `آیا مایلید یک نشست چت جدید از پیام شماره ${midIndex + 1} منشعب کنید؟`,
      [
        { text: "انصراف", style: "cancel" },
        {
          text: "انشعاب",
          onPress: async () => {
            try {
              const forked = await forkSession({ atMessageIndex: midIndex });
              Alert.alert("نشست منشعب شد", "سشن جدید با موفقیت ایجاد گردید.");
              setActiveSessionId(forked.id);
            } catch (e: any) {
              Alert.alert("خطا در ایجاد انشعاب", e.message);
            }
          }
        }
      ]
    );
  };

  // Extract plans if the agent is currently planning
  const isPlanning = session?.status === "active" && tasks.some(t => t.tool_name === "enter_plan_mode" && t.status === "success");
  const hasExitedPlan = tasks.some(t => t.tool_name === "exit_plan_mode" && t.status === "success");
  
  // Simulated steps for demonstration in PlanModeCard
  const mockPlanSteps: PlanStepItem[] = [
    { id: "1", type: "research", description: "بررسی ساختار فایل‌ها و مسیردهی‌ها در پروژه" },
    { id: "2", type: "file_edit", description: "اصلاح متد همگام‌سازی استوریج با تغییرات جدید" },
    { id: "3", type: "command_run", description: "اجرای تست‌های محلی برای تایید صحت عملکرد" },
  ];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      {/* Header bar */}
      <View 
        className="flex-row items-center justify-between px-4 py-3 border-b border-borderHairline"
        style={{ borderBottomColor: colors.borderHairline, backgroundColor: colors.canvasBase }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Text variant="body" className="font-uiMedium">← بازگشت</Text>
        </TouchableOpacity>
        
        <View className="items-center">
          <Text variant="h3" className="font-uiSemiBold">
            دستیار کدنویسی
          </Text>
          {isSending && (
            <Text variant="caption" className="text-accentTeal font-uiMedium" style={{ color: colors.accentTeal }}>
              در حال پردازش...
            </Text>
          )}
        </View>

        {/* Fork Session Button */}
        {activeSessionId ? (
          <TouchableOpacity onPress={handleFork} className="p-2 bg-surfaceRaised rounded-pill border border-borderHairline" style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}>
            <Text variant="caption" className="font-uiMedium text-[10px]">⌥ Fork</Text>
          </TouchableOpacity>
        ) : (
          <View className="w-10" />
        )}
      </View>

      {/* Messages Scroll Workspace */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 px-2"
        contentContainerStyle={{ paddingVertical: 12, paddingBottom: 32 }}
      >
        {isSessionLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="small" color={colors.brandPrimary} />
            <Text variant="caption" className="mt-2">در حال بارگذاری سابقه گفتگو...</Text>
          </View>
        ) : !activeSessionId ? (
          <View className="py-16 px-6 items-center">
            <Text variant="h2" className="text-center font-uiMedium">شروع گفتگو با ایجنت</Text>
            <Text variant="caption" className="text-center mt-2 opacity-70">
              یک سوال بپرسید یا کاری که می‌خواهید برایتان انجام شود را بنویسید.
            </Text>
          </View>
        ) : (
          <React.Fragment>
            {/* 1. Message transcript list */}
            {session?.transcript?.map((msg: any, idx: number) => {
              // Hide raw system messages or tool returns from standard bubbles to keep it tidy
              if (msg.role === "tool" || msg.role === "system") return null;
              
              return (
                <ChatBubble 
                  key={msg.id || idx} 
                  content={msg.content} 
                  sender={msg.role === "assistant" ? "agent" : "user"} 
                />
              );
            })}

            {/* 2. Show PlanModeCard if agent is currently planning */}
            {isPlanning && !hasExitedPlan && (
              <PlanModeCard steps={mockPlanSteps} />
            )}

            {/* 3. Real-time active task list */}
            {tasks.length > 0 && (
              <View className="mt-4 border-t border-borderHairline/30 pt-3" style={{ borderTopColor: colors.borderHairline }}>
                <Text variant="label" className="px-4 mb-2 text-right">
                  مراحل اجرای ابزارها (Agent Logs)
                </Text>
                {tasks.map((task) => (
                  <ToolCallCard
                    key={task.id}
                    toolName={task.tool_name}
                    status={task.status}
                    input={task.tool_input ? JSON.stringify(task.tool_input) : undefined}
                    output={task.tool_output ? JSON.stringify(task.tool_output) : undefined}
                  />
                ))}
              </View>
            )}
          </React.Fragment>
        )}
      </ScrollView>

      {/* Footer compose compose COMPOSER */}
      <InputComposer onSend={handleSendPrompt} />
    </SafeAreaView>
  );
};
