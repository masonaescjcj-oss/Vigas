import { create } from "zustand";

export interface PendingChatPrompt {
  prompt: string;
  mode: "chat" | "build";
  model: string;
  createdAt: number;
}

const STORAGE_KEY = "vigas_chat_pending_prompt_v1";
const MAX_AGE_MS = 30 * 60 * 1000;

function readWebStorage(): PendingChatPrompt | null {
  try {
    const storage = (globalThis as { sessionStorage?: Storage }).sessionStorage;
    if (!storage) return null;
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingChatPrompt>;
    if (
      typeof parsed?.prompt !== "string" ||
      !parsed.prompt.trim() ||
      (parsed.mode !== "chat" && parsed.mode !== "build") ||
      typeof parsed.model !== "string" ||
      typeof parsed.createdAt !== "number"
    ) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    if (Date.now() - parsed.createdAt > MAX_AGE_MS) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed as PendingChatPrompt;
  } catch {
    return null;
  }
}

function writeWebStorage(value: PendingChatPrompt | null): void {
  try {
    const storage = (globalThis as { sessionStorage?: Storage }).sessionStorage;
    if (!storage) return;
    if (value) storage.setItem(STORAGE_KEY, JSON.stringify(value));
    else storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage quota or private-mode access errors.
  }
}

interface PendingPromptState {
  pending: PendingChatPrompt | null;
  setPendingPrompt: (input: Omit<PendingChatPrompt, "createdAt">) => void;
  consumePendingPrompt: () => PendingChatPrompt | null;
  clearPendingPrompt: () => void;
}

export const usePendingPromptStore = create<PendingPromptState>((set, get) => ({
  pending: readWebStorage(),

  setPendingPrompt: (input) => {
    const next: PendingChatPrompt = {
      prompt: input.prompt.trim(),
      mode: input.mode,
      model: input.model,
      createdAt: Date.now(),
    };
    writeWebStorage(next);
    set({ pending: next });
  },

  consumePendingPrompt: () => {
    const candidate = get().pending ?? readWebStorage();
    writeWebStorage(null);
    set({ pending: null });
    if (!candidate) return null;
    if (Date.now() - candidate.createdAt > MAX_AGE_MS || !candidate.prompt.trim()) {
      return null;
    }
    return candidate;
  },

  clearPendingPrompt: () => {
    writeWebStorage(null);
    set({ pending: null });
  },
}));
