import { BrandColors, Shadows } from '@/constants/theme';
import { calculateSpeechMetrics } from '@/lib/analysis/speechMetrics';
import { transcribeAudioDetailed } from '@/lib/stt';
import { startVoiceRecording, type RecordingHandle } from '@/lib/voice';
import { usePhotoNotesStore } from '@/store/photoNotesStore';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { calculateScriptMatch } from '../../lib/analysis/scriptMatch';

const SCRIPT_IMAGE_ID = 'script-reading';
const SCRIPT_PROMPTS = [
  '“행복한 가정은 모두 서로 닮았지만, 불행한 가정은 저마다 다른 이유로 불행하다.”라는 문장으로 시작하는 톨스토이의 소설 안나 카레니나의 도입부는 인간의 삶과 운명, 그리고 관계의 복잡함을 차분하게 보여 줍니다. 이 구절은 한 가정의 비극을 단순한 사건으로 보지 않고, 그 속에 숨어 있는 감정과 갈등을 하나씩 들여다보게 합니다. 소설은 러시아 상류 사회의 화려함과 그 아래 깊이 감춰진 불안과 외로움을 섬세하게 묘사하며, 인간이 가진 내면의 불안정함을 천천히 드러냅니다. 읽는 동안 가족이라는 울타리 안에서 일어나는 일들과, 사람들 사이에서 자연스럽게 생겨나는 오해나 갈등, 그리고 그 끝에 남는 슬픔을 차분히 느끼며 따라가면 좋습니다.',

  '찰스 디킨스의 “두 도시 이야기”는 “그것은 최악의 시대였고, 동시에 최고의 시대였다.”라는 유명한 문장으로 시작합니다. 이 문장은 프랑스 혁명이라는 역사적 소용돌이 속에서 인간의 삶이 얼마나 극단적인 상황을 오가며 흔들리는지를 보여 줍니다. 부유함과 빈곤, 희망과 절망, 혼란과 회복이 한 시대 안에서 동시에 존재했으며, 사람들은 그 가운데서 서로 다른 운명을 맞이하게 됩니다. 이 문장을 읽다 보면 시대의 혼란 속에서도 꿋꿋하게 살아가던 평범한 사람들이 어떻게 서로를 지키고, 때로는 희생을 통해 희망을 남겼는지 천천히 떠올리게 됩니다.',

  '도스토예프스키의 “죄와 벌” 초반부는 주인공 라스콜리니코프가 더운 여름날 뒷골목을 걸으며 세상과 단절되어 가는 자신의 마음을 느끼는 장면으로 구성되어 있습니다. 그는 사람들의 소음과 냄새, 도시의 무거운 공기 속에서 점점 고립감을 느끼고, 자신이 품은 생각으로 인해 세상과 다른 길을 걷게 될 것 같은 불안한 마음을 갖게 됩니다. 이 글을 읽다 보면 인간이 스스로를 몰아가는 심리, 죄책감과 정당화 사이에서 흔들리는 마음, 그리고 그 안에서 벗어나고 싶은 갈망이 천천히 드러나는 느낌을 받을 수 있습니다.',

  '셰익스피어의 “템페스트”에서 프로스페로가 딸 미란다에게 과거 이야기를 들려주는 장면은 조용하고 깊은 정서를 담고 있습니다. 그는 폭풍우가 치던 밤, 자신과 딸이 섬에 떠밀려 오게 된 사연을 차분히 회상하며, 세상에서 겪은 배신과 상처, 그리고 다시 일어서기 위한 내면의 힘을 이야기합니다. 이 장면을 읽다 보면 인간이 역경 속에서도 희망을 잃지 않고, 누군가를 지키기 위해 헌신하는 마음을 어떻게 품게 되는지 천천히 느낄 수 있습니다.',

  '괴테의 “젊은 베르테르의 슬픔”에서 베르테르는 자신의 감정을 솔직하게 적어 내려가는 편지를 통해 자연의 풍경과 자신의 내면을 연결지어 표현합니다. 그는 한때 사랑했던 사람을 떠올리며 햇빛이 비추는 들판, 부드러운 바람, 나무 사이로 스며드는 빛의 흐름 등을 묘사하고, 그 자연 속에서 자신의 감정을 정돈하려 합니다. 이 글을 읽다 보면, 인간이 감정적으로 흔들릴 때 주변 세상이 어떻게 더 선명하게 느껴지는지, 그리고 작은 자연의 변화에도 큰 위로를 받게 되는지가 차분히 전달됩니다.',

  '“갈매기의 꿈”에서는 조나단 리빙스턴 갈매기가 바다 위를 날며 자유와 배움을 향한 열망을 품는 장면이 인상 깊습니다. 그는 다른 갈매기들이 먹이를 위해 단순히 비행하는 것에 만족하는 동안, 더 높은 곳을 날고 더 빠르고 정확하게 움직이고 싶어 합니다. 이 글은 한 개체가 사회의 규범에서 벗어나 성장하려 하는 과정과, 그 과정에서 맞는 외로움과 깨달음을 천천히 그리고 은근한 울림으로 전합니다.',

  '루이스 캐럴의 “이상한 나라의 앨리스” 초반부에서 앨리스가 토끼굴로 떨어지는 장면은 호기심과 두려움이 뒤섞인 꿈같은 분위기를 만들어 냅니다. 깊고 길게 이어지는 통로를 내려가며 그녀는 주변 벽에 붙은 그림, 책장, 이상한 물건들을 하나씩 바라보며 현실과 다른 세계로 빨려 들어갑니다. 이 장면을 읽다 보면 어린아이가 새로운 세계를 마주하며 느끼는 설렘과 혼란을 다시 떠올릴 수 있고, 천천히 읽을수록 상상 속 풍경이 선명하게 떠오릅니다.',

  '셰익스피어의 “소네트 18번”은 “그대를 여름날에 비하랴”라는 유명한 문장으로 시작하여 한 사람의 아름다움과 그 감정의 영원함을 찬미합니다. 시는 시간이 지나며 아름다움이 시들어도, 기록된 시 속에서는 영원히 남는다는 생각을 차분한 어조로 풀어냅니다. 단어 하나하나가 부드럽게 흐르며, 사랑과 존경의 감정이 잔잔하게 퍼지는 느낌이 들어 천천히 읽기 좋습니다.',

  '월트 휘트먼의 “나 자신의 노래” 일부에는 인간이 삶 속에서 겪는 끊임없는 변화, 성장, 그리고 세상과의 연결에 대한 깊은 사색이 담겨 있습니다. 그는 자연과 사람들, 하루하루의 경험이 모두 자신을 이루는 일부라고 말하며, 삶을 있는 그대로 받아들이는 태도를 차분하게 표현합니다. 이 구절을 읽다 보면 삶의 속도가 잠시 느려지고, 호흡이 안정되며, 주변 세계와 조용히 연결되는 기분을 느낄 수 있습니다.',

  '헨리 데이비드 소로의 “월든”은 호숫가에서의 고요한 삶을 묘사하며, 자연 속에서 단순함의 가치를 발견하는 경험을 담고 있습니다. 소로는 새벽의 물안개, 나무 사이로 비치는 햇빛, 물결이 잔잔하게 일렁이는 모습을 보며 삶의 본질을 찾아가는 과정을 세심하게 기록합니다. 이 글을 읽으면 자연이 주는 안정감과 고요함이 차분하게 전해지고, 천천히 읽을수록 마음이 가라앉으며 편안해지는 느낌이 듭니다.'
];

