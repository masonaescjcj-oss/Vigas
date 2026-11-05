import { blendedCost, formatCompact, quoteTopup, timeAgo, type ApiKeySummary, type CreatedApiKey, type WalletResponse } from '@vigas/core';
import { seedModels } from '@vigas/core/seed';
import { useScrollToTop } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import Animated, { Easing, FadeInDown, LinearTransition, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GhostButton, KeyButton } from '@/components/buttons';
import { Icon } from '@/components/icons';
import { IconButton } from '@/components/pressable';
import { Refresher, StatusScrim } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { Skeleton, SkeletonRow } from '@/components/skeleton';
import { ErrorCard, SignInCard } from '@/components/states';
import { Heading, Label, T } from '@/components/text';
import { api, errorMessage, isUnauthorized, withTimeout } from '@/lib/api';
import { usd, weekdayLetter } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { mutate } from '@/lib/remote';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';
import { useWallet, WALLET_KEY } from '@/lib/wallet';
import { colors, GUTTER, withAlpha } from '@/theme';

const AMOUNTS = [10, 25, 50, 100];

const SOURCES: Record<WalletResponse['bySource'][number]['source'], { label: string; color: string }> = {
  api: { label: 'API', color: colors.indigo },
  retrobuild: { label: 'RetroBuild', color: colors.orange },
  chat: { label: 'Chat', color: colors.sand },
  arena: { label: 'Arena', color: colors.teal },
};

/** Micros per token for a typical Claude Sonnet 5.5 request, used for the "≈ tokens" hint. */
const SONNET = seedModels.find((m) => m.id === 'anthropic/claude-sonnet-5.5');
const MICROS_PER_TOKEN = SONNET ? blendedCost(SONNET) / 3500 : 5;

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { token, user, signOut } = useSession();
  const wallet = useWallet();
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          token ? <Refresher refreshing={wallet.refreshing} progressViewOffset={insets.top} onRefresh={() => void wallet.refresh()} /> : undefined
        }
      >
        <View style={styles.titleRow}>
          <T f="serif" size={44} lh={1.05} ls={-0.02} accessibilityRole="header" style={styles.flex}>
            Wallet
          </T>
          {token ? (
            <IconButton
              icon="logout"
              accessibilityLabel="Sign out"
              color={colors.ink2}
              onPress={() =>
                Alert.alert('Sign out?', user?.email ? `You’re signed in as ${user.email}.` : undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
                ])
              }
            />
          ) : null}
        </View>

        {!token ? (
          <SignedOut />
        ) : wallet.data ? (
          <Loaded wallet={wallet.data} />
        ) : wallet.pending ? (
          <WalletSkeleton />
        ) : (
          <ErrorCard
            style={styles.top}
            message={wallet.error ?? 'Couldn’t load your wallet.'}
            onRetry={() => void wallet.refresh()}
          />
        )}

        {token && user?.email ? (
          <T f="mono" size={12} color={colors.ink3} align="center" style={styles.signedAs}>
            Signed in as {user.email}
          </T>
        ) : null}
      </ScrollView>
      <StatusScrim />
    </View>
  );
}

