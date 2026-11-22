import { router, usePathname } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSyncExternalStore } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { checkoutUrl } from '@/lib/api';
import { navStamp, usd } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useSession, userInitials } from '@/lib/session';
import { toast } from '@/lib/toast';
import { useWallet } from '@/lib/wallet';
import { colors, GUTTER, radius } from '@/theme';

import { FlutedRule, Led, Tag } from './boxes';
import { KeyButton } from './buttons';
import { Icon, LogoMark, type IconName } from './icons';
import { Avatar } from './monogram';
import { IconButton, PressableScale } from './pressable';
import { Label, Span, T } from './text';

/** Tiny global toggle so any screen's header button can open the native slide-over drawer. */
let isOpen = false;
const listeners = new Set<() => void>();

export function openMenu() {
  if (isOpen) return;
  haptics.select();
  isOpen = true;
  listeners.forEach((l) => l());
}

export function closeMenu() {
  if (!isOpen) return;
  isOpen = false;
  listeners.forEach((l) => l());
}

function useMenuOpen() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => isOpen,
    () => isOpen,
  );
}

/** Top-left menu trigger shared across primary screens. */
export function MenuTrigger() {
  return <IconButton icon="menu" accessibilityLabel="Open menu" onPress={openMenu} color={colors.ink} />;
}

/** Top-right compact API / Wallet pill (balance when signed in, API key prompt when guest). */
export function WalletPill() {
  const { token } = useSession();
  const wallet = useWallet();
  const label = token && wallet.data ? usd(wallet.data.balanceMicros) : token ? 'API' : 'Sign in';
  return (
    <PressableScale
      accessibilityLabel={token ? 'Open Wallet and API keys' : 'Sign in to Vigas'}
      onPress={() => (token ? router.navigate('/wallet') : router.push('/sign-in'))}
      style={[styles.walletPill, token && styles.walletPillSigned]}
      haptic="tap"
    >
      <Led color={token ? colors.green : colors.orange} size={6} still={!token} />
      <T f="monoSemi" size={12} color={token ? colors.ink : colors.orangeText} numberOfLines={1}>
        {label}
      </T>
    </PressableScale>
  );
}

interface NavRow {
  id: string;
  label: string;
  sub: string;
  icon: IconName;
  badge?: string;
  badgeColor?: string;
  match?: string;
  onPress: () => void;
}

