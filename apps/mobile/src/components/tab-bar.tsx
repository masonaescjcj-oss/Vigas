import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { colors } from '@/theme';

import { Icon, type IconName } from './icons';
import { T } from './text';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  explore: { label: 'Explore', icon: 'explore' },
  chat: { label: 'Chat', icon: 'chat' },
  ranks: { label: 'Ranks', icon: 'ranks' },
  wallet: { label: 'Wallet', icon: 'wallet' },
};

/** Routes that take the whole screen (the Chat artboard has no bottom navigation). */
const FULLSCREEN = new Set(['chat']);

/** Material 3 navigation bar with a pill-shaped active indicator. */
export function VigasTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const focusedName = state.routes[state.index]?.name ?? '';
  if (FULLSCREEN.has(focusedName)) return null;

  return (
    <Animated.View
      entering={SlideInDown.duration(220).easing(Easing.out(Easing.cubic))}
      exiting={SlideOutDown.duration(160)}
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 14) }]}
    >
      {state.routes.map((route, index) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const focused = index === state.index;
        const label = descriptors[route.key]?.options.tabBarAccessibilityLabel ?? meta.label;
        return (
          <TabItem
            key={route.key}
            label={meta.label}
            accessibilityLabel={label}
            icon={meta.icon}
            focused={focused}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                haptics.select();
                navigateToTab(route.key);
              }
            }}
            onLongPress={() => {
              emitter.emit({ type: 'tabLongPress', target: route.key });
            }}
          />
        );
      })}
    </Animated.View>
  );
}

interface TabItemProps {
  label: string;
  accessibilityLabel: string;
  icon: IconName;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({ label, accessibilityLabel, icon, focused, onPress, onLongPress }: TabItemProps) {
  const p = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(focused ? 1 : 0, { duration: 240, easing: Easing.out(Easing.cubic) }));
  }, [focused, p]);
  const pill = useAnimatedStyle(() => ({
    opacity: p.get(),
    transform: [{ scaleX: 0.55 + 0.45 * p.get() }],
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
    >
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.pill, pill]} />
        <Icon name={icon} size={22} color={focused ? colors.orange : colors.ink2} />
      </View>
      <T f="sansMedium" size={12} lh={1.2} color={focused ? colors.ink : colors.ink3}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.nav,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  item: { flex: 1, alignItems: 'center', gap: 4, minHeight: 56 },
  iconWrap: { width: 64, height: 32, alignItems: 'center', justifyContent: 'center' },
  pill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
    backgroundColor: 'rgba(255,106,26,0.16)',
  },
});
