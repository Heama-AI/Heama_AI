import type { DetailedTranscript, SpeechMetrics, STTWord } from '@/types/speech';

const DEFAULT_METRICS: SpeechMetrics = {
  speechRateWpm: 0,
  meanPauseDurationSec: 0,
  pausesPerMinute: 0,
  mlu: 0,
  ttr: 0,
  totalWords: 0,
  speakingDurationSec: 0,
  utteranceCount: 0,
  pauseCount: 0,
};

export function calculateSpeechMetrics(transcript?: DetailedTranscript | null): SpeechMetrics {
  const words = normalizeWords(transcript);
  if (words.length === 0) {
    return DEFAULT_METRICS;
  }

  words.sort((a, b) => a.start - b.start);

  const tokens = words
    .map((word) => sanitizeToken(word.word))
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return DEFAULT_METRICS;
  }

  const speakingDurationSec = Math.max(words[words.length - 1].end - words[0].start, 1e-6);
  const speakingDurationMin = speakingDurationSec / 60;

  const pauseThreshold = 0.5;
  const longPauseThreshold = 1.0;
  const pauseDurations: number[] = [];
  let utteranceCount = 1;

  for (let i = 1; i < words.length; i += 1) {
    const gap = words[i].start - words[i - 1].end;
    if (gap >= pauseThreshold) {
      pauseDurations.push(gap);
    }
    if (gap >= longPauseThreshold) {
      utteranceCount += 1;
    }
  }

  const pauseCount = pauseDurations.length;
  const meanPauseDurationSec = pauseCount > 0 ? average(pauseDurations) : 0;

  const speechRateWpm = speakingDurationMin > 0 ? tokens.length / speakingDurationMin : 0;
  const pausesPerMinute = speakingDurationMin > 0 ? pauseCount / speakingDurationMin : 0;
  const mlu = utteranceCount > 0 ? tokens.length / utteranceCount : 0;
  const ttr = tokens.length > 0 ? uniqueCount(tokens) / tokens.length : 0;

  return {
    speechRateWpm: round(speechRateWpm),
    meanPauseDurationSec: round(meanPauseDurationSec),
    pausesPerMinute: round(pausesPerMinute),
    mlu: round(mlu),
    ttr: round(ttr, 3),
    totalWords: tokens.length,
    speakingDurationSec: round(speakingDurationSec, 2),
    utteranceCount,
    pauseCount,
  };
}

export type MetricLevel = 'normal' | 'warning' | 'risk';
export type OverallLevel = 'normal' | 'warning' | 'risk' | 'critical';

export type MetricSummary = {
  key: 'speechRateWpm' | 'meanPauseDurationSec' | 'mlu';
  label: string;
  level: MetricLevel;
  statusText: string;
  helperText: string;
};

export type SpeechMetricsSummary = {
  overallLevel: OverallLevel;
  overallText: string;
  coreSummaries: MetricSummary[];
  suggestions: string[];
  totalWords: number;
};

export type MetricTrendDetail = {
  key: 'speechRateWpm' | 'meanPauseDurationSec' | 'mlu';
  label: string;
  level: MetricLevel;
  changePercent: number;
  message: string;
  deltaText?: string;
  baselineValue: number;
  currentValue: number;
};

export type SpeechMetricsChangeSummary = {
  overallLevel: MetricLevel;
  overallText: string;
  details: MetricTrendDetail[];
  totalWordsFlag?: string;
};

export function summarizeSpeechMetrics(metrics?: SpeechMetrics | null): SpeechMetricsSummary | null {
  if (!metrics) return null;

  const speechRateSummary = buildSpeechRateSummary(metrics.speechRateWpm);
  const pauseSummary = buildPauseSummary(metrics.meanPauseDurationSec);
  const mluSummary = buildMluSummary(metrics.mlu);
  const coreSummaries: MetricSummary[] = [speechRateSummary, pauseSummary, mluSummary];

  const riskCount = coreSummaries.filter((item) => item.level === 'risk').length;
  const warningCount = coreSummaries.filter((item) => item.level === 'warning').length;

  let overallLevel: OverallLevel = 'normal';
  let overallText = '이번 측정에서는 뚜렷한 변화가 보이지 않아요.';

  if (riskCount >= 2) {
    overallLevel = 'risk';
    overallText = '이번 측정에서 여러 지표가 일반 범위를 벗어났어요.';
  } else if (riskCount >= 1 || warningCount >= 2) {
    overallLevel = 'warning';
    overallText = '이번 측정에서 일부 지표가 평소보다 달라요.';
  }

  const suggestions: string[] = [];
  let overallAdjustedLevel: OverallLevel = overallLevel;

  if (metrics.totalWords < 40) {
    overallAdjustedLevel = 'critical';
    overallText = '측정 길이가 너무 짧아서 신뢰도가 낮아요. 다시 측정해 주세요.';
    suggestions.push('40 단어 미만으로 기록되어 결과 해석이 어렵습니다. 조금 더 길게 이야기해 보세요.');
  } else if (metrics.totalWords < 51.9) {
    suggestions.push('전체 단어 수가 51.9 단어 미만입니다. 결과 해석에 주의가 필요합니다.');
    if (overallLevel === 'risk') {
      overallAdjustedLevel = 'critical';
      overallText = '강한 변화 신호가 감지되었습니다. 전문가 상담을 검토해 주세요.';
    }
  }

  return {
    overallLevel: overallAdjustedLevel,
    overallText,
    coreSummaries,
    suggestions,
    totalWords: metrics.totalWords,
  };
}

