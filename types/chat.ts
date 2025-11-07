export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
};

export type ConversationMood = 'positive' | 'neutral' | 'negative';