const FOLLOWUP_MESSAGE = '분석 결과가 저장되었습니다. 건강 통계 > 사진 설명에서 확인할 수 있어요.';

function pickRandomPrompt(current?: string) {
  const choices = SCRIPT_PROMPTS.filter((prompt) => prompt !== current);
  return choices[Math.floor(Math.random() * choices.length)] ?? SCRIPT_PROMPTS[0];
}

export default function ScriptReadingScreen() {
  const hydrate = usePhotoNotesStore((state) => state.hydrate);
  const addNote = usePhotoNotesStore((state) => state.addNote);

  const [recordingHandle, setRecordingHandle] = useState<RecordingHandle | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hasRecentResult, setHasRecentResult] = useState(false);
  const [prompt, setPrompt] = useState(() => pickRandomPrompt());
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    return () => {
      if (recordingHandle) {
        void recordingHandle.stop({ discard: true }).catch(() => undefined);
      }
    };
  }, [recordingHandle]);

  const isBusy = useMemo(() => isRecording || isTranscribing, [isRecording, isTranscribing]);

  const shufflePrompt = () => {
    if (isBusy) return;
    setPrompt((prev) => pickRandomPrompt(prev));
    setStatusMessage(null);
    setHasRecentResult(false);
  };

  const handleStartRecording = useCallback(async () => {
    try {
      if (isBusy) return;
      setStatusMessage(null);
      setHasRecentResult(false);
      const handle = await startVoiceRecording();
      setRecordingHandle(handle);
      setIsRecording(true);
    } catch (error) {
      console.error('녹음 시작 실패', error);
      Alert.alert('녹음 실패', error instanceof Error ? error.message : '마이크를 사용할 수 없습니다.');
    }
  }, [isBusy]);

  const handleCancelRecording = useCallback(async () => {
    if (!recordingHandle) return;
    setIsRecording(false);
    try {
      await recordingHandle.stop({ discard: true });
      setStatusMessage('녹음을 취소했습니다.');
    } catch (error) {
      console.error('녹음 취소 실패', error);
    } finally {
      setRecordingHandle(null);
      setHasRecentResult(false);
    }
  }, [recordingHandle]);

  const processAudioFile = useCallback(
    async (uri: string) => {
      setIsTranscribing(true);
      try {
        const transcript = await transcribeAudioDetailed(uri, { language: 'ko' });
        const metrics = calculateSpeechMetrics(transcript);
        const match = calculateScriptMatch(transcript.text ?? '', prompt);

        await addNote({
          imageId: SCRIPT_IMAGE_ID,
          description: transcript.text,
          audioUri: uri,
          transcript: transcript.text,
          metrics,
          scriptPrompt: prompt,
          scriptMatchCount: match.matchCount,
          scriptTotalCount: match.totalCount,
        });

        setStatusMessage(
          `분석이 완료되었습니다. 지시문 정확도는 ${match.totalCount > 0 ? Math.round((match.matchCount / match.totalCount) * 100) : 0
          }% 입니다.`
        );
        setHasRecentResult(true);
      } catch (error) {
        console.error('오디오 처리 실패', error);
        setStatusMessage('음성을 문자로 변환하지 못했습니다. 다시 시도해 주세요.');
        Alert.alert('인식 실패', error instanceof Error ? error.message : '파일 처리 중 문제가 발생했습니다.');
      } finally {
        setIsTranscribing(false);
      }
    },
    [addNote, prompt]
  );

  const handleStopRecording = useCallback(async () => {
    if (!recordingHandle) return;
    setIsRecording(false);
    try {
      const result = await recordingHandle.stop();
      if (!result?.fileUri) {
        setStatusMessage('녹음이 취소되었습니다.');
        return;
      }
      await processAudioFile(result.fileUri);
    } catch (error) {
      console.error('녹음 정지 실패', error);
      setStatusMessage('음성을 문자로 변환하지 못했습니다. 직접 내용을 적어주세요.');
      Alert.alert('인식 실패', error instanceof Error ? error.message : '녹음 처리 중 문제가 발생했습니다.');
    } finally {
      setRecordingHandle(null);
    }
  }, [processAudioFile, recordingHandle]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ title: '지시문 읽어보기' }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 28,
            paddingBottom: Math.max(40, insets.bottom + 24),
            gap: 24,
          }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 30, fontWeight: '800', color: BrandColors.textPrimary }}>지시문 읽어보기</Text>
            <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>
              준비된 지시문을 큰 소리로 읽고 발화 정확도를 측정해 보세요. 건강 통계의 사진 설명 지표에 함께 기록됩니다.
            </Text>
          </View>

          <View
            style={{
              backgroundColor: BrandColors.surface,
              borderRadius: 24,
              padding: 20,
              gap: 16,
              borderWidth: 1,
              borderColor: BrandColors.border,
              ...Shadows.card,
            }}>
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>읽을 지시문</Text>
              <Text style={{ color: BrandColors.textSecondary, lineHeight: 22 }}>{prompt}</Text>
              <Pressable
                onPress={shufflePrompt}
                disabled={isBusy}
                style={{
                  marginTop: 6,
                  alignSelf: 'flex-start',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: BrandColors.border,
                  backgroundColor: BrandColors.surfaceSoft,
                  opacity: isBusy ? 0.6 : 1,
                }}>
                <Text style={{ color: BrandColors.textSecondary, fontWeight: '600' }}>다른 지시문 받기</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={isRecording ? handleStopRecording : handleStartRecording}
                style={{
                  flex: 1,
                  borderRadius: 18,
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isRecording ? '#FF6B6B' : BrandColors.primary,
                }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{isRecording ? '녹음 멈추기' : '녹음 시작'}</Text>
              </Pressable>
              {isRecording ? (
                <Pressable
                  onPress={handleCancelRecording}
                  style={{
                    paddingVertical: 16,
                    paddingHorizontal: 18,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: BrandColors.border,
                    backgroundColor: BrandColors.surface,
                  }}>
                  <Text style={{ color: BrandColors.textSecondary, fontWeight: '600' }}>취소</Text>
                </Pressable>
              ) : null}
            </View>

            {isTranscribing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={BrandColors.primary} />
                <Text style={{ color: BrandColors.textSecondary }}>음성을 변환하는 중이에요…</Text>
              </View>
            ) : null}

            {statusMessage ? <Text style={{ color: BrandColors.textSecondary }}>{statusMessage}</Text> : null}
            {hasRecentResult ? (
              <View
                style={{
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: BrandColors.border,
                  backgroundColor: BrandColors.surfaceSoft,
                  padding: 16,
                  gap: 8,
                }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: BrandColors.textPrimary }}>분석이 완료되었어요</Text>
                <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>{FOLLOWUP_MESSAGE}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
