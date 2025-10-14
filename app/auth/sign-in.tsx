import { HaemayaMascot } from '@/components/HaemayaMascot';
import { BrandColors, Shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setUserId = useAuthStore((s) => s.setUserId);
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    if (userId) {
      router.replace('/home');
    }
  }, [userId]);

  const onSignIn = async () => {
    if (!email || !password) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('로그인 실패', error.message);
      return;
    }

    if (data.user) {
      setUserId(data.user.id);
      Alert.alert('로그인 성공', '메인 화면으로 이동합니다.');
      router.replace('/home');
    }
  };

  const goToSignUp = () => {
    router.push('/auth/sign-up');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BrandColors.background }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      <View
        style={{
          backgroundColor: BrandColors.surface,
          borderRadius: 28,
          padding: 28,
          gap: 20,
          ...Shadows.card,
        }}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <HaemayaMascot size={120} />
          <Text style={{ fontSize: 28, fontWeight: '800', color: BrandColors.textPrimary }}>해마에 오신 걸 환영해요</Text>
          <Text style={{ fontSize: 14, color: BrandColors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
            등록된 이메일과 비밀번호로 로그인해 케어를 이어가세요.
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          <TextInput
            placeholder="이메일 주소"
            placeholderTextColor={BrandColors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={{
              borderWidth: 1,
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderColor: BrandColors.border,
              backgroundColor: BrandColors.surfaceSoft,
              fontSize: 15,
              color: BrandColors.textPrimary,
            }}
          />
          <TextInput
            placeholder="비밀번호"
            placeholderTextColor={BrandColors.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={{
              borderWidth: 1,
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderColor: BrandColors.border,
              backgroundColor: BrandColors.surfaceSoft,
              fontSize: 15,
              color: BrandColors.textPrimary,
            }}
          />
        </View>

        <View style={{ gap: 12 }}>
          <AuthButton label={loading ? '처리 중...' : '로그인'} onPress={onSignIn} disabled={loading} />
          <AuthButton label="회원가입" variant="outline" onPress={goToSignUp} disabled={loading} />
        </View>
      </View>
    </ScrollView>
  );
}

function AuthButton({
  label,
  onPress,
  variant = 'solid',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'outline';
  disabled?: boolean;
}) {
  const backgroundColor =
    variant === 'solid' ? BrandColors.primary : BrandColors.surface;
  const textColor = variant === 'solid' ? '#fff' : BrandColors.textPrimary;
  const borderColor = variant === 'solid' ? 'transparent' : BrandColors.border;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        opacity: disabled ? 0.7 : 1,
        paddingVertical: 16,
        borderRadius: 18,
        alignItems: 'center',
        backgroundColor,
        borderWidth: 2,
        borderColor,
      }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: textColor }}>{label}</Text>
    </Pressable>
  );
}
