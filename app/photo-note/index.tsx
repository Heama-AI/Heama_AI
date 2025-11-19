import { BrandColors, Shadows } from '@/constants/theme';
import { calculateSpeechMetrics } from '@/lib/analysis/speechMetrics';
import { transcribeAudioDetailed } from '@/lib/stt';
import { startVoiceRecording, type RecordingHandle } from '@/lib/voice';
import { usePhotoNotesStore } from '@/store/photoNotesStore';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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

const IMAGE_ID = 'test-image';
const IMAGE_SOURCE = require('@/assets/test_image.png');

const FOLLOWUP_MESSAGE = '고생하셨습니다! 건강 통계 > 사진 설명에서 지표를 확인하고, 다음 달에도 다시 측정해 주세요.';

export default function PhotoNoteScreen() {
  const hydrate = usePhotoNotesStore((state) => state.hydrate);
  const addNote = usePhotoNotesStore((state) => state.addNote);

  const [recordingHandle, setRecordingHandle] = useState<RecordingHandle | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hasRecentResult, setHasRecentResult] = useState(false);
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

  const handleStartRecording = useCallback(async () => {
    try {
      setStatusMessage(null);
      setHasRecentResult(false);
      const handle = await startVoiceRecording();
      setRecordingHandle(handle);
      setIsRecording(true);
    } catch (error) {
      console.error('녹음 시작 실패', error);
      Alert.alert('녹음 실패', error instanceof Error ? error.message : '마이크를 사용할 수 없습니다.');
    }
  }, []);

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
        await addNote({
          imageId: IMAGE_ID,
          description: transcript.text,
          audioUri: uri,
          transcript: transcript.text,
          metrics,
        });
        setStatusMessage('분석 결과가 저장되었습니다. 건강 통계 > 사진 설명에서 확인해 주세요.');
        setHasRecentResult(true);
      } catch (error) {
        console.error('오디오 처리 실패', error);
        setStatusMessage('음성을 문자로 변환하지 못했습니다. 직접 내용을 적어주세요.');
        Alert.alert('인식 실패', error instanceof Error ? error.message : '파일 처리 중 문제가 발생했습니다.');
      } finally {
        setIsTranscribing(false);
      }
    },
    [],
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

  const handlePickAudioFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: false });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      await processAudioFile(result.assets[0].uri);
    } catch (error) {
      console.error('오디오 파일 선택 실패', error);
      Alert.alert('파일 선택 실패', error instanceof Error ? error.message : '오디오 파일을 불러오지 못했습니다.');
    }
  }, [processAudioFile]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          title: '사진 설명 메모',
        }}
      />
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
          }}
          keyboardShouldPersistTaps="handled">
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 30, fontWeight: '800', color: BrandColors.textPrimary }}>사진 설명 기록</Text>
            <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>
              사진을 보며 떠오른 이야기를 음성으로 남기고 텍스트로 정리해 보세요.
            </Text>
          </View>

          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 26,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: BrandColors.border,
              ...Shadows.card,
            }}>
            <Image source={IMAGE_SOURCE} style={{ width: '100%', aspectRatio: 3 / 2 }} contentFit="cover" transition={200} />
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
              <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>음성으로 설명 남기기</Text>
              <Text style={{ color: BrandColors.textSecondary }}>
                버튼을 눌러 녹음을 시작하고 설명을 들려주세요. 종료하면 자동으로 글자로 변환돼요.
              </Text>
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
            <Pressable
              onPress={handlePickAudioFile}
              disabled={isTranscribing}
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: BrandColors.border,
                paddingVertical: 14,
                alignItems: 'center',
                backgroundColor: isTranscribing ? BrandColors.surface : BrandColors.surfaceSoft,
              }}>
              <Text style={{ color: BrandColors.textPrimary, fontWeight: '600' }}>
                오디오 파일 불러오기
              </Text>
            </Pressable>

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
