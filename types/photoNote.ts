import type { SpeechMetrics } from './speech';

export type PhotoNote = {
  id: string;
  imageId: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  audioUri?: string;
  transcript?: string;
  metrics?: SpeechMetrics;
  kind?: 'photo' | 'script';
  scriptPrompt?: string;
  scriptMatchCount?: number;
  scriptTotalCount?: number;
};
