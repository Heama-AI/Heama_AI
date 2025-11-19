import { useEffect, useRef } from 'react';
import { QWEN3_0_6B_QUANTIZED, useLLM } from 'react-native-executorch';

import { IS_EXECUTORCH_SUMMARY } from '@/lib/summary/config';
import {
  buildKeywordPrompt,
  buildSummaryPrompt,
  KEYWORD_SYSTEM_PROMPT,
  parseKeywords,
  SUMMARY_SYSTEM_PROMPT,
} from '@/lib/summary/prompts';
import { useSummaryWorkerStore } from '@/store/summaryWorkerStore';

const EXECUTORCH_SUMMARY_MODEL = {
  modelSource:
    process.env.EXPO_PUBLIC_EXECUTORCH_SUMMARY_MODEL_SOURCE ?? QWEN3_0_6B_QUANTIZED.modelSource,
  tokenizerSource:
    process.env.EXPO_PUBLIC_EXECUTORCH_SUMMARY_TOKENIZER_SOURCE ??
    QWEN3_0_6B_QUANTIZED.tokenizerSource,
  tokenizerConfigSource:
    process.env.EXPO_PUBLIC_EXECUTORCH_SUMMARY_TOKENIZER_CONFIG_SOURCE ??
    QWEN3_0_6B_QUANTIZED.tokenizerConfigSource,
};



export function SummaryWorker() {
  const job = useSummaryWorkerStore((state) => state.queue[0]);
  const completeJob = useSummaryWorkerStore((state) => state.completeJob);
  const setModelStatus = useSummaryWorkerStore((state) => state.setModelStatus);
  const summaryLLM = useLLM({
    model: EXECUTORCH_SUMMARY_MODEL,
    preventLoad: !IS_EXECUTORCH_SUMMARY,
  });
  const summaryResponseRef = useRef(summaryLLM.response);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    summaryResponseRef.current = summaryLLM.response;
  }, [summaryLLM.response]);

  useEffect(() => {
    if (!IS_EXECUTORCH_SUMMARY) return;
    setModelStatus(summaryLLM.isReady, summaryLLM.downloadProgress);
  }, [summaryLLM.isReady, summaryLLM.downloadProgress, setModelStatus]);

  useEffect(() => {
    if (!IS_EXECUTORCH_SUMMARY) return;
    if (!job || isProcessingRef.current) return;

    console.log('[SummaryWorker] Job detected:', job.type, job.id);
    console.log(
      '[SummaryWorker] Current Model Config:',
      JSON.stringify({
        model: EXECUTORCH_SUMMARY_MODEL,
      })
    );

    console.log(
      '[SummaryWorker] Model Status:',
      JSON.stringify({
        isReady: summaryLLM.isReady,
        progress: summaryLLM.downloadProgress,
        error: summaryLLM.error,
        isGenerating: summaryLLM.isGenerating,
      })
    );

    if (!summaryLLM.isReady) {
      console.log('[SummaryWorker] Model not ready yet. Waiting...');
      return;
    }
    isProcessingRef.current = true;
    console.log('[SummaryWorker] Starting processing job:', job.id);
    const currentJob = job;
    (async () => {
      try {
        if (currentJob.type === 'summary') {
          console.log('[SummaryWorker] Generating summary...');
          await summaryLLM.generate([
            { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
            { role: 'user', content: buildSummaryPrompt(currentJob.messages, currentJob.keywords) },
          ]);
          console.log('[SummaryWorker] Summary generation raw complete');
          const cleaned = summaryResponseRef.current.trim().replace(/^["']|["']$/g, '');
          if (!cleaned) {
            throw new Error('요약 결과가 비어 있습니다.');
          }
          currentJob.resolve(cleaned);
          console.log('[executorch] 요약 생성 완료');
        } else {
          console.log('[SummaryWorker] Extracting keywords...');
          await summaryLLM.generate([
            { role: 'system', content: KEYWORD_SYSTEM_PROMPT },
            { role: 'user', content: buildKeywordPrompt(currentJob.messages) },
          ]);
          console.log('[SummaryWorker] Keyword extraction raw complete');
          const parsed = parseKeywords(summaryResponseRef.current);
          if (!parsed.length) {
            throw new Error('키워드를 추출하지 못했습니다.');
          }
          const unique: string[] = [];
          for (const keyword of parsed) {
            if (!unique.includes(keyword)) {
              unique.push(keyword);
            }
            if (unique.length >= 5) break;
          }
          currentJob.resolve(unique);
          console.log('[executorch] 키워드 추출 완료');
        }
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        currentJob.reject(normalized);
        console.error('[executorch] SummaryWorker 작업 실패', normalized);
      } finally {
        console.log('[SummaryWorker] Job finished:', currentJob.id);
        completeJob(currentJob.id);
        isProcessingRef.current = false;
      }
    })();
  }, [job, summaryLLM, completeJob]);

  return null;
}
