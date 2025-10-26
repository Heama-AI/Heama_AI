import { HaemayaMascot } from '@/components/HaemayaMascot';
import { BrandColors, Shadows } from '@/constants/theme';
import { mockLLMReply } from '@/lib/assistant';
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
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <View
      style={{
        marginVertical: 6,
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
      }}>
      <View
        style={{
          backgroundColor: isUser ? BrandColors.primary : BrandColors.surface,
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderBottomRightRadius: isUser ? 0 : 16,
          borderBottomLeftRadius: isUser ? 16 : 0,
          borderWidth: isUser ? 0 : 1,
          borderColor: isUser ? undefined : BrandColors.border,
          ...(!isUser ? {} : Shadows.card),
        }}>
        <Text style={{ color: isUser ? '#fff' : BrandColors.textPrimary, fontSize: 16, lineHeight: 22 }}>
          {message.text}
        </Text>
      </View>
      <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
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

function VoiceVisualizer({ active }: { active: boolean }) {
  const [levels, setLevels] = useState([0.25, 0.45, 0.35, 0.5, 0.3]);

  useEffect(() => {
    if (!active) {
      setLevels([0.2, 0.2, 0.2, 0.2, 0.2]);
      return undefined;
    }

    const interval = setInterval(() => {
      setLevels([
        Math.random(),
        Math.random(),
        Math.random(),
        Math.random(),
        Math.random(),
      ]);
    }, 120);

    return () => clearInterval(interval);
  }, [active]);

  if (!active) {
    return null;
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 26,
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: BrandColors.primarySoft,
      }}>
      {levels.map((level, index) => (
        <View
          key={index}
          style={{
            width: 4,
            borderRadius: 2,
            height: 8 + level * 16,
            backgroundColor: BrandColors.primary,
          }}
        />
      ))}
    </View>
  );
}

function RecordButton({
  recording,
  level,
  onPress,
  disabled,
}: {
  recording: boolean;
  level: number;
  onPress: () => void;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: recording ? 1 + Math.min(level, 1) * 0.35 + 0.1 : 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
  }, [recording, level, scale]);

  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ alignItems: 'center' }}>
      <Animated.View
        style={{
          transform: [{ scale }],
          width: 118,
          height: 118,
          borderRadius: 59,
          backgroundColor: recording ? BrandColors.primarySoft : BrandColors.secondarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          ...Shadows.floating,
        }}>
        <View
          style={{
            position: 'absolute',
            width: 118,
            height: 118,
            borderRadius: 59,
            borderWidth: 2,
            borderColor: recording ? BrandColors.accentSoft : 'rgba(255, 255, 255, 0.4)',
          }}
        />
        <View
          style={{
            width: 94,
            height: 94,
            borderRadius: 47,
            backgroundColor: recording ? BrandColors.primary : BrandColors.primaryDark,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: BrandColors.primary,
            shadowOpacity: recording ? 0.35 : 0.2,
            shadowRadius: 14,
          }}>
          <Ionicons name={recording ? 'stop' : 'mic'} size={32} color="#fff" />
        </View>
      </Animated.View>
      <Text style={{ marginTop: 16, color: recording ? BrandColors.primary : BrandColors.textSecondary, fontSize: 14 }}>
        {recording ? '녹음 중... 눌러서 종료' : '버튼을 눌러 말씀해주세요'}
      </Text>
    </Pressable>
  );
}

function HeaderActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'surface';
  disabled?: boolean;
}) {
  const background = variant === 'primary' ? BrandColors.primary : BrandColors.primarySoft;
  const textColor = variant === 'primary' ? '#fff' : BrandColors.primary;
  const disabledBackground = variant === 'primary' ? 'rgba(247, 201, 72, 0.35)' : BrandColors.primarySoft;
  const disabledTextColor = variant === 'primary' ? 'rgba(255, 255, 255, 0.8)' : BrandColors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: disabled ? disabledBackground : background,
        borderWidth: variant === 'surface' ? 1 : 0,
        borderColor: variant === 'surface' ? BrandColors.primarySoft : undefined,
      }}>
      <Text style={{ color: disabled ? disabledTextColor : textColor, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export default function Chat() {
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const { messages, addMessage, addAssistantMessage, isResponding, setResponding, reset } = useChatStore();
  const addRecord = useRecordsStore((state) => state.addRecordFromMessages);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingLevel, setRecordingLevel] = useState(0);
  const recordingHandleRef = useRef<RecordingHandle | null>(null);

  const lastAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant'),
    [messages],
  );

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
    };
  }, []);

  const sendTranscript = async (transcript: string) => {
    if (!transcript.trim() || isResponding) return;

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
      const assistantReply = await mockLLMReply(conversation, keywords);
      const assistantMessage = addAssistantMessage(assistantReply);
      scrollToEnd();
      stopSpeaking();
      await say(assistantMessage.text, {
        onStart: () => setIsSpeaking(true),
        onComplete: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch (error) {
      console.error(error);
      Alert.alert('대화 오류', '응답을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setResponding(false);
    }
  };

  const handleToggleRecording = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('웹 미지원', '웹 환경에서는 음성 녹음을 지원하지 않습니다. 모바일 기기에서 이용해주세요.');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      const handle = recordingHandleRef.current;
      recordingHandleRef.current = null;
      if (!handle) return;
      try {
        const recording = await handle.stop();
        setRecordingLevel(0);
        if (!recording) return;

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
      }
      return;
    }

    try {
      const handle = await startVoiceRecording({
        onLevel: (level) => setRecordingLevel(level),
      });
      recordingHandleRef.current = handle;
      setIsRecording(true);
    } catch (error) {
      console.error(error);
      Alert.alert('녹음 오류', '음성 입력을 시작할 수 없습니다.');
    }
  };

  const handleSaveRecord = () => {
    const chatMessages = useChatStore.getState().messages;
    if (chatMessages.length < 2) {
      Alert.alert('저장 불가', '대화가 조금 더 쌓인 후에 기록을 저장할 수 있어요.');
      return;
    }

    const record = addRecord({
      messages: chatMessages.map((message) => ({ ...message })),
      title: chatMessages.find((message) => message.role === 'user')?.text.slice(0, 18) ?? undefined,
    });

    Alert.alert('저장 완료', '기록 페이지에서 대화 요약을 확인할 수 있어요.', [
      { text: '기록 보기', onPress: () => router.push(`/records/${record.id}`) },
      { text: '계속 대화하기' },
    ]);
  };

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
          setIsRecording(false);
          setRecordingLevel(0);
          reset();
        },
      },
    ]);
  };

  const replayAssistantVoice = () => {
    if (lastAssistantMessage) {
      stopSpeaking();
      void say(lastAssistantMessage.text, {
        onStart: () => setIsSpeaking(true),
        onComplete: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      }).catch(() => setIsSpeaking(false));
    }
  };


  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: BrandColors.background }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, gap: 20 }}>
        <View
          style={{
            backgroundColor: BrandColors.surface,
            borderRadius: 28,
            padding: 24,
            gap: 16,
            ...Shadows.card,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <HaemayaMascot size={90} />
          <View style={{ flex: 1, gap: 6, marginLeft: 16 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: BrandColors.textPrimary }}>해마 기억 코치</Text>
            <Text style={{ color: BrandColors.textSecondary, lineHeight: 22 }}>
              GPT 기반 코치가 어르신의 이야기를 정리하고, 필요한 케어를 제안해드립니다.
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 16,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: BrandColors.border,
              backgroundColor: BrandColors.surfaceSoft,
            }}>
            <View>
              <Text style={{ fontSize: 14, color: BrandColors.textSecondary }}>오늘의 대화 준비 완료</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>
                음성으로 간편하게 기록하세요
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <HeaderActionButton label="요약 저장" onPress={handleSaveRecord} disabled={isResponding} />
              <HeaderActionButton label="새 대화" onPress={handleReset} variant="surface" disabled={isResponding} />
            </View>
          </View>
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: BrandColors.surface,
            borderRadius: 32,
            paddingVertical: 24,
            paddingHorizontal: 20,
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
              <View style={{ alignItems: 'center', marginTop: 80, paddingHorizontal: 24, gap: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>
                  첫 대화를 시작해보세요
                </Text>
                <Text style={{ color: BrandColors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
                  오늘 기억하고 싶은 일이나 걱정되는 점을 이야기하면, 기억 코치가 함께 정리해드려요.
                </Text>
              </View>
            }
            ListFooterComponent={isResponding ? <TypingIndicator /> : <View style={{ height: 24 }} />}
          />
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: 24,
          paddingVertical: 20,
          borderTopWidth: 1,
          borderColor: BrandColors.border,
          backgroundColor: BrandColors.surface,
          gap: 18,
          ...Shadows.card,
        }}>
        {lastAssistantMessage ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable
              onPress={replayAssistantVoice}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                backgroundColor: BrandColors.surfaceSoft,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: BrandColors.border,
              }}>
              <Text style={{ color: BrandColors.primary, fontWeight: '600' }}>마지막 답변 다시 듣기</Text>
            </Pressable>
            <VoiceVisualizer active={isSpeaking} />
          </View>
        ) : null}
        <RecordButton
          recording={isRecording}
          level={recordingLevel}
          onPress={handleToggleRecording}
          disabled={isResponding || isTranscribing}
        />
        {isTranscribing ? (
          <Text style={{ textAlign: 'center', color: BrandColors.textSecondary }}>음성을 문자로 변환 중이에요...</Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
