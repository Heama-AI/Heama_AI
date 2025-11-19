import { SummaryWorker } from '@/components/SummaryWorker';
import { ExecuTorchAssistantProvider } from '@/lib/assistant.executorch';
import { IS_EXECUTORCH_ASSISTANT } from '@/lib/assistantConfig';
import { useAssistantEngine } from '@/lib/assistantEngine';
import { queryClient } from '@/lib/queryClient';
import { IS_EXECUTORCH_SUMMARY } from '@/lib/summary/config';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useRecordsStore } from '@/store/recordsStore';
import { useSummaryWorkerStore } from '@/store/summaryWorkerStore';
import { QueryClientProvider } from '@tanstack/react-query';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  const setUserId = useAuthStore((state) => state.setUserId);
  const userId = useAuthStore((state) => state.userId);
  const hydrateChat = useChatStore((state) => state.hydrate);
  const hydrateRecords = useRecordsStore((state) => state.hydrate);
  const segments = useSegments();
  const router = useRouter();
  const { isReady } = useAssistantEngine();
  const isSummaryReady = useSummaryWorkerStore((state) => state.isModelReady);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setUserId(data.session?.user?.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setUserId]);

  useEffect(() => {
    if (!userId) return;

    const inAuthGroup = segments[0] === 'auth';
    const isModelSetup = segments[0] === 'model-setup';
    const assistantNotReady = IS_EXECUTORCH_ASSISTANT && !isReady;
    const summaryNotReady = IS_EXECUTORCH_SUMMARY && !isSummaryReady;

    if ((assistantNotReady || summaryNotReady) && !isModelSetup && !inAuthGroup) {
      // Avoid redirect loop if already on model-setup or in auth flow (which handles its own redirects)
      // But if we are deep in the app and models aren't ready, force redirect.
      // Note: We exclude auth group because sign-in/sign-up pages need to be accessible without models.
      // However, once logged in, they redirect to home/model-setup.
      // This check is primarily for when the user is already on a protected route.
      router.replace('/model-setup');
    }
  }, [userId, isReady, isSummaryReady, segments]);

  useEffect(() => {
    void hydrateChat();
    void hydrateRecords();
  }, [hydrateChat, hydrateRecords]);

  useEffect(() => {
    void Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    }).catch((error) => {
      if (__DEV__) {
        console.warn('Failed to configure audio mode', error);
      }
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          {IS_EXECUTORCH_ASSISTANT ? (
            <ExecuTorchAssistantProvider>
              <>
                {IS_EXECUTORCH_SUMMARY ? <SummaryWorker /> : null}
                <Stack
                  screenOptions={{
                    headerShown: false,
                    gestureEnabled: true,
                    fullScreenGestureEnabled: true,
                  }}
                />
              </>
            </ExecuTorchAssistantProvider>
          ) : (
            <>
              {IS_EXECUTORCH_SUMMARY ? <SummaryWorker /> : null}
              <Stack
                screenOptions={{
                  headerShown: false,
                  gestureEnabled: true,
                  fullScreenGestureEnabled: true,
                }}
              />
            </>
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
