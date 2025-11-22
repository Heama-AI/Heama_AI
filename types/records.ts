import type { ChatMessage } from '@/types/chat';
import type { FhirConversationBundle } from '@/types/fhir';

export type QuizChoice = string;

export type QuizQuestion = {
  id: string;
  question: string;
  choices: QuizChoice[];
  answer: QuizChoice;
  explanation: string;
};

export type ConversationStats = {
  totalTurns: number;
  userTurns: number;
  assistantTurns: number;
  durationMinutes: number;
  moodScore: number;
  riskScore?: number;
};

export interface ConversationRecord {
  id: string;
  title: string;
  summary: string;
  highlights: string[];
  keywords: string[];
  createdAt: number;
  updatedAt: number;
  stats: ConversationStats;
  messages: ChatMessage[];
  quiz: QuizQuestion[];
  fhirBundle: FhirConversationBundle;
}
