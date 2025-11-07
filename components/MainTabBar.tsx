import { BrandColors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import { memo, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_ITEMS: Record<
  string,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon?: keyof typeof Ionicons.glyphMap;
  }
> = {
  home: { label: '홈', icon: 'home-outline', activeIcon: 'home' },
  quiz: { label: '퀴즈', icon: 'game-controller-outline', activeIcon: 'game-controller' },
  menu: { label: '메뉴', icon: 'grid-outline', activeIcon: 'grid' },
  profile: { label: '내 정보', icon: 'person-circle-outline', activeIcon: 'person-circle' },
};

function MainTabBarComponent({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = useMemo(() => state.routes.filter((route) => TAB_ITEMS[route.name]), [state.routes]);

  return (
    <View
      style={{
        paddingBottom: Math.max(insets.bottom, 12),
        paddingTop: 16,
        paddingHorizontal: 24,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderColor: 'rgba(17, 24, 39, 0.08)',
        position: 'relative',
      }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {routes.map((route, index) => {
          const focused = state.index === state.routes.findIndex((r) => r.key === route.key);
          const item = TAB_ITEMS[route.name];
          if (!item) return null;

          const iconName = (focused ? item.activeIcon : item.icon) ?? item.icon;

          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              style={{
                flex: 1,
                alignItems: 'center',
              }}>
              <Ionicons
                name={iconName}
                size={24}
                color={focused ? BrandColors.primary : BrandColors.textSecondary}
              />
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: focused ? BrandColors.primary : BrandColors.textSecondary,
                  fontWeight: focused ? '700' : '500',
                }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => router.push('/chat')}
        style={{
          position: 'absolute',
          alignSelf: 'center',
          top: -32,
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: BrandColors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: BrandColors.primary,
          shadowOpacity: 0.35,
          shadowRadius: 12,
          borderWidth: 4,
          borderColor: '#fff',
        }}>
        <Ionicons name="mic" color="#fff" size={28} />
      </Pressable>
    </View>
  );
}

export const MainTabBar = memo(MainTabBarComponent);
