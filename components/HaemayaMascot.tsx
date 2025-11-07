import { BrandColors, Shadows } from '@/constants/theme';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

type HaemayaMascotProps = {
  size?: number;
  withBadge?: boolean;
};

/**
 * Displays the Haemaya seahorse mascot. Ensure `assets/haemaya.png` exists.
 */
export function HaemayaMascot({ size = 140, withBadge = false }: HaemayaMascotProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: BrandColors.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: BrandColors.border,
        ...Shadows.card,
      }}>
      <Image
        source={require('@/assets/haemaya.png')}
        style={{ width: size * 0.8, height: size * 0.8 }}
        contentFit="contain"
      />
      {withBadge ? (
        <View
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            backgroundColor: BrandColors.primary,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
          }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>해마</Text>
        </View>
      ) : null}
    </View>
  );
}
