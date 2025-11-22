import type { SpeechMetrics } from '@/types/speech';
import { useCallback, useEffect, useState } from 'react';
import { useTensorflowModel } from 'react-native-fast-tflite';

// TODO: 모델 파일 교체 시 아래 require 경로만 수정하세요.
const MODEL_ASSET = require('../../assets/dementia_model.tflite');

// feature_cols order (model expects 5 floats = 20 bytes):
// ['speech_rate_wpm', 'mean_pause_duration_s', 'pauses_per_min', 'mlu', 'ttr']
const FEATURE_MEAN = [95.27099315, 2.84955479, 7.44436644, 20.69089041, 0.66184932];
const FEATURE_STD = [37.06212631, 3.31190797, 3.38656511, 20.14955237, 0.1221413];

export function useRiskPrediction() {
    // TFLite 모델 로드
    const plugin = useTensorflowModel(MODEL_ASSET);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (plugin.state === 'loaded') {
            console.log('[RiskModel] TFLite model loaded successfully');
            setIsReady(true);
        } else if (plugin.state === 'error') {
            console.warn('[RiskModel] Failed to load TFLite model:', plugin.error);
        }
    }, [plugin.state, plugin.error]);

    const predict = useCallback(
        (metrics: SpeechMetrics): number | null => {
            if (plugin.state !== 'loaded' || !plugin.model) {
                console.warn('[RiskModel] Model not ready for prediction');
                return null;
            }

            try {
                // 입력 데이터 준비: [speech_rate_wpm, mean_pause_duration_s, pauses_per_min, mlu, ttr]
                const featuresRaw = [
                    metrics.speechRateWpm,
                    metrics.meanPauseDurationSec,
                    metrics.pausesPerMinute,
                    metrics.mlu,
                    metrics.ttr,
                    metrics.totalWords,
                ];
                const features = featuresRaw.slice(0, FEATURE_MEAN.length).map((value, idx) => {
                    const mean = FEATURE_MEAN[idx];
                    const std = FEATURE_STD[idx];
                    const normalized = (value - mean) / std;
                    return Number.isFinite(normalized) ? normalized : 0;
                });
                const hasNaN = features.some((v) => typeof v !== 'number' || Number.isNaN(v));
                if (hasNaN) {
                    console.warn('[RiskModel] Invalid feature values', { features });
                    return null;
                }
                const inputData = new Float32Array(features);

                // 추론 실행 (Sync)
                const output = plugin.model.runSync([inputData]);

                // 결과 해석
                // 가정: 출력은 [0~1] 사이의 위험도 확률값 하나
                const riskScore = Math.max(0, Math.min(1, output[0][0]));

                console.log('[RiskModel] Prediction result', {
                    features: {
                        speech_rate_wpm: features[0],
                        mean_pause_duration_s: features[1],
                        pauses_per_min: features[2],
                        mlu: features[3],
                        ttr: features[4],
                    },
                    riskScore,
                });
                return riskScore;

            } catch (e) {
                console.error('[RiskModel] Prediction failed:', e);
                return null;
            }
        },
        [plugin]
    );

    return {
        isReady,
        predict,
        error: plugin.error,
    };
}
