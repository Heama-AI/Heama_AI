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
const SCRIPT_PROMPTS_KO = [
  '오늘 아침, 날씨가 아주 맑았어요. 할머니는 모자를 쓰고 집 앞 공원으로 산책을 나갔습니다. 공원에는 예쁜 꽃들이 활짝 피어 있었어요. 빨간 장미, 노란 해바라기가 보였지요. 할머니는 꽃향기를 맡으며 깊이 숨을 들이마셨어요. 기분이 참 좋았습니다.',
  '벤치에 앉아 쉬는데, 귀여운 강아지 한 마리가 다가왔어요. 꼬리를 살랑살랑 흔들며 할머니를 반겼습니다. 할머니는 강아지 머리를 부드럽게 쓰다듬어 주었어요. 강아지는 좋아서 멍멍 짖었지요. 산책을 마치고 집으로 돌아오는 길, 할머니는 이웃에 사는 철수 엄마를 만났습니다. 서로 반갑게 인사하며 웃었어요. 오늘 하루가 즐겁고 행복했습니다.',
  '꼬마는 학교에 가는 길에 작은 새를 발견했어요. 새는 나뭇가지 위에 앉아 지저귀고 있었지요. 꼬마는 조심스럽게 다가가 새에게 인사를 했습니다. 새는 꼬마를 보더니 날개를 퍼덕이며 하늘로 날아올랐어요. 꼬마는 새가 자유롭게 나는 모습을 보며 기뻤습니다. 학교에 도착한 꼬마는 친구들에게 오늘 본 새 이야기를 신나게 들려주었어요.',
  '할아버지는 매일 아침 일찍 일어나 동네 공원을 산책하십니다. 오늘도 어김없이 공원에 가니, 운동하는 사람들이 많이 보였어요. 할아버지는 천천히 걸으며 상쾌한 공기와 새소리를 즐기셨어요. 공원 한쪽에서는 아이들이 뛰어놀고 있었지요. 할아버지는 그 모습을 보며 미소를 지으셨습니다. 산책을 마치고 집에 돌아오니, 맛있는 아침 식사가 준비되어 있었어요. 할아버지는 오늘도 건강한 하루를 시작했습니다.',
  '봄이 오자 꽃들이 활짝 피었어요. 공원에는 형형색색의 꽃들이 가득했지요. 노란 개나리, 분홍 벚꽃, 하얀 목련이 아름답게 어우러져 있었어요. 사람들은 꽃구경을 즐기며 사진을 찍었지요. 아이들은 꽃밭 사이를 뛰어다니며 웃음소리를 냈어요. 봄바람이 살랑살랑 불어와 꽃잎이 흩날렸습니다. 모두가 봄의 아름다움을 만끽하는 행복한 시간이었어요.',
  '바닷가에 놀러 간 가족이 있었어요. 아이들은 모래성을 쌓으며 즐겁게 놀았지요. 파도 소리가 들려오고, 바람이 시원하게 불었어요. 엄마는 아이들에게 조개껍데기를 주며 이야기를 들려주었어요. 아빠는 바다를 바라보며 깊은 숨을 쉬었지요. 해가 지기 시작하자, 가족은 함께 모여 노을을 감상했어요. 오늘 하루는 모두에게 소중한 추억이 되었습니다.',
  '가을이 되자 나무들은 알록달록한 색으로 변했어요. 빨간 단풍잎, 노란 은행잎이 바람에 흩날렸지요. 할머니는 산책을 하며 떨어진 낙엽을 밟았어요. 바스락거리는 소리가 기분 좋았지요. 길가에는 호박과 고구마가 가득 쌓여 있었어요. 할머니는 시장에서 신선한 채소도 사 가셨어요. 집에 돌아와 따뜻한 차 한 잔을 마시며 오늘의 산책을 떠올렸습니다.',
];
const SCRIPT_PROMPTS_EN = [
  'This morning the weather was clear. Grandma put on her hat and went for a walk in the park. Beautiful flowers were in bloom—red roses and yellow sunflowers. Grandma took a deep breath of the floral scent and felt great.',
  'A cute puppy wagged its tail and came to greet Grandma on the bench. She gently petted the puppy, which barked happily. On the way home, Grandma met a neighbor and shared a warm smile. It was a happy day.',
  'A child found a little bird on the way to school. The bird chirped on a branch. The child greeted the bird, and it flapped its wings and flew away. The child joyfully told friends about the bird.',
  'Grandpa takes a morning walk in the park every day. Today he enjoyed the fresh air and birdsong while people exercised around him. Children were playing, and Grandpa smiled. After his walk, a warm breakfast awaited him at home.',
  'Spring arrived with colorful blossoms. The park was filled with yellow forsythia, pink cherry blossoms, and white magnolias. People took photos and enjoyed the flowers, while children laughed and ran through the flowerbeds.',
  'A family visited the seaside. The kids built sandcastles and listened to the waves. Mom told shell stories, and Dad breathed in the sea breeze. At sunset the family watched the glow together—a special memory for everyone.',
  'In autumn, leaves turned vibrant colors. Red maples and yellow ginkgos danced in the wind. Grandma enjoyed the crunch of fallen leaves and bought fresh vegetables at the market. Back home, she sipped warm tea remembering her walk.',
];
type LanguageOption = 'ko' | 'en';

