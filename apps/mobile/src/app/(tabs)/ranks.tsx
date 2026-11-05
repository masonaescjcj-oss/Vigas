import { LEADERBOARD_CATEGORIES, type LeaderboardCategory, type LeaderboardEntry } from '@vigas/core';
import { router, useScrollToTop } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChipRow } from '@/components/chips';
import { Icon } from '@/components/icons';
import { OrgMonogram } from '@/components/monogram';
import { Podium } from '@/components/pillars';
import { IconButton, PressableScale } from '@/components/pressable';
import { Refresher, StatusScrim } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { Skeleton, SkeletonRow } from '@/components/skeleton';
import { OfflineNote } from '@/components/states';
import { T } from '@/components/text';
import { api } from '@/lib/api';
import { fallbackLeaderboard } from '@/lib/fallback';
import { baseModelName, intl, pct, pillarName, usd } from '@/lib/format';
import { useRemote } from '@/lib/remote';
import { colors, GUTTER } from '@/theme';

const openArena = () => router.navigate({ pathname: '/chat', params: { mode: 'arena', t: String(Date.now()) } });
const openModel = (modelId: string) =>
  router.navigate({ pathname: '/chat', params: { mode: 'chat', model: modelId, t: String(Date.now()) } });

export default function RanksScreen() {
  const insets = useSafeAreaInsets();
  const [cat, setCat] = useState<LeaderboardCategory>('overall');
  const [howOpen, setHowOpen] = useState(false);
  const lb = useRemote(`lb:${cat}`, () => api.leaderboard(cat), { fallback: () => fallbackLeaderboard(cat) });
  const listRef = useRef<FlatList<LeaderboardEntry>>(null);
  useScrollToTop(listRef);

  const entries = lb.data?.entries ?? [];
  const max = Math.max(...entries.map((e) => e.winRate), 1);
  const rest = entries.slice(3);

  const header = (
    <View>
      <View style={[styles.head, { paddingTop: insets.top + 14 }]}>
        <View style={styles.flex}>
          <T f="serif" size={44} lh={1.05} ls={-0.02} accessibilityRole="header" style={styles.title}>
            Ranks
          </T>
          <View style={styles.liveRow}>
            <LiveDot />
            <T f="mono" size={12} color={colors.ink2}>
              {lb.data ? `${intl(lb.data.totalSessions)} sessions` : 'Loading sessions…'}
            </T>
          </View>
        </View>
        <IconButton icon="info" accessibilityLabel="How we rank" onPress={() => setHowOpen(true)} />
      </View>

      <ChipRow
        options={LEADERBOARD_CATEGORIES}
        value={cat}
        onChange={(c) => setCat(c)}
        accessibilityLabel="Category"
        style={styles.chips}
      />

      {lb.offline ? <OfflineNote style={styles.offline} onRetry={() => void lb.refresh()} /> : null}

      <View style={styles.podiumCard} accessibilityLabel="Top three">
        {entries.length >= 3 ? (
          <Podium
            places={entries.slice(0, 3).map((e, i) => ({
              key: e.modelId,
              name: pillarName(e.name),
              org: e.org,
              valueLabel: pct(e.winRate),
              place: i,
            }))}
            onPress={(p) => openModel(p.key)}
          />
        ) : (
          <View style={styles.podiumSkeleton}>
            {[84, 120, 60].map((h, i) => (
              <View key={i} style={styles.podiumSkeletonCol}>
                <Skeleton width={36} height={36} radius={11} />
                <Skeleton width="70%" height={12} />
                <Skeleton width="60%" height={24} />
                <Skeleton width="62%" height={h} radius={2} />
                <Skeleton height={42} radius={5} />
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={styles.listGap} />
    </View>
  );

  return (
    <View style={styles.root}>
      <Animated.FlatList
        ref={listRef}
        data={rest}
        keyExtractor={(e) => e.modelId}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => <RankRow entry={item} max={max} index={index} />}
        itemLayoutAnimation={LinearTransition.duration(260)}
        ListEmptyComponent={
          lb.pending ? (
            <View style={styles.pad}>
              {[0, 1, 2, 3, 4].map((i) => (
                <SkeletonRow key={i} square={34} />
              ))}
            </View>
          ) : null
        }
        ListFooterComponent={<ArenaCta />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<Refresher refreshing={lb.refreshing} progressViewOffset={insets.top} onRefresh={() => void lb.refresh()} />}
      />
      <StatusScrim />
      <Sheet visible={howOpen} onClose={() => setHowOpen(false)} title="How we rank">
        <View style={styles.how}>
          <T size={15} color={colors.ink2}>
            Ranks come from real sessions routed through Vigas and from blind Arena votes, where two hidden models answer the
            same prompt and you pick the better one.
          </T>
          <T size={15} color={colors.ink2}>
            Votes are scored with a Bradley–Terry model and bootstrapped 95% confidence intervals.{' '}
            <T f="sansSemi" size={15}>
              Win share
            </T>{' '}
            is the percent of sessions a model wins;{' '}
            <T f="sansSemi" size={15}>
              cost per task
            </T>{' '}
            is the average spend for one completed agent task.
          </T>
          <PressableScale
            onPress={() => {
              setHowOpen(false);
              openArena();
            }}
            style={styles.howCta}
          >
            <Icon name="arena" size={18} color={colors.orange} />
            <T f="sansMedium" size={15} color={colors.orangeText}>
              Vote in the Arena
            </T>
          </PressableScale>
        </View>
      </Sheet>
    </View>
  );
}

function LiveDot() {
  const o = useSharedValue(1);
  useEffect(() => {
    o.set(withRepeat(withTiming(0.4, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return (
    <Animated.View style={[styles.ledRing, style]}>
      <View style={styles.led} />
    </Animated.View>
  );
}

function Bar({ value }: { value: number }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.set(withTiming(value, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [value, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.get()}%` }));
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, fill]} />
    </View>
  );
}

function RankRow({ entry, max, index }: { entry: LeaderboardEntry; max: number; index: number }) {
  return (
    <Animated.View entering={index < 10 ? FadeInDown.duration(300).delay(index * 30) : undefined} style={styles.pad}>
      <PressableScale
        accessibilityLabel={`Rank ${entry.rank}: ${entry.name}, ${pct(entry.winRate, 2)} win share, ${usd(entry.costPerTaskMicros)} per task. Open in Chat.`}
        onPress={() => openModel(entry.modelId)}
        style={styles.row}
        scaleTo={0.985}
      >
        <T f="monoSemi" size={14} color={colors.ink3} style={styles.rank}>
          {entry.rank}
        </T>
        <OrgMonogram org={entry.org} size={34} radius={10} />
        <View style={styles.flex}>
          <T f="sansMedium" numberOfLines={1}>
            {baseModelName(entry.name)}
          </T>
          <Bar value={(entry.winRate / max) * 100} />
        </View>
        <View style={styles.right}>
          <T f="mono" size={14} color={colors.green}>
            {pct(entry.winRate, 2)}
          </T>
          <T f="mono" size={12} color={colors.ink3}>
            {usd(entry.costPerTaskMicros)}/task
          </T>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

function ArenaCta() {
  return (
    <PressableScale accessibilityLabel="Vote in the Arena. Compare two hidden models." onPress={openArena} style={styles.cta} haptic="tap">
      <View style={styles.ctaIcon}>
        <Icon name="arena" size={20} color={colors.onOrange} />
      </View>
      <View style={styles.flex}>
        <T f="sansSemi">Vote in the Arena</T>
        <T size={13} color={colors.ink2}>
          Compare two hidden models. Shape the ranks.
        </T>
      </View>
      <Icon name="chevronRight" size={20} color={colors.orangeText} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, minWidth: 0 },
  pad: { paddingHorizontal: GUTTER },
  listContent: { paddingBottom: 28 },
  head: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: GUTTER, paddingRight: 12 },
  title: { marginTop: 10, marginBottom: 6 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ledRing: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: 'rgba(111,207,115,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  led: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  chips: { marginTop: 18 },
  offline: { marginTop: 14 },
  podiumCard: {
    marginTop: 18,
    marginHorizontal: GUTTER,
    paddingTop: 18,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  podiumSkeleton: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  podiumSkeletonCol: { flex: 1, alignItems: 'center', gap: 8 },
  listGap: { height: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    minHeight: 64,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,234,225,0.06)',
  },
  rank: { width: 28 },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: colors.raised, marginTop: 7, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2, backgroundColor: colors.blue },
  right: { alignItems: 'flex-end' },
  cta: {
    marginTop: 16,
    marginHorizontal: GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,106,26,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,106,26,0.35)',
  },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  how: { paddingHorizontal: GUTTER, paddingTop: 4, gap: 12 },
  howCta: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
});
