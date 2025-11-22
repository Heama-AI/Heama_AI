import { generateLocalSummary } from '@/lib/summary/localSummariser';
import { generateLocalKeywords } from '@/lib/summary/localKeywordExtractor';
import { generateOpenAISummary } from '@/lib/summary/openaiSummariser';
import { generateOpenAIKeywords } from '@/lib/summary/openaiKeywordExtractor';
import { SUMMARY_PROVIDER, IS_EXECUTORCH_SUMMARY } from '@/lib/summary/config';
import type { ChatMessage } from '@/types/chat';

export async function generateSummary(messages: ChatMessage[], keywords: string[]) {
  if (SUMMARY_PROVIDER === 'openai') {
    const openaiSummary = await generateOpenAISummary(messages, keywords);
    if (openaiSummary) return openaiSummary;
  }

  const localSummary = await generateLocalSummary(messages, keywords);
  return localSummary;
}

export async function generateKeywords(messages: ChatMessage[]) {
  if (SUMMARY_PROVIDER === 'openai') {
    const openaiKeywords = await generateOpenAIKeywords(messages);
    if (openaiKeywords?.length) return openaiKeywords;
  }

  const userMessagesOnly = messages.filter((m) => m.role === 'user');
  const localKeywords = await generateLocalKeywords(userMessagesOnly);
  return localKeywords;
}
