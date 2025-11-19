import type { ChatMessage } from '@/types/chat';
import { requestSummary } from '@/store/summaryWorkerStore';
import { IS_EXECUTORCH_SUMMARY } from '@/lib/summary/config';

export async function generateLocalSummary(messages: ChatMessage[], keywords: string[]): Promise<string | null> {
  if (!IS_EXECUTORCH_SUMMARY || messages.length === 0) {
    return null;
  }

  try {
    return await requestSummary(messages, keywords);
  } catch (error) {
    console.error('ExecuTorch 요약 생성 실패', error);
    return null;
  }
}
