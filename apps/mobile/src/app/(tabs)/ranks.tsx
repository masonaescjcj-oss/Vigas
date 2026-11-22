import { LEADERBOARD_CATEGORIES, paretoFrontier, type LeaderboardCategory, type LeaderboardEntry } from '@vigas/core';
import { router, useScrollToTop } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bento, FlutedBar, Led, Tag } from '@/components/boxes';
import { ChipRow } from '@/components/chips';
import { Icon } from '@/components/icons';
import { MenuTrigger, WalletPill } from '@/components/menu-drawer';
import { OrgMonogram } from '@/components/monogram';
import { Podium } from '@/components/pillars';
import { IconButton, PressableScale } from '@/components/pressable';
import { Refresher, StatusScrim } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { Skeleton, SkeletonRow } from '@/components/skeleton';
import { OfflineNote } from '@/components/states';
import { Label, Span, T } from '@/components/text';
import { api } from '@/lib/api';
import { fallbackLeaderboard } from '@/lib/fallback';
import { baseModelName, intl, navStamp, pct, pillarName, usd } from '@/lib/format';
import { useRemote } from '@/lib/remote';
import { colors, GUTTER, radius } from '@/theme';

const openApiConsole = () => router.navigate('/wallet');
const openModel = (modelId: string) =>
  router.navigate({ pathname: '/chat', params: { model: modelId, t: navStamp() } });

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

  // Pareto frontier from `@vigas/core`: highest win-rate leader vs cheapest frontier model.
  const frontierIds = new Set(
    paretoFrontier(entries.map((e) => ({ id: e.modelId, cost: e.costPerTaskMicros, score: e.winRate }))).map((p) => p.id),
  );
  const bestValue = entries
    .filter((e) => frontierIds.has(e.modelId) && e.rank > 1)
    .sort((a, b) => a.costPerTaskMicros - b.costPerTaskMicros)[0];
  const leader = entries[0];

  const header = (
    <View>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <MenuTrigger />
        <View style={styles.flex}>
          <T f="serif" size={30} lh={1.05} ls={-0.02} accessibilityRole="header">
            Ranks
          </T>
        </View>
        <IconButton icon="info" accessibilityLabel="How we rank" onPress={() => setHowOpen(true)} color={colors.ink2} />
        <WalletPill />
      </View>

      <View style={styles.masthead}>
        <View style={styles.liveRow}>
          <Led color={colors.green} size={7} />
          <T f="mono" size={12} color={colors.ink2}>
            {lb.data ? `${intl(lb.data.totalSessions)} live sessions · Bradley–Terry` : 'Loading sessions…'}
          </T>
        </View>
        <T f="serif" size={34} lh={1.06} ls={-0.02} style={styles.heroTitle}>
          Rankings from{' '}
          <Span f="serifItalic" color={colors.sand}>
            real work.
          </Span>
        </T>
      </View>

      <ChipRow
        options={LEADERBOARD_CATEGORIES}
        value={cat}
        onChange={(c) => setCat(c)}
        accessibilityLabel="Category"
        style={styles.chips}
      />

      {lb.offline ? <OfflineNote style={styles.offline} onRetry={() => void lb.refresh()} /> : null}

      <Bento tone="cover" style={styles.podiumCard}>
        <View style={styles.podiumHead}>
          <Label color={colors.sand}>§ The Colonnade · Top 3</Label>
          <Tag text="Tap pillar to chat" color={colors.ink2} bg="rgba(239,234,225,0.08)" />
        </View>
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
      </Bento>

      {/* Value Frontier bento inspired by vigas.app Pareto chart */}
      {leader && bestValue ? (
        <View style={styles.paretoRow}>
          <PressableScale onPress={() => openModel(leader.modelId)} style={styles.paretoCard} scaleTo={0.98}>
            <Tag text="#1 Quality" color={colors.orange} />
            <T f="sansSemi" size={14} numberOfLines={1} style={styles.paretoName}>
              {baseModelName(leader.name)}
            </T>
            <T f="mono" size={11.5} color={colors.ink2}>
              {pct(leader.winRate)} · {usd(leader.costPerTaskMicros)}/task
            </T>
          </PressableScale>
          <PressableScale onPress={() => openModel(bestValue.modelId)} style={styles.paretoCard} scaleTo={0.98}>
            <Tag text="Pareto value" color={colors.green} />
            <T f="sansSemi" size={14} numberOfLines={1} style={styles.paretoName}>
              {baseModelName(bestValue.name)}
            </T>
            <T f="mono" size={11.5} color={colors.green}>
              {pct(bestValue.winRate)} · {usd(bestValue.costPerTaskMicros)}/task
            </T>
          </PressableScale>
        </View>
      ) : null}

      <View style={styles.listHead}>
        <Label>§ Full standings · Tap any model to test</Label>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <Animated.FlatList
        ref={listRef}
        data={rest}
        keyExtractor={(e) => e.modelId}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <RankRow entry={item} max={max} index={index} pareto={frontierIds.has(item.modelId)} />
        )}
        itemLayoutAnimation={LinearTransition.duration(260)}
        ListEmptyComponent={
          lb.pending ? (
            <View style={styles.pad}>
              {[0, 1, 2, 3, 4].map((i) => (
                <SkeletonRow key={i} square={34} />
              ))}
            </View>
          ) : undefined
        }
        ListFooterComponent={<ApiCta />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<Refresher refreshing={lb.refreshing} progressViewOffset={insets.top} onRefresh={() => void lb.refresh()} />}
      />
      <StatusScrim />
      <Sheet visible={howOpen} onClose={() => setHowOpen(false)} title="How we rank">
        <View style={styles.how}>
          <T size={15} color={colors.ink2}>
            Ranks combine anonymized gateway session telemetry with verified coding, reasoning and multimodal benchmarks.
          </T>
          <T size={15} color={colors.ink2}>
            Ratings are computed with a Bradley–Terry model and 95% confidence intervals.{' '}
            <T f="sansSemi" size={15}>
              Win share
            </T>{' '}
            measures task quality;{' '}
            <T f="sansSemi" size={15}>
              Pareto value
            </T>{' '}
            marks models no cheaper option beats.
          </T>
          <PressableScale
            onPress={() => {
              setHowOpen(false);
              openApiConsole();
            }}
            style={styles.howCta}
          >
            <Icon name="key" size={18} color={colors.orange} />
            <T f="sansMedium" size={15} color={colors.orangeText}>
              Compare API cost &amp; get a key
            </T>
          </PressableScale>
        </View>
      </Sheet>
    </View>
  );
}