export function MenuDrawer() {
  const visible = useMenuOpen();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { token, user } = useSession();
  const wallet = useWallet();

  if (!visible) return null;

  const go = (fn: () => void) => {
    closeMenu();
    haptics.select();
    fn();
  };

  const openTopup = async () => {
    closeMenu();
    const url = checkoutUrl(25);
    try {
      await WebBrowser.openBrowserAsync(url, { toolbarColor: colors.bg, controlsColor: colors.orange });
    } catch {
      try {
        await Linking.openURL(url);
      } catch {
        toast('Could not open vigas.app.', 'error');
      }
    }
  };

  const primary: NavRow[] = [
    { id: 'home', label: 'Home', sub: 'Live rates · Colonnade · Briefs', icon: 'home', match: '/', onPress: () => router.navigate('/') },
    {
      id: 'pulse',
      label: 'Pulse Feed',
      sub: 'Prompts · Battles · UI designs',
      icon: 'pulse',
      badge: 'NEW',
      badgeColor: colors.orange,
      match: '/pulse',
      onPress: () => router.navigate('/pulse'),
    },
    {
      id: 'chat',
      label: 'AI Chat',
      sub: 'Multi-model studio · Auto route',
      icon: 'chat',
      match: '/chat',
      onPress: () => router.navigate({ pathname: '/chat', params: { mode: 'chat', t: navStamp() } }),
    },
    {
      id: 'arena',
      label: 'Blind Arena',
      sub: 'Compare two hidden models live',
      icon: 'arena',
      badge: 'LIVE',
      badgeColor: colors.sand,
      onPress: () => router.navigate({ pathname: '/chat', params: { mode: 'arena', t: navStamp() } }),
    },
    {
      id: 'ranks',
      label: 'Leaderboard',
      sub: 'Win share · Cost per task',
      icon: 'ranks',
      match: '/ranks',
      onPress: () => router.navigate('/ranks'),
    },
  ];

  const directory: NavRow[] = [
    {
      id: 'models',
      label: 'Models & API Rates',
      sub: '26 frontier models · 1 endpoint',
      icon: 'layers',
      onPress: () => router.navigate({ pathname: '/explore', params: { seg: 'models', t: navStamp() } }),
    },
    {
      id: 'tools',
      label: 'Tools & 30s Connect',
      sub: 'Cursor · Cline · Claude Code · n8n',
      icon: 'plug',
      onPress: () => router.navigate({ pathname: '/explore', params: { seg: 'tools', t: navStamp() } }),
    },
    {
      id: 'news',
      label: 'AI Newsroom',
      sub: 'Model drops · Benchmarks · Policy',
      icon: 'news',
      onPress: () => router.navigate({ pathname: '/explore', params: { seg: 'news', t: navStamp() } }),
    },
  ];

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={closeMenu}>
      <View style={styles.overlay}>
        <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={closeMenu} style={styles.scrim} />
        </Animated.View>

        <Animated.View
          entering={SlideInLeft.springify().damping(24).stiffness(230)}
          style={[styles.drawer, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <View style={styles.top}>
            <LogoMark size={22} />
            <T f="serif" size={26} lh={1.05} style={styles.brand}>
              Vigas
            </T>
            <Tag text="API v1" color={colors.sand} />
            <View style={styles.flex} />
            <IconButton icon="close" accessibilityLabel="Close menu" onPress={closeMenu} color={colors.ink2} />
          </View>

          <FlutedRule style={styles.rule} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Account / Balance architectural box */}
            <PressableScale
              accessibilityLabel={token ? 'Open API Console and Wallet' : 'Sign in to Vigas'}
              onPress={() => go(() => (token ? router.navigate('/wallet') : router.push('/sign-in')))}
              style={styles.accountBox}
            >
              {token ? (
                <Avatar text={userInitials(user)} size={40} />
              ) : (
                <View style={styles.guestBadge}>
                  <Icon name="key" size={18} color={colors.orange} />
                </View>
              )}
              <View style={styles.flex}>
                <Label color={colors.sand}>{token ? 'API Console' : 'One key · Every model'}</Label>
                <T f="serif" size={24} lh={1.08} numberOfLines={1}>
                  {token && wallet.data ? usd(wallet.data.balanceMicros) : token ? 'Wallet & Keys' : 'Sign in / Create key'}
                </T>
                <T f="mono" size={11} color={colors.ink3} numberOfLines={1}>
                  {token && user?.email ? user.email : 'api.vigas.ai/v1 · $0 fee first $5'}
                </T>
              </View>
              <Icon name="chevronRight" size={18} color={colors.ink3} />
            </PressableScale>

            <Label style={styles.groupLabel}>§ Workspace</Label>
            <View style={styles.group}>
              {primary.map((item) => {
                const active = item.match ? pathname === item.match : false;
                return (
                  <PressableScale
                    key={item.id}
                    accessibilityLabel={item.label}
                    onPress={() => go(item.onPress)}
                    style={[styles.row, active && styles.rowActive]}
                    scaleTo={0.985}
                  >
                    <View style={[styles.rowIcon, active && styles.rowIconActive]}>
                      <Icon name={item.icon} size={19} color={active ? colors.orange : colors.ink2} />
                    </View>
                    <View style={styles.flex}>
                      <T f="sansSemi" size={15} color={active ? colors.ink : colors.ink}>
                        {item.label}
                      </T>
                      <T f="mono" size={11} color={colors.ink3} numberOfLines={1}>
                        {item.sub}
                      </T>
                    </View>
                    {item.badge ? <Tag text={item.badge} color={item.badgeColor ?? colors.sand} /> : null}
                  </PressableScale>
                );
              })}
            </View>

            <Label style={styles.groupLabel}>§ Directory</Label>
            <View style={styles.group}>
              {directory.map((item) => (
                <PressableScale key={item.id} accessibilityLabel={item.label} onPress={() => go(item.onPress)} style={styles.row} scaleTo={0.985}>
                  <View style={styles.rowIcon}>
                    <Icon name={item.icon} size={19} color={colors.ink2} />
                  </View>
                  <View style={styles.flex}>
                    <T f="sansMedium" size={14.5}>
                      {item.label}
                    </T>
                    <T f="mono" size={11} color={colors.ink3} numberOfLines={1}>
                      {item.sub}
                    </T>
                  </View>
                  <Icon name="chevronRight" size={16} color={colors.ink3} />
                </PressableScale>
              ))}
            </View>

            <Label style={styles.groupLabel}>§ API & Billing</Label>
            <View style={styles.actions}>
              <KeyButton
                label="Post to Pulse"
                height={42}
                icon={<Icon name="plus" size={16} color={colors.onOrange} />}
                onPress={() => go(() => router.push('/compose'))}
              />
              <PressableScale
                accessibilityLabel="Wallet and API keys"
                onPress={() => go(() => router.navigate('/wallet'))}
                style={styles.ghostRow}
              >
                <Icon name="wallet" size={17} color={colors.indigo} />
                <T f="sansMedium" size={14} style={styles.flex}>
                  API Keys & Usage
                </T>
                <Icon name="chevronRight" size={16} color={colors.ink3} />
              </PressableScale>
              <PressableScale accessibilityLabel="Top up credits on vigas.app" onPress={() => void openTopup()} style={styles.ghostRow}>
                <Icon name="external" size={17} color={colors.green} />
                <T f="sansMedium" size={14} style={styles.flex}>
                  Top up on vigas.app
                </T>
                <T f="mono" size={11} color={colors.green}>
                  CRYPTO · STARS
                </T>
              </PressableScale>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Led color={colors.green} size={6} />
            <T f="mono" size={11} color={colors.ink3} style={styles.flex}>
              api.vigas.ai/v1 · <Span color={colors.green}>99.98%</Span>
            </T>
            <T f="mono" size={11} color={colors.ink3}>
              v2.0
            </T>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  overlay: { flex: 1, flexDirection: 'row' },
  scrim: { flex: 1, backgroundColor: 'rgba(5,5,4,0.68)' },
  drawer: {
    width: '84%',
    maxWidth: 340,
    backgroundColor: colors.bg,
    borderRightWidth: 1,
    borderRightColor: colors.line2,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: GUTTER, paddingRight: 10, paddingBottom: 10 },
  brand: { marginLeft: 2 },
  rule: { marginHorizontal: GUTTER, opacity: 0.55 },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 14, paddingBottom: 20 },
  accountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  guestBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupLabel: { marginTop: 20, marginBottom: 8 },
  group: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
  },
  rowActive: {
    backgroundColor: colors.orangeSoft,
    borderWidth: 1,
    borderColor: 'rgba(255,106,26,0.28)',
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconActive: {
    backgroundColor: 'rgba(255,106,26,0.18)',
    borderColor: 'rgba(255,106,26,0.4)',
  },
  actions: { gap: 8 },
  ghostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: GUTTER,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.orangeSoft,
    borderWidth: 1,
    borderColor: 'rgba(255,106,26,0.36)',
  },
  walletPillSigned: {
    backgroundColor: colors.surface,
    borderColor: colors.line2,
  },
});