const FOLLOWUP_MESSAGE = '분석 결과가 저장되었습니다. 건강 통계 > 지시문 읽기에서 확인할 수 있어요.';

const LANGUAGE_LABELS: Record<LanguageOption, string> = {
  ko: '한국어',
  en: 'English',
};

function pickRandomPrompt(current?: string, lang: LanguageOption = 'ko') {
  const pool = lang === 'en' ? SCRIPT_PROMPTS_EN : SCRIPT_PROMPTS_KO;
  const choices = pool.filter((prompt) => prompt !== current);
  return choices[Math.floor(Math.random() * choices.length)] ?? pool[0];
}

export default function ScriptReadingScreen() {
  const hydrate = usePhotoNotesStore((state) => state.hydrate);
  const addNote = usePhotoNotesStore((state) => state.addNote);

  const [recordingHandle, setRecordingHandle] = useState<RecordingHandle | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hasRecentResult, setHasRecentResult] = useState(false);
  const [language, setLanguage] = useState<LanguageOption>('ko');
  const [prompt, setPrompt] = useState(() => pickRandomPrompt(undefined, 'ko'));
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
    setPrompt((prev) => pickRandomPrompt(prev, language));
    setStatusMessage(null);
    setHasRecentResult(false);
  };

  const handleLanguageChange = (lang: LanguageOption) => {
    if (language === lang) return;
    setLanguage(lang);
    setPrompt((prev) => pickRandomPrompt(prev, lang));
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
        const transcript = await transcribeAudioDetailed(uri, { language });
        const metrics = calculateSpeechMetrics(transcript);
        const match = calculateScriptMatch(transcript.text ?? '', prompt);

        await addNote({
          imageId: SCRIPT_IMAGE_ID,
          description: transcript.text,
          audioUri: uri,
          transcript: transcript.text,
          metrics,
          kind: 'script',
          scriptPrompt: prompt,
          scriptMatchCount: match.matchCount,
          scriptTotalCount: match.totalCount,
        });

        setStatusMessage(
          `분석이 완료되었습니다. 지시문 정확도는 ${match.totalCount > 0 ? Math.round((match.matchCount / match.totalCount) * 100) : 0
          }% 입니다. 건강 통계 > 지시문 읽기에서 자세히 볼 수 있어요.`
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
    [addNote, prompt, language]
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
              <Text style={{ color: BrandColors.textSecondary, fontWeight: '700' }}>언어 선택</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['ko', 'en'] as LanguageOption[]).map((lang) => {
                  const active = language === lang;
                  return (
                    <Pressable
                      key={lang}
                      onPress={() => handleLanguageChange(lang)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: active ? BrandColors.primary : BrandColors.border,
                        backgroundColor: active ? BrandColors.primarySoft : BrandColors.surfaceSoft,
                      }}>
                      <Text style={{ color: active ? BrandColors.primary : BrandColors.textSecondary, fontWeight: '700' }}>
                        {LANGUAGE_LABELS[lang]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: '#707070ff', fontSize: 18, fontWeight: '700'}}>읽을 지시문</Text>
              <Text style={{ color: BrandColors.textSecondary, lineHeight: 32, fontSize: 28, fontWeight: 'bold' }}>{prompt}</Text>
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
