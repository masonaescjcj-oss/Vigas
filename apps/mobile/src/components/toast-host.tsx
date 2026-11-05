import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '@/lib/toast';
import { colors } from '@/theme';

import { Icon } from './icons';
import { T } from './text';

/** Renders the current toast above the navigation bar. Mounted once in the root layout. */
export function ToastHost() {
  const msg = useToast();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 92 }]}>
      {msg ? (
        <Animated.View
          key={msg.id}
          entering={FadeInDown.duration(200)}
          exiting={FadeOutDown.duration(160)}
          accessibilityLiveRegion="polite"
          style={styles.toast}
        >
          {msg.tone === 'success' ? <Icon name="check" size={16} color={colors.green} /> : null}
          {msg.tone === 'error' ? <Icon name="info" size={16} color={colors.red} /> : null}
          <T f="sansMedium" size={14} lh={1.3} style={styles.text}>
            {msg.text}
          </T>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.strong,
    borderWidth: 1,
    borderColor: colors.line2,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  text: { flexShrink: 1 },
});
