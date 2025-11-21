import { useAssets } from 'expo-asset';
import { useCallback, useState, useEffect } from 'react';
import { useTensorflowModel, type Tensor } from 'react-native-fast-tflite';
import type { SpeechMetrics } from '@/types/speech';

// TODO: 나중에 실제 모델 파일이 준비되면 assets 폴더에 넣고 파일명을 수정하세요.
// 현재는 placeholder로 설정되어 있습니다.
const MODEL_FILENAME = 'dementia_risk_model.tflite';

export function useRiskPrediction() {
    // 모델 에셋 로드 시도 (파일이 없으면 undefined)
    const [assets, error] = useAssets([require(`@/assets/${MODEL_FILENAME}`)]);
    const modelAsset = assets?.[0];

    // TFLite 모델 로드
    const plugin = useTensorflowModel(modelAsset);
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
                // 입력 데이터 준비: [말속도, 평균휴지기, 발화길이, 전체단어수]
                // 중요: 모델 학습 시 사용한 Feature 순서와 정확히 일치해야 합니다.
                const inputData = new Float32Array([
                    metrics.speechRateWpm,
                    metrics.meanPauseDurationSec,
                    metrics.mlu,
                    metrics.totalWords,
                    metrics.pausesPerMinute,
                    metrics.ttr,
                ]);

                // 추론 실행 (Sync)
                const output = plugin.model.runSync([inputData]);

                // 결과 해석
                // 가정: 출력은 [0~1] 사이의 위험도 확률값 하나라고 가정
                const riskScore = output[0][0];

                console.log(`[RiskModel] Prediction result: ${riskScore}`);
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
        error: error || plugin.error,
    };
}
