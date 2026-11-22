import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { colors } from '@/theme';

import { Icon, type IconName } from './icons';
import { T } from './text';

/**
 * Clean 4+1 native dock matching the Vigas design system:
 * Home · Explore (News & Tools) · [Tactile Chat Keycap] · Ranks · API.
 */
const TABS: Record<string, { label: string; icon: IconName; center?: boolean }> = {
  index: { label: 'Home', icon: 'home' },
  explore: { label: 'Explore', icon: 'explore' },
  chat: { label: 'Chat', icon: 'spark', center: true },
  ranks: { label: 'Ranks', icon: 'ranks' },
  wallet: { label: 'API', icon: 'wallet' },
};

/** Routes that take the whole screen (the Chat artboard has no bottom navigation). */
const FULLSCREEN = new Set(['chat']);

export function VigasTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const focusedName = state.routes[state.index]?.name ?? '';
  if (FULLSCREEN.has(focusedName)) return null;

  return (
    <Animated.View
      entering={SlideInDown.duration(220).easing(Easing.out(Easing.cubic))}
      exiting={SlideOutDown.duration(160)}
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      {state.routes.map((route, index) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const focused = index === state.index;
        const label = descriptors[route.key]?.options.tabBarAccessibilityLabel ?? meta.label;
        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            if (meta.center) haptics.press();
            else haptics.select();
            navigateToTab(route.key);
          }
        };
        const onLongPress = () => {
          emitter.emit({ type: 'tabLongPress', target: route.key });
        };

        if (meta.center) {
          return <CenterKeyTab key={route.key} label={meta.label} accessibilityLabel={label} onPress={onPress} onLongPress={onLongPress} />;
        }

        return (
          <TabItem
            key={route.key}
            label={meta.label}
            accessibilityLabel={label}
            icon={meta.icon}
            focused={focused}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        );
      })}
    </Animated.View>
  );
}

/** Tactile 3D orange hardware keycap in the center of the dock for 1-tap AI Chat launch. */
function CenterKeyTab({
  label,
  accessibilityLabel,
  onPress,
  onLongPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const down = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: down.get() * 2.5 }] }));
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => down.set(withTiming(1, { duration: 60 }))}
      onPressOut={() => down.set(withTiming(0, { duration: 140 }))}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.centerSlot}
    >
      <View style={styles.keyWrap}>
        <View style={styles.keyEdge} />
        <Animated.View style={[styles.keyFace, face]}>
          <Icon name="spark" size={20} color={colors.onOrange} strokeWidth={2.2} />
        </Animated.View>
      </View>
      <T f="monoSemi" size={10.5} lh={1.2} color={colors.orangeText}>
        {label.toUpperCase()}
      </T>
    </Pressable>
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
        <Icon name={icon} size={21} color={focused ? colors.orange : colors.ink2} />
      </View>
      <T f={focused ? 'sansSemi' : 'sansMedium'} size={11.5} lh={1.2} color={focused ? colors.ink : colors.ink3}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.nav,
    borderTopWidth: 1,
    borderTopColor: colors.line2,
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  item: { flex: 1, alignItems: 'center', gap: 4, minHeight: 54, justifyContent: 'flex-end' },
  iconWrap: { width: 58, height: 32, alignItems: 'center', justifyContent: 'center' },
  pill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
    backgroundColor: 'rgba(255,106,26,0.16)',
  },
  centerSlot: { flex: 1, alignItems: 'center', gap: 4, minHeight: 54, justifyContent: 'flex-end' },
  keyWrap: { width: 52, height: 41, marginTop: -8 },
  keyEdge: {
    position: 'absolute',
    top: 3,
    left: 0,
    width: 52,
    height: 38,
    borderRadius: 14,
    backgroundColor: colors.orangeEdge,
  },
  keyFace: {
    width: 52,
    height: 38,
    borderRadius: 14,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