function normalizeWords(transcript?: DetailedTranscript | null): STTWord[] {
  if (!transcript) return [];
  const words = Array.isArray(transcript.words) ? transcript.words : [];
  return words.filter((word) => typeof word?.start === 'number' && typeof word?.end === 'number');
}

function sanitizeToken(input: string): string {
  return input.trim().toLowerCase().replace(/[.,!?\"'()\[\]{}:;]/g, '');
}

function uniqueCount(items: string[]): number {
  return new Set(items).size;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildSpeechRateSummary(value: number): MetricSummary {
  if (value >= 98.7) {
    return {
      key: 'speechRateWpm',
      label: '말 속도',
      level: 'normal',
      statusText: '말하는 속도가 안정적이에요.',
      helperText: '분당 98.7 단어 이상으로 편안한 속도입니다.',
    };
  }
  if (value >= 81.4) {
    return {
      key: 'speechRateWpm',
      label: '말 속도',
      level: 'warning',
      statusText: '조금 느려요.',
      helperText: '81.4~98.7 단어/분 구간으로 변화를 관찰해 주세요.',
    };
  }
  return {
    key: 'speechRateWpm',
    label: '말 속도',
    level: 'risk',
    statusText: '속도가 꽤 느려요.',
    helperText: '81.4 단어/분 미만으로 평소보다 느릴 수 있습니다.',
  };
}

function buildPauseSummary(value: number): MetricSummary {
  if (value <= 3) {
    return {
      key: 'meanPauseDurationSec',
      label: '말 사이 쉬는 시간',
      level: 'normal',
      statusText: '말 사이 쉬는 시간이 짧아요.',
      helperText: '평균 3초 이하로 자연스럽게 이어집니다.',
    };
  }
  if (value <= 4.7) {
    return {
      key: 'meanPauseDurationSec',
      label: '말 사이 쉬는 시간',
      level: 'warning',
      statusText: '잠깐 쉬는 시간이 길어요.',
      helperText: '3~4.7초 사이로 조금 늘어난 상태입니다.',
    };
  }
  return {
    key: 'meanPauseDurationSec',
    label: '말 사이 쉬는 시간',
    level: 'risk',
    statusText: '쉬는 시간이 꽤 길어요.',
    helperText: '4.7초 이상 쉬어가며 말하고 있어요.',
  };
}

function buildMluSummary(value: number): MetricSummary {
  if (value >= 19.4) {
    return {
      key: 'mlu',
      label: '한 문장 길이',
      level: 'normal',
      statusText: '문장 길이가 충분해요.',
      helperText: '문장을 평균 19단어 이상으로 말하고 있습니다.',
    };
  }
  if (value >= 8.9) {
    return {
      key: 'mlu',
      label: '한 문장 길이',
      level: 'warning',
      statusText: '문장이 조금 짧아요.',
      helperText: '평균 9~19단어 수준으로 다소 짧은 편입니다.',
    };
  }
  return {
    key: 'mlu',
    label: '한 문장 길이',
    level: 'risk',
    statusText: '문장이 많이 짧아요.',
    helperText: '평균 9단어 미만으로 문장을 마치고 있습니다.',
  };
}

export function evaluateSpeechMetricsChange(
  baseline?: SpeechMetrics | null,
  current?: SpeechMetrics | null,
  totalEntries?: number,
): SpeechMetricsChangeSummary | null {
  if (!baseline || !current) return null;

  const speechRateDetail = evaluateDecreaseTrend({
    key: 'speechRateWpm',
    label: '말 속도',
    baseline: baseline.speechRateWpm,
    current: current.speechRateWpm,
    warningThreshold: 5,
    riskThreshold: 13,
    warningMessage: '말 속도가 조금 느려요.',
    riskMessage: '말 속도가 많이 느려요.',
    stableMessage: '말 속도가 유지되고 있어요.',
  });

  const pauseDetail = evaluateIncreaseTrend({
    key: 'meanPauseDurationSec',
    label: '말 사이 쉬는 시간',
    baseline: baseline.meanPauseDurationSec,
    current: current.meanPauseDurationSec,
    warningThreshold: 10,
    riskThreshold: 30,
    warningMessage: '말 사이 쉬는 시간이 조금 길어요.',
    riskMessage: '말 사이 쉬는 시간이 꽤 길어요.',
    stableMessage: '쉬는 시간은 안정적이에요.',
  });

  const mluDetail = evaluateDecreaseTrend({
    key: 'mlu',
    label: '한 문장 길이',
    baseline: baseline.mlu,
    current: current.mlu,
    warningThreshold: 5,
    riskThreshold: 16,
    warningMessage: '문장 길이가 조금 짧아요.',
    riskMessage: '문장 길이가 꽤 짧아요.',
    stableMessage: '문장 길이가 유지되고 있어요.',
  });

  const details = [speechRateDetail, pauseDetail, mluDetail];
  const riskCount = details.filter((detail) => detail.level === 'risk').length;
  const warningCount = details.filter((detail) => detail.level === 'warning').length;

  let overallLevel: MetricLevel = 'normal';
  let overallText = '변화가 크지 않아요. 꾸준히 기록해 주세요.';

  if (riskCount >= 2) {
    overallLevel = 'risk';
    overallText = '여러 지표에서 큰 변화가 느껴집니다. 전문가와 상담을 검토해 주세요.';
  } else if ((riskCount >= 1 && warningCount >= 1) || warningCount >= 2) {
    overallLevel = 'warning';
    overallText = '몇몇 지표에서 변화가 보입니다. 추세를 지켜봐 주세요.';
  }

  let totalWordsFlag: string | undefined;
  const totalWordsDrop = calculateDecreasePercent(baseline.totalWords, current.totalWords);
  if (totalWordsDrop >= 10) {
    totalWordsFlag = '전체 단어 수가 크게 줄었어요. 충분한 길이로 다시 측정해 보세요.';
  }

  return {
    overallLevel,
    overallText,
    details,
    totalWordsFlag,
  };
}

function evaluateDecreaseTrend({
  key,
  label,
  baseline,
  current,
  warningThreshold,
  riskThreshold,
  warningMessage,
  riskMessage,
  stableMessage,
}: {
  key: 'speechRateWpm' | 'mlu';
  label: string;
  baseline: number;
  current: number;
  warningThreshold: number;
  riskThreshold: number;
  warningMessage: string;
  riskMessage: string;
  stableMessage: string;
}): MetricTrendDetail {
  const changePercent = calculateDecreasePercent(baseline, current);
  const deltaText = buildDeltaText(baseline, current, '-');
  if (changePercent >= riskThreshold) {
    return { key, label, level: 'risk', changePercent, message: riskMessage, deltaText, baselineValue: baseline, currentValue: current };
  }
  if (changePercent >= warningThreshold) {
    return { key, label, level: 'warning', changePercent, message: warningMessage, deltaText, baselineValue: baseline, currentValue: current };
  }
  return { key, label, level: 'normal', changePercent, message: stableMessage, deltaText, baselineValue: baseline, currentValue: current };
}

function evaluateIncreaseTrend({
  key,
  label,
  baseline,
  current,
  warningThreshold,
  riskThreshold,
  warningMessage,
  riskMessage,
  stableMessage,
}: {
  key: 'meanPauseDurationSec';
  label: string;
  baseline: number;
  current: number;
  warningThreshold: number;
  riskThreshold: number;
  warningMessage: string;
  riskMessage: string;
  stableMessage: string;
}): MetricTrendDetail {
  const changePercent = calculateIncreasePercent(baseline, current);
  const deltaText = buildDeltaText(baseline, current, '+');
  if (changePercent >= riskThreshold) {
    return { key, label, level: 'risk', changePercent, message: riskMessage, deltaText, baselineValue: baseline, currentValue: current };
  }
  if (changePercent >= warningThreshold) {
    return { key, label, level: 'warning', changePercent, message: warningMessage, deltaText, baselineValue: baseline, currentValue: current };
  }
  return { key, label, level: 'normal', changePercent, message: stableMessage, deltaText, baselineValue: baseline, currentValue: current };
}

function calculateDecreasePercent(baseline: number, current: number): number {
  if (!Number.isFinite(baseline) || baseline === 0 || !Number.isFinite(current)) {
    return 0;
  }
  const drop = ((baseline - current) / baseline) * 100;
  return drop > 0 ? drop : 0;
}

function calculateIncreasePercent(baseline: number, current: number): number {
  if (!Number.isFinite(baseline) || baseline === 0 || !Number.isFinite(current)) {
    return 0;
  }
  const rise = ((current - baseline) / baseline) * 100;
  return rise > 0 ? rise : 0;
}

function buildDeltaText(baseline: number, current: number, direction: '+' | '-') {
  if (!Number.isFinite(baseline) || !Number.isFinite(current)) return undefined;
  const percent = ((current - baseline) / (baseline || 1)) * 100;
  const signedPercent = direction === '+' ? percent : -percent;
  return `${signedPercent >= 0 ? '+' : ''}${signedPercent.toFixed(1)}%`;
}
