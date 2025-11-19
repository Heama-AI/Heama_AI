import { BrandColors, Shadows } from '@/constants/theme';
import { IS_EXECUTORCH_ASSISTANT } from '@/lib/assistantConfig';
import { useAssistantEngine } from '@/lib/assistantEngine';
import { extractKeywords } from '@/lib/conversation';
import { say, stopSpeaking } from '@/lib/speech';
import { transcribeAudio } from '@/lib/stt';
import { startVoiceRecording, type RecordingHandle } from '@/lib/voice';
import { useChatStore } from '@/store/chatStore';
import { useRecordsStore } from '@/store/recordsStore';
import type { ChatMessage } from '@/types/chat';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <View
      style={{
        marginVertical: 6,
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '82%',
        width: 'auto',
      }}>
      <View
        style={{
          backgroundColor: isUser ? BrandColors.primary : BrandColors.surfaceSoft,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 18,
          borderBottomRightRadius: isUser ? 0 : 18,
          borderBottomLeftRadius: isUser ? 18 : 0,
          borderWidth: isUser ? 0 : 1,
          borderColor: isUser ? undefined : BrandColors.border,
          ...(!isUser ? {} : Shadows.card),
        }}>
        <Text
          style={{
            color: isUser ? '#fff' : BrandColors.textPrimary,
            fontSize: 16,
            lineHeight: 24,
            letterSpacing: 0.1,
          }}>
          {message.text}
        </Text>
      </View>
      <Text style={{ fontSize: 13, color: '#808080', marginTop: 6 }}>
        {new Date(message.ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}

function TypingIndicator() {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const dots = '.'.repeat(dotCount);

  return (
    <View style={{ marginVertical: 6, alignSelf: 'flex-start', maxWidth: '80%' }}>
      <View
        style={{
          backgroundColor: BrandColors.surface,
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderBottomLeftRadius: 0,
          borderWidth: 1,
          borderColor: BrandColors.border,
        }}>
        <Text style={{ color: BrandColors.primary, fontWeight: '600' }}>답변 생성 중{dots}</Text>
      </View>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const MAX_RECORDING_DURATION_MS = 60_000;
const COUNTDOWN_UPDATE_INTERVAL_MS = 200;
const INPUT_SECTION_HEIGHT = 220;

function formatDuration(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function RecordButton({
  recording,
  level,
  countdownRatio,
  countdownMs,
  onPress,
  disabled,
}: {
  recording: boolean;
  level: number;
  countdownRatio: number;
  countdownMs: number;
  onPress: () => void;
  disabled?: boolean;
}) {
  const countdown = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(countdown, {
      toValue: recording ? Math.max(0, Math.min(1, countdownRatio)) : 1,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [countdownRatio, recording, countdown]);

  const outerSize = 108;
  const strokeWidth = 4;
  const radius = (outerSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = countdown.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ alignItems: 'center' }}>
      <View
        style={{
          width: outerSize,
          height: outerSize,
          borderRadius: outerSize / 2,
          backgroundColor: recording ? BrandColors.primarySoft : BrandColors.secondarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          ...Shadows.floating,
        }}>
        <Svg width={outerSize} height={outerSize} style={{ position: 'absolute' }}>
          <Circle
            cx={outerSize / 2}
            cy={outerSize / 2}
            r={radius}
            stroke={recording ? BrandColors.accentSoft : 'rgba(255, 255, 255, 0.4)'}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {recording ? (
            <AnimatedCircle
              cx={outerSize / 2}
              cy={outerSize / 2}
              r={radius}
              stroke={BrandColors.primary}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={dashOffset}
              fill="none"
              transform={`rotate(-90 ${outerSize / 2} ${outerSize / 2})`}
            />
          ) : null}
        </Svg>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: recording ? BrandColors.primary : BrandColors.primaryDark,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: BrandColors.primary,
            shadowOpacity: recording ? 0.35 : 0.2,
            shadowRadius: 14,
          }}>
          <Ionicons name={recording ? 'stop' : 'mic'} size={32} color="#fff" />
        </View>
      </View>
      {recording ? (
        <Text
          style={{
            marginTop: 12,
            color: BrandColors.primary,
            fontSize: 14,
            textAlign: 'center',
          }}>
          남은 시간 {formatDuration(countdownMs)}
        </Text>
      ) : null}
    </Pressable>
  );
}

function HeaderActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'surface';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const background = variant === 'primary' ? BrandColors.primary : BrandColors.primarySoft;
  const textColor = variant === 'primary' ? '#fff' : BrandColors.primaryDark;
  const disabledBackground = variant === 'primary' ? 'rgba(247, 201, 72, 0.35)' : BrandColors.primarySoft;
  const disabledTextColor = variant === 'primary' ? 'rgba(255, 255, 255, 0.8)' : BrandColors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: 14,
          backgroundColor: disabled ? disabledBackground : background,
          borderWidth: variant === 'surface' ? 1 : 0,
          borderColor: variant === 'surface' ? BrandColors.primarySoft : undefined,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      <Text style={{ color: disabled ? disabledTextColor : textColor, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export default function Chat() {
  const { width } = useWindowDimensions();
  const isCompactHeader = width < 720;
  const isNarrow = width < 420;

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const { messages, addMessage, addAssistantMessage, isResponding, setResponding, reset, conversationId } =
    useChatStore();
  const addRecord = useRecordsStore((state) => state.addRecordFromMessages);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [recordingLevel, setRecordingLevel] = useState(0);
  const [recordingRemainingMs, setRecordingRemainingMs] = useState(MAX_RECORDING_DURATION_MS);
  const [textInput, setTextInput] = useState('');
  const recordingHandleRef = useRef<RecordingHandle | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingCountdownStartedAtRef = useRef<number | null>(null);
  const isStoppingRecordingRef = useRef(false);
  const insets = useSafeAreaInsets();
  const {
    generateReply: generateAssistantReply,
    isReady: isLLMReady,
    error: assistantError,
  } = useAssistantEngine();
  const blockingMessage = useMemo(() => {
    if (isSavingRecord) return '요약을 저장하는 중입니다.';
    if (isTranscribing) return '음성을 받아쓰는 중입니다.';
    if (isResponding) return 'AI 응답을 생성 중입니다.';
    if (isSpeaking) return '음성을 재생 중입니다.';
    return null;
  }, [isResponding, isSavingRecord, isSpeaking, isTranscribing]);

  function clearRecordingCountdown() {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    recordingCountdownStartedAtRef.current = null;
  }

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ animated: true, offset: Number.MAX_SAFE_INTEGER });
    });
  };

  useEffect(() => {
    return () => {
      stopSpeaking();
      if (recordingHandleRef.current) {
        void recordingHandleRef.current.stop({ discard: true });
        recordingHandleRef.current = null;
      }
      setIsTranscribing(false);
      clearRecordingCountdown();
    };
  }, []);

  const sendTranscript = async (transcript: string) => {
    if (!transcript.trim() || isResponding) return;
    if (!isLLMReady) {
      Alert.alert('AI 준비 중', '모델을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    if (assistantError) {
      Alert.alert(
        'AI 연결 오류',
        IS_EXECUTORCH_ASSISTANT
          ? '로컬 LLM을 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 앱을 다시 실행해주세요.'
          : 'OpenAI 연결 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      );
      return;
    }

    const text = transcript.trim();

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text,
      ts: Date.now(),
    };

    const conversation = [...messages, userMessage];

    addMessage(userMessage);
    scrollToEnd();
    setResponding(true);

    try {
      const keywords = extractKeywords(conversation);
      const assistantReply = await generateAssistantReply(conversation, keywords);
      let assistantMessage: ChatMessage | null = null;
      const ensureAssistantMessage = () => {
        if (!assistantMessage) {
          assistantMessage = addAssistantMessage(assistantReply);
          scrollToEnd();
          setResponding(false);
        }
        return assistantMessage;
      };
      stopSpeaking();
      void say(assistantReply, {
        onStart: () => {
          ensureAssistantMessage();
          setIsSpeaking(true);
        },
        onComplete: () => setIsSpeaking(false),
        onError: () => {
          ensureAssistantMessage();
          setIsSpeaking(false);
        },
      }).catch(() => {
        ensureAssistantMessage();
        setIsSpeaking(false);
      });
    } catch (error) {
      console.error(error);
      Alert.alert('대화 오류', '응답을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.');
      setResponding(false);
    }
  };

  const handleSendTextMessage = () => {
    const trimmed = textInput.trim();
    if (!trimmed || isResponding) return;
    setTextInput('');
    void sendTranscript(trimmed);
  };

  const stopActiveRecording = async (reason: 'manual' | 'timeout') => {
    if (!isRecording || isStoppingRecordingRef.current) return;
    isStoppingRecordingRef.current = true;
    clearRecordingCountdown();
    setIsRecording(false);
    setRecordingRemainingMs(MAX_RECORDING_DURATION_MS);

    const handle = recordingHandleRef.current;
    recordingHandleRef.current = null;
    if (!handle) {
      setRecordingLevel(0);
      isStoppingRecordingRef.current = false;
      return;
    }

    try {
      const recording = await handle.stop();
      setRecordingLevel(0);
      if (!recording) return;

      if (reason === 'timeout') {
        Alert.alert('녹음이 종료되었어요', '1분 제한 시간에 도달해 음성 입력을 마쳤어요.');
      }

      setIsTranscribing(true);
      try {
        const transcript = await transcribeAudio(recording.fileUri, { language: 'ko' });
        if (transcript) {
          await sendTranscript(transcript);
        }
      } catch (error) {
        console.error(error);
        Alert.alert('음성 인식 오류', '음성을 텍스트로 변환하지 못했습니다.');
      } finally {
        setIsTranscribing(false);
        await FileSystem.deleteAsync(recording.fileUri, { idempotent: true }).catch(() => undefined);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('음성 입력 오류', '음성 인식 결과를 가져오지 못했습니다.');
    } finally {
      isStoppingRecordingRef.current = false;
    }
  };

  const handleToggleRecording = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('웹 미지원', '웹 환경에서는 음성 녹음을 지원하지 않습니다. 모바일 기기에서 이용해주세요.');
      return;
    }

    if (isRecording) {
      void stopActiveRecording('manual');
      return;
    }

    if (isStoppingRecordingRef.current) return;

    try {
      const handle = await startVoiceRecording({
        onLevel: (level) => setRecordingLevel(level),
      });
      recordingHandleRef.current = handle;
      setIsRecording(true);
      setRecordingLevel(0);
      setRecordingRemainingMs(MAX_RECORDING_DURATION_MS);
      clearRecordingCountdown();
      recordingCountdownStartedAtRef.current = Date.now();
      countdownIntervalRef.current = setInterval(() => {
        if (!recordingCountdownStartedAtRef.current) return;
        const elapsed = Date.now() - recordingCountdownStartedAtRef.current;
        const remaining = Math.max(MAX_RECORDING_DURATION_MS - elapsed, 0);
        setRecordingRemainingMs(remaining);
        if (remaining <= 0) {
          setRecordingRemainingMs(0);
          clearRecordingCountdown();
          void stopActiveRecording('timeout');
        }
      }, COUNTDOWN_UPDATE_INTERVAL_MS);
    } catch (error) {
      console.error(error);
      Alert.alert('녹음 오류', '음성 입력을 시작할 수 없습니다.');
    }
  };

  const handleSaveRecord = useCallback(async () => {
    if (isSavingRecord) return;
    const chatMessages = useChatStore.getState().messages;
    if (chatMessages.length < 2) {
      Alert.alert('저장 불가', '대화가 조금 더 쌓인 후에 기록을 저장할 수 있어요.');
      return;
    }

    try {
      setIsSavingRecord(true);
      const record = await addRecord({
        messages: chatMessages.map((message) => ({ ...message })),
        title: chatMessages.find((message) => message.role === 'user')?.text.slice(0, 18) ?? undefined,
        conversationId,
      });

      Alert.alert('저장 완료', '기록 페이지에서 대화 요약을 확인할 수 있어요.', [
        { text: '기록 보기', onPress: () => router.push(`/records/${record.id}`) },
        { text: '계속 대화하기' },
      ]);
    } catch (error) {
      console.error('대화 기록 저장 실패', error);
      Alert.alert('저장 실패', '대화 기록을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSavingRecord(false);
    }
  }, [addRecord, conversationId, isSavingRecord]);

  const handleReset = () => {
    Alert.alert('새 대화 시작', '현재 대화를 초기화할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '초기화',
        style: 'destructive',
        onPress: async () => {
          stopSpeaking();
          setIsSpeaking(false);
          if (recordingHandleRef.current) {
            await recordingHandleRef.current.stop({ discard: true });
            recordingHandleRef.current = null;
          }
          clearRecordingCountdown();
          setIsRecording(false);
          setRecordingLevel(0);
          setRecordingRemainingMs(MAX_RECORDING_DURATION_MS);
          reset();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, gap: 20 }}>
          <View style={{ width: '100%' }}>
            <View
              style={{
                width: '100%',
                flexDirection: isCompactHeader ? 'column' : 'row',
                alignItems: isCompactHeader ? 'flex-start' : 'stretch',
                gap: isCompactHeader ? 16 : 18,
              }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text
                  style={{
                    fontSize: isNarrow ? 24 : 28,
                    fontWeight: '800',
                    color: BrandColors.textPrimary,
                  }}>
                  해마 기억 코치
                </Text>
                <Text style={{ color: BrandColors.textSecondary, lineHeight: 22 }}>
                  GPT 기반 코치가 어르신의 이야기를 정리하고, 필요한 케어를 제안해드립니다.
                </Text>
              </View>
              <View
                style={[
                  {
                    paddingHorizontal: isCompactHeader ? 16 : 18,
                    paddingVertical: isCompactHeader ? 10 : 12,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: BrandColors.border,
                    backgroundColor: BrandColors.surfaceSoft,
                    gap: 10,
                    alignSelf: 'stretch',
                  },
                  isCompactHeader ? { width: '100%' } : { flex: 1 },
                ]}>
                <Text
                  style={{
                    fontSize: isNarrow ? 16 : 18,
                    fontWeight: '700',
                    color: BrandColors.textPrimary,
                  }}>
                  음성으로 간편하게 기록하세요
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 10,
                    width: '100%',
                  }}>
                  <HeaderActionButton
                    label="요약 저장"
                    onPress={() => {
                      void handleSaveRecord();
                    }}
                    disabled={Boolean(blockingMessage)}
                    style={{ flex: 1 }}
                  />
                  <HeaderActionButton
                    label="새 대화"
                    onPress={handleReset}
                    variant="surface"
                    disabled={Boolean(blockingMessage)}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            </View>
          </View>
          <View
            style={{
              flex: 1.15,
              backgroundColor: BrandColors.surface,
              borderRadius: 32,
              paddingVertical: 28,
              paddingHorizontal: isNarrow ? 18 : 22,
              ...Shadows.card,
            }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: BrandColors.textPrimary, marginBottom: 12 }}>
              오늘의 대화
            </Text>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <MessageBubble message={item} />}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingVertical: 12 }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 72, paddingHorizontal: 24, gap: 10 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>대화를 시작해보세요</Text>
                  <Text style={{ color: BrandColors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
                    기억하고 싶은 일이나 걱정되는 점을 이야기해봐요!{"\n"} 해마가 함께 정리해드려요.
                  </Text>
                </View>
              }
              ListFooterComponent={isResponding ? <TypingIndicator /> : <View style={{ height: 24 }} />}
            />
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 12 + insets.bottom,
            borderTopWidth: 1,
            borderColor: BrandColors.border,
            backgroundColor: BrandColors.surface,
            gap: 14,
            height: INPUT_SECTION_HEIGHT,
          }}>
          <View style={{ flex: 1 }}>
            {blockingMessage ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: BrandColors.border,
                  borderRadius: 18,
                  backgroundColor: BrandColors.surfaceSoft,
                  paddingHorizontal: 16,
                  paddingVertical: 18,
                  alignItems: 'center',
                  gap: 8,
                  flex: 1,
                  justifyContent: 'center',
                }}>
                <ActivityIndicator size="large" color={BrandColors.primary} />
                <Text style={{ color: BrandColors.textPrimary, fontWeight: '800', textAlign: 'center', fontSize: 18 }}>
                  {blockingMessage}
                </Text>
                <Text style={{ color: BrandColors.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 20 }}>
                  잠시만 기다려주세요. 작업이 끝나면 자동으로 해제됩니다.
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1, justifyContent: 'space-between' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    borderWidth: 1,
                    borderColor: BrandColors.border,
                    borderRadius: 18,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    backgroundColor: BrandColors.surfaceSoft,
                  }}>
                  <TextInput
                    style={{
                      flex: 1,
                      minHeight: 20,
                      maxHeight: 96,
                      color: BrandColors.textPrimary,
                      fontSize: 16,
                      textAlignVertical: 'center',
                    }}
                    value={textInput}
                    onChangeText={setTextInput}
                    placeholder="텍스트로 입력할 수 있어요!"
                    placeholderTextColor={BrandColors.textSecondary}
                    multiline
                    maxLength={400}
                    editable={!blockingMessage}
                    returnKeyType="send"
                    blurOnSubmit
                    onSubmitEditing={handleSendTextMessage}
                  />
                  <Pressable
                    onPress={handleSendTextMessage}
                    disabled={!textInput.trim() || Boolean(blockingMessage)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: !textInput.trim() || blockingMessage ? BrandColors.surface : BrandColors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons
                      name="send"
                      size={20}
                      color={!textInput.trim() || blockingMessage ? BrandColors.textSecondary : '#fff'}
                    />
                  </Pressable>
                </View>
                <View style={{ alignItems: 'center', marginTop: 14 }}>
                  <RecordButton
                    recording={isRecording}
                    level={recordingLevel}
                    countdownRatio={Math.max(0, Math.min(1, recordingRemainingMs / MAX_RECORDING_DURATION_MS))}
                    countdownMs={recordingRemainingMs}
                    onPress={handleToggleRecording}
                    disabled={Boolean(blockingMessage)}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
