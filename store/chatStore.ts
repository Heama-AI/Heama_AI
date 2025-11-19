import { createId } from '@/lib/conversation';
import { clearChatMessages, loadChatMessages, loadConversationId, saveChatMessage, saveConversationId } from '@/lib/storage/chatStorage';
import { ChatMessage } from '@/types/chat';
import { create } from 'zustand';

export interface ChatState {
  messages: ChatMessage[];
  isResponding: boolean;
  hasHydrated: boolean;
  conversationId: string;
  addMessage: (message: ChatMessage) => void;
  addAssistantMessage: (text: string) => ChatMessage;
  setResponding: (responding: boolean) => void;
  setConversationId: (conversationId: string) => void;
  reset: (options?: { conversationId?: string }) => void;
  hydrate: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isResponding: false,
  hasHydrated: false,
  conversationId: createId(),
  addMessage: (message) => {
    set((state) => ({ messages: [...state.messages, message] }));
    void saveChatMessage(message);
  },
  addAssistantMessage: (text) => {
    const assistantMessage: ChatMessage = {
      id: `${Date.now()}-assistant`,
      role: 'assistant',
      text,
      ts: Date.now(),
    };
    set((state) => ({ messages: [...state.messages, assistantMessage] }));
    void saveChatMessage(assistantMessage);
    return assistantMessage;
  },
  setResponding: (isResponding) => set({ isResponding }),
  setConversationId: (conversationId) => {
    set({ conversationId });
    void saveConversationId(conversationId);
  },
  reset: (options) => {
    const nextConversationId = options?.conversationId ?? createId();
    set((state) => ({
      messages: [],
      isResponding: false,
      hasHydrated: state.hasHydrated,
      conversationId: nextConversationId,
    }));
    void clearChatMessages();
    void saveConversationId(nextConversationId);
  },
  hydrate: async () => {
    if (get().hasHydrated) return;
    try {
      const [persistedMessages, persistedConversationId] = await Promise.all([
        loadChatMessages(),
        loadConversationId(),
      ]);
      set((state) => {
        if (state.hasHydrated) {
          return state;
        }
        const merged = new Map<string, ChatMessage>();
        for (const message of persistedMessages) {
          merged.set(message.id, message);
        }
        for (const message of state.messages) {
          merged.set(message.id, message);
        }
        const ordered = Array.from(merged.values()).sort((a, b) => a.ts - b.ts);
        const conversationId =
          persistedConversationId ??
          (ordered.length > 0 ? state.conversationId ?? ordered[0].id : state.conversationId ?? createId());
        void saveConversationId(conversationId);
        return { messages: ordered, hasHydrated: true, conversationId };
      });
    } catch (error) {
      console.error('Failed to hydrate chat messages', error);
      const fallbackId = createId();
      void saveConversationId(fallbackId);
      set((state) => ({ hasHydrated: true, conversationId: state.conversationId ?? fallbackId }));
    }
  },
}));
