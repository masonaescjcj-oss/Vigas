/**
 * frontend/src/stores/notificationStore.ts
 * ---------------------------------------------------------------------------
 * Zustand store to manage local/in-app notifications inbox state.
 * ---------------------------------------------------------------------------
 */

import { create } from "zustand";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: "system" | "agent_done" | "usage_warning" | "promo";
  read: boolean;
  created_at: string;
  targetRoute?: string;
  targetParams?: any;
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (item: Omit<NotificationItem, "id" | "created_at" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [
    {
      id: "notif-1",
      title: "پایان موفقیت‌آمیز اجرای ایجنت",
      body: "ایجنت تغییرات فاز فرانت‌اند پروژه اول را با موفقیت تست و نهایی کرد.",
      type: "agent_done",
      read: false,
      created_at: new Date(Date.now() - 3600000).toISOString(),
      targetRoute: "ProjectDetail",
      targetParams: { projectId: "proj-1" }
    },
    {
      id: "notif-2",
      title: "هشدار مصرف توکن ماهانه",
      body: "شما ۸۰٪ از سقف توکن اشتراک رایگان خود را مصرف کرده‌اید.",
      type: "usage_warning",
      read: false,
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      targetRoute: "TokenUsage"
    }
  ],
  unreadCount: 2,

  addNotification: (item) => set((state) => {
    const newItem: NotificationItem = {
      ...item,
      id: `notif-${Math.random().toString(36).substr(2, 9)}`,
      read: false,
      created_at: new Date().toISOString(),
    };
    const nextList = [newItem, ...state.notifications];
    return {
      notifications: nextList,
      unreadCount: nextList.filter(n => !n.read).length
    };
  }),

  markAsRead: (id) => set((state) => {
    const nextList = state.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    return {
      notifications: nextList,
      unreadCount: nextList.filter(n => !n.read).length
    };
  }),

  markAllAsRead: () => set((state) => {
    const nextList = state.notifications.map((n) => ({ ...n, read: true }));
    return {
      notifications: nextList,
      unreadCount: 0
    };
  }),

  clearAll: () => set({ notifications: [], unreadCount: 0 })
}));