function RankRow({ entry, max, index, pareto }: { entry: LeaderboardEntry; max: number; index: number; pareto: boolean }) {
  return (
    <Animated.View entering={index < 10 ? FadeInDown.duration(300).delay(index * 30) : undefined} style={styles.pad}>
      <PressableScale
        accessibilityLabel={`Rank ${entry.rank}: ${entry.name}, ${pct(entry.winRate, 2)} win share, ${usd(entry.costPerTaskMicros)} per task. Open in Chat.`}
        onPress={() => openModel(entry.modelId)}
        style={styles.row}
        scaleTo={0.985}
      >
        <T f="monoSemi" size={13.5} color={colors.ink3} style={styles.rank}>
          {String(entry.rank).padStart(2, '0')}
        </T>
        <OrgMonogram org={entry.org} size={34} radius={10} />
        <View style={styles.flex}>
          <View style={styles.rowName}>
            <T f="sansMedium" numberOfLines={1} style={styles.shrink}>
              {baseModelName(entry.name)}
            </T>
            {pareto ? <Tag text="VALUE" color={colors.green} /> : null}
          </View>
          <View style={styles.barWrap}>
            <FlutedBar
              pct={(entry.winRate / max) * 100}
              fill={pareto ? colors.sand : colors.pillar}
              groove={pareto ? colors.sandDeep : colors.grooveDark}
              height={7}
              delay={index < 8 ? index * 30 : 0}
            />
          </View>
        </View>
        <View style={styles.right}>
          <T f="monoSemi" size={13.5} color={colors.green}>
            {pct(entry.winRate, 1)}
          </T>
          <T f="mono" size={11.5} color={colors.ink3}>
            {usd(entry.costPerTaskMicros)}/task
          </T>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

function ApiCta() {
  return (
    <PressableScale
      accessibilityLabel="Estimate monthly API cost and create a Vigas key."
      onPress={openApiConsole}
      style={styles.cta}
      haptic="tap"
    >
      <View style={styles.ctaIcon}>
        <Icon name="key" size={20} color={colors.onOrange} />
      </View>
      <View style={styles.flex}>
        <T f="sansSemi">Call any ranked model with 1 key</T>
        <T size={13} color={colors.ink2}>
          $0 fee on your first $5 · Estimate monthly savings.
        </T>
      </View>
      <Icon name="chevronRight" size={20} color={colors.orangeText} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  pad: { paddingHorizontal: GUTTER },
  listContent: { paddingBottom: 32 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: GUTTER,
    paddingBottom: 4,
  },
  masthead: { paddingHorizontal: GUTTER, paddingTop: 6 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroTitle: { marginTop: 6 },
  chips: { marginTop: 16 },
  offline: { marginTop: 14 },
  podiumCard: { marginTop: 18, paddingHorizontal: 12, paddingBottom: 0 },
  podiumHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 8 },
  podiumSkeleton: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  podiumSkeletonCol: { flex: 1, alignItems: 'center', gap: 8 },
  paretoRow: { flexDirection: 'row', gap: 10, paddingHorizontal: GUTTER, marginTop: 12 },
  paretoCard: {
    flex: 1,
    minWidth: 0,
    padding: 13,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 5,
  },
  paretoName: { marginTop: 2 },
  listHead: { paddingHorizontal: GUTTER, marginTop: 20, marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12,
    minHeight: 66,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,234,225,0.06)',
  },
  rowName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barWrap: { marginTop: 7 },
  rank: { width: 26 },
  right: { alignItems: 'flex-end' },
  cta: {
    marginTop: 18,
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
