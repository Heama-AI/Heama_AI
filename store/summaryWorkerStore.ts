import { create } from 'zustand';

import { createId } from '@/lib/conversation';
import type { ChatMessage } from '@/types/chat';

type SummaryJob = {
  id: string;
  type: 'summary';
  messages: ChatMessage[];
  keywords: string[];
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
};

type KeywordJob = {
  id: string;
  type: 'keywords';
  messages: ChatMessage[];
  resolve: (value: string[]) => void;
  reject: (reason: Error) => void;
};

export type WorkerJob = SummaryJob | KeywordJob;

type SummaryWorkerState = {
  queue: WorkerJob[];
  isModelReady: boolean;
  modelDownloadProgress: number;
  enqueueSummary: (messages: ChatMessage[], keywords: string[]) => Promise<string>;
  enqueueKeywords: (messages: ChatMessage[]) => Promise<string[]>;
  completeJob: (id: string) => void;
  setModelStatus: (isReady: boolean, progress: number) => void;
};

export const useSummaryWorkerStore = create<SummaryWorkerState>((set) => ({
  queue: [],
  isModelReady: false,
  modelDownloadProgress: 0,
  enqueueSummary: (messages, keywords) =>
    new Promise<string>((resolve, reject) => {
      const job: SummaryJob = {
        id: createId(),
        type: 'summary',
        messages,
        keywords,
        resolve,
        reject,
      };
      set((state) => ({ queue: [...state.queue, job] }));
    }),
  enqueueKeywords: (messages) =>
    new Promise<string[]>((resolve, reject) => {
      const job: KeywordJob = {
        id: createId(),
        type: 'keywords',
        messages,
        resolve,
        reject,
      };
      set((state) => ({ queue: [...state.queue, job] }));
    }),
  completeJob: (id: string) =>
    set((state) => ({ queue: state.queue.filter((job) => job.id !== id) })),
  setModelStatus: (isReady, progress) => set({ isModelReady: isReady, modelDownloadProgress: progress }),
}));

export function requestSummary(messages: ChatMessage[], keywords: string[]) {
  return useSummaryWorkerStore.getState().enqueueSummary(messages.slice(-24), keywords);
}

export function requestKeywords(messages: ChatMessage[]) {
  return useSummaryWorkerStore.getState().enqueueKeywords(messages.slice(-24));
}
