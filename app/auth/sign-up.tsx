import { HaemayaMascot } from '@/components/HaemayaMascot';
import { BrandColors, Shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !name) {
      Alert.alert('입력 오류', '이메일, 비밀번호, 이름을 모두 입력해주세요.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('비밀번호 확인', '비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    setLoading(false);

    if (error) {
      Alert.alert('회원가입 실패', error.message);
      return;
    }

    Alert.alert('회원가입 완료', '이메일로 전송된 인증을 완료한 후 로그인해주세요.');
    router.replace('/auth/sign-in');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BrandColors.background }}
      contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }}>
      <View
        style={{
          gap: 18,
          backgroundColor: BrandColors.surface,
          borderRadius: 28,
          padding: 28,
          ...Shadows.card,
        }}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <HaemayaMascot size={120} />
          <Text style={{ fontSize: 28, fontWeight: '800', color: BrandColors.textPrimary }}>해마 새 계정 만들기</Text>
          <Text style={{ fontSize: 14, color: BrandColors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
            보호자 연동과 기록 관리를 위해 기본 정보를 입력해주세요.
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          <StyledInput placeholder="이름" value={name} onChangeText={setName} />
          <StyledInput
            placeholder="이메일"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <StyledInput placeholder="비밀번호" value={password} onChangeText={setPassword} secureTextEntry />
          <StyledInput placeholder="비밀번호 확인" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        </View>

        <View style={{ gap: 12 }}>
          <AuthButton label={loading ? '처리 중...' : '회원가입'} onPress={handleSignUp} disabled={loading} />
          <AuthButton label="로그인으로 돌아가기" variant="outline" onPress={() => router.replace('/auth/sign-in')} disabled={loading} />
        </View>
      </View>
    </ScrollView>
  );
}

function StyledInput({
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
}: {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <TextInput
      placeholder={placeholder}
      placeholderTextColor={BrandColors.textSecondary}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
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
