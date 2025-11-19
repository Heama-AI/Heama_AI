import type { ChatMessage } from '@/types/chat';
import { requestKeywords } from '@/store/summaryWorkerStore';
import { IS_EXECUTORCH_SUMMARY } from '@/lib/summary/config';

export async function generateLocalKeywords(messages: ChatMessage[]): Promise<string[] | null> {
  if (!IS_EXECUTORCH_SUMMARY || messages.length === 0) {
    return null;
  }

  try {
    return await requestKeywords(messages);
  } catch (error) {
    console.error('ExecuTorch 키워드 추출 실패', error);
    return null;
  }
}
