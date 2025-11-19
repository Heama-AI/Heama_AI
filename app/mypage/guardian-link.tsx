import { HaemayaMascot } from '@/components/HaemayaMascot';
import { BrandColors, Shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type UserProfile = {
  id?: string;
  email?: string;
  name?: string;
};

const BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL;
const GUARDIAN_LINK_PATH = process.env.EXPO_PUBLIC_GUARDIAN_LINK_PATH ?? '/care/guardians/link';

export default function GuardianLink() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>();
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const insets = useSafeAreaInsets();

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => {
        const user = data.user;
        if (!user) return;
        setUserProfile({
          id: user.id,
          email: user.email ?? undefined,
          name: (user.user_metadata as { name?: string } | null)?.name ?? undefined,
        });
      })
      .catch(() => {
        // ignore fetch errors; handled on submit
      });
  }, []);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert('이메일 입력', '연동할 보호자 이메일을 입력해주세요.');
      return;
    }

    if (!BACKEND_BASE_URL) {
      Alert.alert(
        '연동 서버 미설정',
        'EXPO_PUBLIC_BACKEND_BASE_URL 혹은 EXPO_PUBLIC_API_BASE_URL 환경 변수를 설정해주세요.',
      );
      return;
    }

    setSubmitting(true);
    setStatusMessage(undefined);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        throw new Error('로그인 정보를 불러올 수 없습니다. 다시 로그인해 주세요.');
      }

      const user = data.user;
      const payload = {
        guardianEmail: trimmedEmail,
        patient: {
          id: user.id,
          email: user.email,
          name: (user.user_metadata as { name?: string } | null)?.name ?? undefined,
        },
      };

      const endpoint = `${BACKEND_BASE_URL.replace(/\/$/, '')}${GUARDIAN_LINK_PATH.startsWith('/') ? '' : '/'}${GUARDIAN_LINK_PATH}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const bodyText = await response.text();
      let parsed: { message?: string } | null = null;
      try {
        parsed = bodyText ? (JSON.parse(bodyText) as { message?: string }) : null;
      } catch {
        parsed = null;
      }

      if (!response.ok) {
        const errorMessage = parsed?.message ?? '보호자 연동 요청에 실패했습니다.';
        throw new Error(errorMessage);
      }

      const successMessage = parsed?.message ?? '보호자에게 초대 메일을 전송했어요.';
      setEmail('');
      setStatusMessage(successMessage);
      Alert.alert('연동 요청 완료', successMessage);
    } catch (err) {
      const message = err instanceof Error ? err.message : '연동 요청 중 문제가 발생했습니다.';
      setStatusMessage(message);
      Alert.alert('연동 실패', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: 40 + insets.bottom,
          gap: 20,
        }}>
        <View
          style={{
            backgroundColor: BrandColors.surface,
            borderRadius: 28,
            padding: 24,
            gap: 16,
            ...Shadows.card,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <HaemayaMascot size={78} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 26, fontWeight: '800', color: BrandColors.textPrimary }}>보호자 연동하기</Text>
              <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>
                보호자 이메일을 입력하면 계정 정보를 함께 전달해 드려요. 초대 링크로 기록을 공유할 수 있습니다.
              </Text>
            </View>
          </View>

         
        </View>

        <View
          style={{
            backgroundColor: BrandColors.surface,
            borderRadius: 28,
            padding: 22,
            gap: 14,
            ...Shadows.card,
          }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary }}>계정 정보</Text>
          <InfoRow label="이름" value={userProfile.name ?? '이름 정보 없음'} />
          <InfoRow label="이메일" value={userProfile.email ?? '이메일 정보 없음'} />
        </View>

        <View
          style={{
            backgroundColor: BrandColors.surface,
            borderRadius: 28,
            padding: 22,
            gap: 14,
            ...Shadows.card,
          }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary }}>연동 대상 입력</Text>
          <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>
            초대할 보호자 이메일을 입력하면 현재 사용자 정보와 함께 백엔드로 전달됩니다.
          </Text>
          <View style={{ gap: 10 }}>
            <TextInput
              placeholder="보호자 이메일 주소"
              placeholderTextColor={BrandColors.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: BrandColors.border,
                backgroundColor: BrandColors.surfaceSoft,
                paddingHorizontal: 16,
                paddingVertical: 14,
                color: BrandColors.textPrimary,
                fontSize: 15,
              }}
            />

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={{
                opacity: submitting ? 0.7 : 1,
                backgroundColor: BrandColors.primary,
                paddingVertical: 15,
                borderRadius: 18,
                alignItems: 'center',
              }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
                {submitting ? '연동 요청 중...' : '연동 요청 보내기'}
              </Text>
            </Pressable>

            {statusMessage ? (
              <View
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: BrandColors.border,
                  backgroundColor: BrandColors.surfaceSoft,
                  padding: 12,
                }}>
                <Text style={{ color: BrandColors.textSecondary, fontSize: 13, lineHeight: 18 }}>{statusMessage}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View
          style={{
            backgroundColor: BrandColors.surface,
            borderRadius: 26,
            padding: 20,
            gap: 12,
            borderWidth: 1,
            borderColor: BrandColors.border,
          }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: BrandColors.textPrimary }}>연동 가이드</Text>
          <GuideRow
            icon="mail"
            title="초대 메일 발송"
            description="입력한 이메일 주소로 보호자 초대 메일과 연동 코드가 전송됩니다."
          />
          <GuideRow
            icon="shield-checkmark"
            title="정보 검증"
            description="사용자 ID, 이름, 이메일을 함께 전달하여 보호자 계정에서 확인할 수 있습니다."
          />
          <GuideRow
            icon="people"
            title="연동 완료"
            description="보호자가 초대 링크를 열고 연결을 승인하면 기록 공유가 시작됩니다."
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: BrandColors.surfaceSoft,
        borderWidth: 1,
        borderColor: BrandColors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
      }}>
      <Text style={{ color: BrandColors.textSecondary, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: BrandColors.textPrimary, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

function GuideRow({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          backgroundColor: BrandColors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={icon} size={18} color={BrandColors.textPrimary} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: BrandColors.textPrimary }}>{title}</Text>
        <Text style={{ color: BrandColors.textSecondary, lineHeight: 19 }}>{description}</Text>
      </View>
    </View>
  );
}
