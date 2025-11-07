import { BrandColors, Shadows } from '@/constants/theme';
import { Pressable, Text, View } from 'react-native';

export default function CardButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ marginVertical: 6 }}>
      <View
        style={{
          backgroundColor: BrandColors.surface,
          borderRadius: 18,
          paddingVertical: 18,
          paddingHorizontal: 22,
          borderWidth: 1,
          borderColor: BrandColors.border,
          ...Shadows.card,
        }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>{title}</Text>
      </View>
    </Pressable>
  );
}