function SignedOut() {
  const perks = [
    ['wallet', 'Prepaid credits, no subscription'],
    ['key', 'API keys for every model on Vigas'],
    ['ranks', 'Usage by day and by product'],
  ] as const;
  return (
    <View style={styles.top}>
      <SignInCard
        icon="wallet"
        title="One balance,"
        italic="every model."
        body="Top up once and spend it across the Vigas API, Chat, Arena and RetroBuild. Create keys for your own apps."
      />
      <View style={styles.perks}>
        {perks.map(([icon, text], i) => (
          <Animated.View key={text} entering={FadeInDown.duration(300).delay(120 + i * 60)} style={styles.perk}>
            <View style={styles.perkIcon}>
              <Icon name={icon} size={18} color={colors.indigo} />
            </View>
            <T size={15} color={colors.ink2} style={styles.flex}>
              {text}
            </T>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function WalletSkeleton() {
  return (
    <View style={[styles.top, styles.pad, { gap: 16 }]} accessibilityLabel="Loading wallet">
      <Skeleton height={300} radius={26} />
      <Skeleton height={250} radius={22} />
      <SkeletonRow square={40} />
      <SkeletonRow square={40} />
    </View>
  );
}

function Loaded({ wallet }: { wallet: WalletResponse }) {
  const { expire } = useSession();
  const [amount, setAmount] = useState(25);
  const [buying, setBuying] = useState(false);
  const [keySheet, setKeySheet] = useState(false);

  const amountMicros = amount * 1_000_000;
  const quote = quoteTopup(amountMicros, wallet.lifetimeTopupMicros, wallet.feeBps);
  const tokens = wallet.balanceMicros / MICROS_PER_TOKEN;

  const week = wallet.week.slice(-7);
  const weekTotal = week.reduce((s, d) => s + d.costMicros, 0);
  const weekMax = Math.max(...week.map((d) => d.costMicros), 1);
  const sources = [...wallet.bySource].sort((a, b) => b.costMicros - a.costMicros);
  const sourceTotal = Math.max(
    sources.reduce((s, x) => s + x.costMicros, 0),
    1,
  );

  const buy = async () => {
    setBuying(true);
    try {
      const res = await withTimeout(api.topup(amountMicros), 20000);
      mutate<WalletResponse>(WALLET_KEY, (prev) =>
        prev ? { ...prev, balanceMicros: res.balanceMicros, lifetimeTopupMicros: prev.lifetimeTopupMicros + amountMicros } : prev,
      );
      haptics.success();
      toast(`Added ${usd(amountMicros)}${res.feeMicros ? ` · fee ${usd(res.feeMicros)}` : ''}`, 'success');
    } catch (e) {
      haptics.error();
      toast(errorMessage(e), 'error');
      if (isUnauthorized(e)) expire();
    } finally {
      setBuying(false);
    }
  };

  const revoke = (k: ApiKeySummary) => {
    Alert.alert(`Revoke “${k.name}”?`, 'Apps using this key stop working immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          try {
            await withTimeout(api.revokeKey(k.id));
            mutate<WalletResponse>(WALLET_KEY, (prev) => (prev ? { ...prev, keys: prev.keys.filter((x) => x.id !== k.id) } : prev));
            haptics.success();
            toast('Key revoked', 'success');
          } catch (e) {
            toast(errorMessage(e), 'error');
            if (isUnauthorized(e)) expire();
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.top}>
      <Animated.View entering={FadeInDown.duration(380)} style={styles.balanceCard}>
        <View pointerEvents="none" style={[styles.ring, styles.ringOuter]} />
        <View pointerEvents="none" style={[styles.ring, styles.ringInner]} />
        <Label>Available credits</Label>
        <T f="serif" size={60} lh={1.05} ls={-0.03} style={styles.balance} numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={`Balance ${usd(wallet.balanceMicros)}`}>
          {usd(wallet.balanceMicros)}
        </T>
        <T f="mono" size={12} color={colors.ink3}>
          ≈ {formatCompact(Math.round(tokens))} tokens · API, Chat & RetroBuild
        </T>

        <View accessibilityRole="radiogroup" accessibilityLabel="Top-up amount" style={styles.amounts}>
          {AMOUNTS.map((a) => {
            const on = a === amount;
            return (
              <Pressable
                key={a}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`$${a}`}
                onPress={() => {
                  if (!on) haptics.select();
                  setAmount(a);
                }}
                style={[styles.amount, on ? styles.amountOn : styles.amountOff]}
              >
                <T f="monoMedium" size={15} color={on ? colors.orangeText : colors.ink}>
                  ${a}
                </T>
              </Pressable>
            );
          })}
        </View>
        <KeyButton label={`Add ${usd(amountMicros)}`} height={54} radius={16} fontSize={16} loading={buying} onPress={() => void buy()} />
        <T f="mono" size={12} color={colors.ink3} align="center" style={styles.fee}>
          {quote.feeMicros > 0
            ? `${usd(quote.feeMicros)} fee · ${usd(quote.totalMicros)} total`
            : quote.freeMicros > 0
              ? 'No fee on your first $5'
              : 'No fee'}
          {'  ·  Card · Crypto · Bank transfer'}
        </T>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(380).delay(80)} style={styles.card}>
        <View style={styles.spaceBetween}>
          <Heading>This week</Heading>
          <T f="mono" size={14}>
            {usd(weekTotal)}
          </T>
        </View>
        <View style={styles.weekBars} accessibilityLabel={`Spent ${usd(weekTotal)} in the last 7 days`}>
          {week.map((d, i) => (
            <View key={d.date} style={styles.weekCol}>
              <GrowBar height={Math.max(4, Math.round((d.costMicros / weekMax) * 80))} color={i === week.length - 1 ? colors.orange : colors.pillar} delay={i * 45} />
              <T f="mono" size={12} color={i === week.length - 1 ? colors.ink : colors.ink3}>
                {weekdayLetter(d.date)}
              </T>
            </View>
          ))}
        </View>
        <View style={styles.sources}>
          {sources.length === 0 ? (
            <T size={14} color={colors.ink3}>
              No spend yet this week.
            </T>
          ) : (
            sources.map((s) => {
              const meta = SOURCES[s.source] ?? { label: s.source, color: colors.ink2 };
              return (
                <View key={s.source}>
                  <View style={styles.spaceBetween}>
                    <T size={14}>{meta.label}</T>
                    <T f="mono" size={13}>
                      {usd(s.costMicros)}
                    </T>
                  </View>
                  <View style={styles.track}>
                    <GrowWidth pct={(s.costMicros / sourceTotal) * 100} color={meta.color} />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(380).delay(160)} style={styles.keys}>
        <View style={[styles.spaceBetween, styles.keysHead]}>
          <Heading>API keys</Heading>
          <GhostButton label="New key" icon={<Icon name="plus" size={16} />} onPress={() => setKeySheet(true)} />
        </View>
        {wallet.keys.length === 0 ? (
          <T size={14} color={colors.ink3} style={styles.noKeys}>
            No keys yet. Create one to call the Vigas API from your own apps.
          </T>
        ) : (
          wallet.keys.map((k) => (
            <Animated.View key={k.id} layout={LinearTransition.duration(220)} style={styles.keyRow}>
              <View style={styles.keyIcon}>
                <Icon name="key" size={18} color={colors.indigo} />
              </View>
              <View style={styles.flex}>
                <T f="sansMedium" numberOfLines={1}>
                  {k.name}
                </T>
                <T f="mono" size={12} color={colors.ink3} numberOfLines={1}>
                  {k.display}
                </T>
                <T f="mono" size={12} color={colors.ink2}>
                  {k.spentThisMonthMicros > 0
                    ? `${usd(k.spentThisMonthMicros)} this month`
                    : k.lastUsedAt
                      ? `Used ${timeAgo(k.lastUsedAt)} ago`
                      : 'Never used'}
                </T>
              </View>
              <IconButton icon="trash" variant="tile" iconSize={17} color={colors.ink2} accessibilityLabel={`Revoke ${k.name}`} onPress={() => revoke(k)} />
            </Animated.View>
          ))
        )}
      </Animated.View>

      <NewKeySheet visible={keySheet} onClose={() => setKeySheet(false)} />
    </View>
  );
}

function GrowBar({ height, color, delay }: { height: number; color: string; delay: number }) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.set(withDelay(delay, withTiming(height, { duration: 550, easing: Easing.out(Easing.cubic) })));
  }, [height, delay, h]);
  const style = useAnimatedStyle(() => ({ height: h.get() }));
  return <Animated.View style={[styles.weekBar, { backgroundColor: color }, style]} />;
}

function GrowWidth({ pct, color }: { pct: number; color: string }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.set(withTiming(pct, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [pct, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.get()}%` }));
  return <Animated.View style={[styles.fill, { backgroundColor: color }, style]} />;
}

function NewKeySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { expire } = useSession();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);

  const close = () => {
    onClose();
    setName('');
    setCreated(null);
  };

  const create = async () => {
    setBusy(true);
    try {
      const key = await withTimeout(api.createKey(name.trim() || 'Android key'));
      const { key: _secret, ...summary } = key;
      mutate<WalletResponse>(WALLET_KEY, (prev) => (prev ? { ...prev, keys: [summary, ...prev.keys] } : prev));
      setCreated(key);
      haptics.success();
    } catch (e) {
      haptics.error();
      toast(errorMessage(e), 'error');
      if (isUnauthorized(e)) expire();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={close} title={created ? 'Your new key' : 'New API key'}>
      <View style={styles.sheetBody}>
        {created ? (
          <>
            <View style={styles.warn}>
              <Icon name="info" size={18} color={colors.sand} />
              <T size={14} color={colors.ink2} style={styles.flex}>
                Copy it now — for your security Vigas never shows a key again. Long-press the key to select it.
              </T>
            </View>
            <View style={styles.secretBox}>
              <T f="mono" size={14} lh={1.5} selectable accessibilityLabel="API key">
                {created.key}
              </T>
            </View>
            <View style={styles.sheetActions}>
              <GhostButton
                label="Share"
                icon={<Icon name="share" size={16} />}
                style={styles.flex}
                onPress={() => void Share.share({ message: created.key }).catch(() => undefined)}
              />
              <KeyButton label="Done" style={styles.flex} onPress={close} />
            </View>
          </>
        ) : (
          <>
            <T size={14} color={colors.ink2}>
              Keys work with any OpenAI-compatible SDK. Spend comes from this wallet.
            </T>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Key name, e.g. Production gateway"
              placeholderTextColor={colors.ink3}
              accessibilityLabel="Key name"
              autoFocus
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={() => void create()}
              selectionColor={colors.orange}
              cursorColor={colors.orange}
              style={styles.input}
            />
            <KeyButton label="Create key" height={50} fontSize={16} loading={busy} onPress={() => void create()} />
          </>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, minWidth: 0 },
  pad: { paddingHorizontal: GUTTER },
  top: { marginTop: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: GUTTER, paddingRight: 12 },
  signedAs: { marginTop: 24 },
  perks: { marginTop: 18, marginHorizontal: GUTTER, gap: 4 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(239,234,225,0.06)' },
  perkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.indigo, 0.14),
  },
  balanceCard: {
    marginHorizontal: GUTTER,
    padding: 20,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(239,234,225,0.1)',
    overflow: 'hidden',
  },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 1 },
  ringOuter: { right: -30, top: -30, width: 150, height: 150, borderColor: 'rgba(255,106,26,0.25)' },
  ringInner: { right: -6, top: -6, width: 100, height: 100, borderColor: 'rgba(255,106,26,0.18)' },
  balance: { marginTop: 8, marginBottom: 4 },
  amounts: { flexDirection: 'row', gap: 6, marginTop: 18, marginBottom: 10 },
  amount: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  amountOn: { backgroundColor: colors.orangeSoft, borderColor: colors.orange },
  amountOff: { backgroundColor: colors.bg2, borderColor: colors.line2 },
  fee: { marginTop: 10 },
  card: {
    marginTop: 16,
    marginHorizontal: GUTTER,
    padding: 18,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  weekBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 110, marginTop: 16 },
  weekCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%' },
  weekBar: { width: '100%', borderRadius: 6 },
  sources: { gap: 10, marginTop: 18 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.raised, marginTop: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  keys: { marginTop: 16, marginHorizontal: GUTTER },
  keysHead: { alignItems: 'center', marginBottom: 4 },
  noKeys: { paddingVertical: 12 },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,234,225,0.06)',
  },
  keyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.indigo, 0.14),
  },
  sheetBody: { paddingHorizontal: GUTTER, paddingTop: 6, gap: 14 },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.bg2,
    paddingHorizontal: 16,
    color: colors.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  warn: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: withAlpha(colors.sand, 0.08),
    borderWidth: 1,
    borderColor: withAlpha(colors.sand, 0.3),
  },
  secretBox: { padding: 14, borderRadius: 14, backgroundColor: colors.code, borderWidth: 1, borderColor: colors.line2 },
  sheetActions: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
});
