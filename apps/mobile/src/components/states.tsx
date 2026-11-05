import { router } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { colors, GUTTER } from '@/theme';

import { GhostButton, KeyButton } from './buttons';
import { Icon, type IconName, LogoMark } from './icons';
import { Heading, Label, Span, T } from './text';

/** Thin notice shown when a screen is running on the bundled demo data. */
export function OfflineNote({ onRetry, style }: { onRetry?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeIn.duration(250)} style={[styles.offline, style]}>
      <Icon name="wifiOff" size={16} color={colors.ink3} />
      <T f="mono" size={12} color={colors.ink3} style={styles.flex}>
        Offline · showing demo data
      </T>
      {onRetry ? (
        <T f="sansMedium" size={13} color={colors.indigo} onPress={onRetry} accessibilityRole="button" style={styles.retry}>
          Retry
        </T>
      ) : null}
    </Animated.View>
  );
}

/** Full-width error card with a retry button. */
export function ErrorCard({ message, onRetry, style }: { message: string; onRetry?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeIn.duration(250)} style={[styles.card, style]}>
      <Icon name="wifiOff" size={22} color={colors.ink2} />
      <T size={15} color={colors.ink2} style={styles.cardText}>
        {message}
      </T>
      {onRetry ? <GhostButton label="Try again" onPress={onRetry} icon={<Icon name="regenerate" size={16} />} /> : null}
    </Animated.View>
  );
}

export interface SignInCardProps {
  title: string;
  italic?: string;
  body: string;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

/** Shown in place of signed-in features (wallet, keys) when there's no session. */
export function SignInCard({ title, italic, body, icon = 'lock', style }: SignInCardProps) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={[styles.signIn, style]}>
      <View style={styles.rings} pointerEvents="none">
        <View style={[styles.ring, styles.ringOuter]} />
        <View style={[styles.ring, styles.ringInner]} />
      </View>
      <View style={styles.signInIcon}>
        <Icon name={icon} size={20} color={colors.orange} />
      </View>
      <Heading size={32} lh={1.05} style={styles.signInTitle}>
        {title}
        {italic ? (
          <Span f="serifItalic" color={colors.sand}>
            {' '}
            {italic}
          </Span>
        ) : null}
      </Heading>
      <T size={15} color={colors.ink2}>
        {body}
      </T>
      <KeyButton label="Sign in" height={50} fontSize={16} onPress={() => router.push('/sign-in')} style={styles.signInBtn} />
      <T size={13} color={colors.ink3} align="center">
        New to Vigas?{' '}
        <Span f="sansMedium" color={colors.indigo} onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'signup' } })} accessibilityRole="link">
          Create an account
        </Span>
      </T>
    </Animated.View>
  );
}

/** Centered empty state with the logo mark. */
export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <LogoMark size={28} color={colors.pillar} />
      <Label>{title}</Label>
      {body ? (
        <T size={14} color={colors.ink3} align="center">
          {body}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: GUTTER,
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg2,
  },
  retry: { paddingVertical: 8, paddingHorizontal: 4 },
  card: {
    marginHorizontal: GUTTER,
    padding: 18,
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'flex-start',
  },
  cardText: { alignSelf: 'stretch' },
  signIn: {
    marginHorizontal: GUTTER,
    padding: 22,
    gap: 12,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  rings: { position: 'absolute', right: -30, top: -30, width: 150, height: 150 },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 1 },
  ringOuter: { width: 150, height: 150, borderColor: 'rgba(255,106,26,0.25)' },
  ringInner: { width: 100, height: 100, right: -6 + 30, top: -6 + 30, borderColor: 'rgba(255,106,26,0.18)' },
  signInIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.orangeSoft,
  },
  signInTitle: { marginTop: 4 },
  signInBtn: { marginTop: 6 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 32 },
});
