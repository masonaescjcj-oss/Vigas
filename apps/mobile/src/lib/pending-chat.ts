export interface PendingMobileChat {
  prompt: string;
  model: string;
  createdAt: number;
}

const MAX_AGE_MS = 30 * 60 * 1000;
let pendingChat: PendingMobileChat | null = null;

export function setPendingChat(input: Omit<PendingMobileChat, 'createdAt'>): void {
  const prompt = input.prompt.trim();
  if (!prompt) return;
  pendingChat = {
    prompt,
    model: input.model,
    createdAt: Date.now(),
  };
}

export function consumePendingChat(): PendingMobileChat | null {
  const item = pendingChat;
  pendingChat = null;
  if (!item) return null;
  if (Date.now() - item.createdAt > MAX_AGE_MS || !item.prompt.trim()) return null;
  return item;
}

export function clearPendingChat(): void {
  pendingChat = null;
}
