import { formatPricePerMillion, type ModelListItem, type NewsListItem, type PulsePost, type ToolItem, type WalletResponse } from '@vigas/core';
import { router, useScrollToTop } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bento, Led, SectionHead, Tag } from '@/components/boxes';
import { KeyButton } from '@/components/buttons';
import { Icon, LogoMark } from '@/components/icons';
import { MenuTrigger, WalletPill } from '@/components/menu-drawer';
import { Monogram, OrgMonogram } from '@/components/monogram';
import { NewsCover } from '@/components/news-cover';
import { Colonnade } from '@/components/pillars';
import { IconButton, PressableScale } from '@/components/pressable';
import { ApiCodeSheet, PostCard } from '@/components/pulse';
import { Refresher, StatusScrim } from '@/components/screen';
import { Skeleton, SkeletonRow } from '@/components/skeleton';
import { OfflineNote } from '@/components/states';
import { Label, Span, T } from '@/components/text';
import { api } from '@/lib/api';
import { fallbackHome } from '@/lib/fallback';
import { agoLabel, dayLabel, greeting, intl, navStamp, pct, pillarName, shortTitle, usd } from '@/lib/format';
import { usePulseFeed } from '@/lib/pulse';
import { useRemote } from '@/lib/remote';
import { useSession } from '@/lib/session';
import { useWallet } from '@/lib/wallet';
import { colors, GUTTER, radius } from '@/theme';

const PROMPTS = ['Compare Fable vs Flash', 'AI news in 60 seconds', 'Cheapest PDF extractor', 'Write a launch tweet'];
const CARD_W = 286;
const CARD_GAP = 10;

interface RateSpec {
  id: string;
  tag: string;
  speed: string;
  fast?: boolean;
}

const LIVE_SHOWCASE: RateSpec[] = [
  { id: 'deepseek/v4.1-flash', tag: 'Lowest cost', speed: '98ms', fast: true },
  { id: 'google/gemini-4-argon', tag: 'Fastest', speed: '105ms', fast: true },
  { id: 'openai/gpt-6.1-terra', tag: 'Reasoning -12%', speed: '140ms' },
  { id: 'anthropic/claude-fable-5.2', tag: '#1 Arena', speed: '175ms' },
];

const openChat = (prompt?: string, model?: string) =>
  router.navigate({ pathname: '/chat', params: { prompt: prompt ?? '', model: model ?? '', mode: 'chat', t: navStamp() } });

const enter = (i: number) => FadeInDown.duration(380).delay(35 + i * 45);

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useSession();
  const home = useRemote('home', () => api.home(), { fallback: fallbackHome });
  const wallet = useWallet();
  const pulse = usePulseFeed('hot');
  const [codePost, setCodePost] = useState<PulsePost | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);

  const feed = home.data;
  const now = new Date();
  const spotlight = pulse.items.find((p) => p.kind === 'battle') ?? pulse.items[0] ?? null;

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <Refresher
            refreshing={home.refreshing || wallet.refreshing || pulse.refreshing}
            progressViewOffset={insets.top}
            onRefresh={() => {
              void home.refresh();
              void wallet.refresh();
              void pulse.refresh();
            }}
          />
        }
      >
        <View style={styles.header}>
          <MenuTrigger />
          <LogoMark size={21} />
          <T f="serif" size={26} lh={1.05} style={styles.brand}>
            Vigas
          </T>
          <IconButton
            icon="search"
            accessibilityLabel="Search models, tools and news"
            style={styles.pushRight}
            onPress={() => router.navigate({ pathname: '/explore', params: { focus: '1', t: navStamp() } })}
          />
          <WalletPill />
        </View>

        <Animated.View entering={enter(0)} style={styles.hero}>
          <Label>{dayLabel(now)}</Label>
          <T f="serif" size={38} lh={1.06} ls={-0.02} accessibilityRole="header" style={styles.h1}>
            {greeting(now)}
            {'\n'}
            <Span f="serifItalic" color={colors.sand}>
              What are we building?
            </Span>
          </T>

          <PressableScale accessibilityLabel="Ask Vigas anything" onPress={() => openChat()} style={styles.ask} haptic="tap">
            <View style={styles.askRow}>
              <Icon name="spark" size={20} color={colors.orange} />
              <T size={16} color={colors.ink2}>
                Ask Vigas anything…
              </T>
            </View>
            <View style={styles.askFoot}>
              <View style={styles.modelPill}>
                <Led color={colors.green} size={6} still />
                <T f="mono" size={12} color={colors.ink}>
                  vigas/auto
                </T>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open blind Arena"
                hitSlop={6}
                onPress={() => router.navigate({ pathname: '/chat', params: { mode: 'arena', t: navStamp() } })}
                style={styles.arenaPill}
              >
                <Icon name="arena" size={13} color={colors.sand} />
                <T f="monoMedium" size={11.5} color={colors.sand}>
                  Arena
                </T>
              </Pressable>
              <View style={[styles.sendKey, styles.pushRight]}>
                <View style={styles.sendEdge} />
                <View style={styles.sendFace}>
                  <Icon name="arrowUp" size={20} color={colors.onOrange} />
                </View>
              </View>
            </View>
          </PressableScale>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.prompts}>
            {PROMPTS.map((p) => (
              <PressableScale key={p} onPress={() => openChat(p)} style={styles.prompt} accessibilityLabel={`Ask: ${p}`}>
                <T size={13.5} color={colors.ink2}>
                  {p}
                </T>
              </PressableScale>
            ))}
          </ScrollView>
        </Animated.View>

        {home.offline ? <OfflineNote style={styles.offline} onRetry={() => void home.refresh()} /> : null}

        {/* § 01 — Live API Rates box (directly inspired by vigas.app HeroApiPanel) */}
        <Animated.View entering={enter(2)} style={styles.section}>
          <LiveRatesBox models={feed?.prices ?? []} />
        </Animated.View>

        {/* § 02 — Pulse Community Spotlight */}
        {spotlight ? (
          <Animated.View entering={enter(3)} style={styles.section}>
            <SectionHead
              index="02"
              label="Pulse · Community"
              title="Live model"
              accent="battle."
              right={<SeeAll label="Open Pulse" onPress={() => router.navigate('/pulse')} />}
            />
            <View style={styles.pad}>
              <PostCard post={spotlight} onCode={setCodePost} />
            </View>
          </Animated.View>
        ) : null}

        {/* § 03 — The Colonnade (signature architectural fluted pillars) */}
        <Animated.View entering={enter(4)} style={styles.section}>
          <Bento tone="cover">
            <View style={styles.bentoHead}>
              <View style={styles.flex}>
                <Label color={colors.sand}>§ 03 — The Colonnade</Label>
                <T f="serif" size={28} lh={1.06} style={styles.bentoTitle}>
                  Top agents <Span f="serifItalic" color={colors.sand}>this week</Span>
                </T>
              </View>
              <SeeAll label="Ranks" onPress={() => router.navigate('/ranks')} />
            </View>
            {feed ? (
              <Colonnade
                items={feed.topAgents.slice(0, 5).map((a) => ({
                  key: a.modelId,
                  label: pillarName(a.name),
                  value: a.winRate,
                  valueLabel: pct(a.winRate),
                }))}
                onPress={(it) => openChat(undefined, it.key)}
              />
            ) : (
              <View style={[styles.row, { alignItems: 'flex-end', height: 190 }]}>
                {[110, 90, 80, 74, 70].map((h, i) => (
                  <Skeleton key={i} height={h} style={styles.flex} radius={4} />
                ))}
              </View>
            )}
          </Bento>
        </Animated.View>

        {/* § 04 — Credits & API Strip */}
        <Animated.View entering={enter(5)} style={styles.section}>
          <CreditsStrip signedIn={!!token} wallet={wallet.data} pending={wallet.pending} error={wallet.error} />
        </Animated.View>

        {/* § 05 — Today in AI (dot-grid editorial covers) */}
        <Animated.View entering={enter(6)} style={styles.section}>
          <SectionHead
            index="04"
            label="AI Newsroom"
            title="Today in"
            accent="AI."
            right={<SeeAll label="See all" onPress={() => router.navigate({ pathname: '/explore', params: { seg: 'news', t: navStamp() } })} />}
          />
          {feed ? (
            <FlatList
              horizontal
              data={feed.news.slice(0, 8)}
              keyExtractor={(n) => n.slug}
              renderItem={({ item }) => <NewsCard item={item} />}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              ItemSeparatorComponent={CarouselGap}
              snapToInterval={CARD_W + CARD_GAP}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum
            />
          ) : (
            <View style={[styles.carousel, styles.row]}>
              <Skeleton width={CARD_W} height={232} radius={22} />
              <Skeleton width={CARD_W} height={232} radius={22} />
            </View>
          )}
        </Animated.View>

        {/* § 06 — Trending Tools */}
        <Animated.View entering={enter(7)} style={styles.section}>
          <SectionHead
            index="05"
            label="Builder Directory"
            title="Trending"
            accent="tools."
            right={<SeeAll label="30s Connect" onPress={() => router.navigate({ pathname: '/explore', params: { seg: 'tools', t: navStamp() } })} />}
          />
          <View style={styles.pad}>
            {feed
              ? feed.trendingTools.slice(0, 3).map((t) => <ToolRow key={t.slug} tool={t} />)
              : [0, 1, 2].map((i) => <SkeletonRow key={i} />)}
          </View>
        </Animated.View>
      </ScrollView>
      <StatusScrim />
      <ApiCodeSheet post={codePost} onClose={() => setCodePost(null)} />
    </View>
  );
}

/** Native edition of vigas.app's HeroApiPanel (`apps/web/src/components/hero-api-panel.tsx`). */
function LiveRatesBox({ models }: { models: ModelListItem[] }) {
  const byId = new Map(models.map((m) => [m.id, m]));
  const rows = LIVE_SHOWCASE.map((spec) => ({ spec, model: byId.get(spec.id) })).filter(
    (entry): entry is { spec: RateSpec; model: ModelListItem } => Boolean(entry.model),
  );

  return (
    <View style={styles.ratesBox}>
      <View style={styles.ratesHead}>
        <View style={styles.ratesTitleRow}>
          <Led color={colors.green} size={7} />
          <T f="sansSemi" size={14}>
            Live API rates
          </T>
        </View>
        <Tag text="$0 fee · first $5" color={colors.green} />
      </View>

      {rows.length ? (
        rows.map(({ spec, model }, i) => {
          const isFree = model.inputPerMillionMicros === 0 && model.outputPerMillionMicros === 0;
          const shortName = model.name.replace(/ \(.*\)$/, '');
          return (
            <PressableScale
              key={model.id}
              accessibilityLabel={`${shortName}, ${spec.speed}, ${formatPricePerMillion(model.inputPerMillionMicros)} input. Test in Chat.`}
              onPress={() => openChat(undefined, model.id)}
              scaleTo={0.99}
              style={[styles.rateRow, i > 0 && styles.rateSep]}
            >
              <OrgMonogram org={model.org} size={32} radius={9} />
              <View style={styles.flex}>
                <View style={styles.rateNameRow}>
                  <T f="sansSemi" size={14} numberOfLines={1} style={styles.shrink}>
                    {shortName}
                  </T>
                  <Tag text={spec.tag} color={isFree ? colors.green : colors.sand} />
                </View>
                <T f="mono" size={11} color={colors.ink3} numberOfLines={1}>
                  <Span f="monoMedium" color={spec.fast ? colors.green : colors.ink2}>
                    {spec.speed}
                  </Span>
                  {' · '}
                  {model.id}
                </T>
              </View>
              <View style={styles.rateRight}>
                <T f="monoSemi" size={12.5} color={isFree ? colors.green : colors.ink}>
                  {isFree
                    ? 'FREE'
                    : `${formatPricePerMillion(model.inputPerMillionMicros)} / ${formatPricePerMillion(model.outputPerMillionMicros)}`}
                </T>
                <T f="mono" size={10} color={colors.ink3}>
                  in / out · 1M
                </T>
              </View>
            </PressableScale>
          );
        })
      ) : (
        <View style={styles.ratePad}>
          <SkeletonRow square={32} />
          <SkeletonRow square={32} />
        </View>
      )}

      <View style={styles.ratesFoot}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate({ pathname: '/explore', params: { seg: 'tools', t: navStamp() } })}
          style={styles.rateChip}
        >
          <Icon name="plug" size={13} color={colors.ink2} />
          <T f="monoMedium" size={11.5} color={colors.ink2}>
            Connect IDE
          </T>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          onPress={() => router.navigate({ pathname: '/explore', params: { seg: 'models', t: navStamp() } })}
          style={styles.rateAll}
        >
          <T f="sansMedium" size={13} color={colors.orangeText}>
            All {models.length || 26} models →
          </T>
        </Pressable>
      </View>
    </View>
  );
}

function SeeAll({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={12} style={styles.seeAll}>
      <T f="sansMedium" size={14} color={colors.indigo}>
        {label}
      </T>
    </Pressable>
  );
}

function CarouselGap() {
  return <View style={{ width: CARD_GAP }} />;
}

function NewsCard({ item }: { item: NewsListItem }) {
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={item.title}
      onPress={() => router.push({ pathname: '/news/[slug]', params: { slug: item.slug } })}
      style={styles.newsCard}
    >
      <NewsCover cover={item.cover} />
      <View style={styles.newsText}>
        <T f="monoSemi" size={12} ls={0.08} color={colors.orange} numberOfLines={1}>
          {item.category.toUpperCase()} ·{' '}
          <Span f="monoMedium" color={colors.ink3}>
            {agoLabel(item.publishedAt)}
          </Span>
        </T>
        <T f="serif" size={21} lh={1.16} numberOfLines={3} style={styles.newsTitle}>
          {shortTitle(item.title)}
        </T>
      </View>
    </PressableScale>
  );
}

function ToolRow({ tool }: { tool: ToolItem }) {
  return (
    <PressableScale
      accessibilityLabel={`${tool.name}. ${tool.tagline}. ${tool.votes} upvotes`}
      onPress={() => router.navigate({ pathname: '/explore', params: { seg: 'tools', t: navStamp() } })}
      style={styles.toolRow}
      scaleTo={0.985}
    >
      <Monogram letter={tool.letter} color={tool.color} size={42} />
      <View style={styles.flex}>
        <T f="sansSemi">{tool.name}</T>
        <T size={13} color={colors.ink2} numberOfLines={1}>
          {tool.tagline}
        </T>
      </View>
      <T f="mono" size={12} color={colors.green}>
        ▲ {intl(tool.votes)}
      </T>
    </PressableScale>
  );
}

function CreditsStrip({
  signedIn,
  wallet,
  pending,
  error,
}: {
  signedIn: boolean;
  wallet: WalletResponse | null;
  pending: boolean;
  error: string | null;
}) {
  if (!signedIn) {
    return (
      <View style={[styles.card, styles.credits]}>
        <View style={styles.flex}>
          <Label color={colors.sand}>API Console · Credits</Label>
          <T f="serif" size={30} lh={1.08}>
            One balance, <Span f="serifItalic" color={colors.sand}>every lab.</Span>
          </T>
          <T f="mono" size={11.5} color={colors.ink3}>
            api.vigas.ai/v1 · Chat · Cursor · n8n
          </T>
        </View>
        <KeyButton label="Get key" onPress={() => router.push('/sign-in')} />
      </View>
    );
  }

  const week = wallet?.week.slice(-7) ?? [];
  const max = Math.max(...week.map((d) => d.costMicros), 1);
  const today = week[week.length - 1]?.costMicros ?? 0;

  return (
    <View style={[styles.card, styles.credits]}>
      <View style={styles.flex}>
        <Label color={colors.sand}>API Credits</Label>
        {wallet ? (
          <>
            <T f="serif" size={34} lh={1.05} numberOfLines={1} adjustsFontSizeToFit>
              {usd(wallet.balanceMicros)}
            </T>
            <T f="mono" size={12} color={colors.ink3}>
              {usd(today)} used today
            </T>
          </>
        ) : pending ? (
          <View style={{ gap: 6, marginTop: 4 }}>
            <Skeleton width={110} height={30} />
            <Skeleton width={90} height={12} />
          </View>
        ) : (
          <T f="mono" size={12} color={colors.ink3} style={{ marginTop: 6 }} numberOfLines={2}>
            {error ?? 'Balance unavailable'}
          </T>
        )}
      </View>
      {wallet && week.length ? (
        <View style={styles.miniBars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {week.map((d, i) => (
            <View
              key={d.date}
              style={[
                styles.miniBar,
                {
                  height: Math.max(4, Math.round((d.costMicros / max) * 40)),
                  backgroundColor: i === week.length - 1 ? colors.orange : colors.pillar,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
      <KeyButton label="Console" onPress={() => router.navigate('/wallet')} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  pad: { paddingHorizontal: GUTTER },
  row: { flexDirection: 'row', gap: CARD_GAP },
  pushRight: { marginLeft: 'auto' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 4, paddingLeft: 10, paddingRight: GUTTER },
  brand: { marginLeft: 2 },
  hero: { paddingHorizontal: GUTTER, paddingTop: 12 },
  h1: { marginTop: 8, marginBottom: 16 },
  ask: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  askFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  modelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.bg2,
  },
  arenaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(227,182,92,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(227,182,92,0.28)',
  },
  sendKey: { width: 44, height: 47 },
  sendEdge: { position: 'absolute', top: 3, left: 0, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.orangeEdge },
  sendFace: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  prompts: { paddingHorizontal: GUTTER, gap: 9, paddingTop: 12 },
  prompt: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(239,234,225,0.1)',
    justifyContent: 'center',
  },
  offline: { marginTop: 16 },
  section: { marginTop: 24 },
  ratesBox: {
    marginHorizontal: GUTTER,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
    overflow: 'hidden',
  },
  ratesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: colors.bg2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  ratesTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rateSep: { borderTopWidth: 1, borderTopColor: colors.line },
  rateNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  rateRight: { alignItems: 'flex-end', flexShrink: 0 },
  ratePad: { paddingHorizontal: 16, paddingVertical: 8 },
  ratesFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: colors.bg2,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  rateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  rateAll: { minHeight: 30, justifyContent: 'center' },
  bentoHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bentoTitle: { marginTop: 4 },
  card: {
    marginHorizontal: GUTTER,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  credits: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  miniBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 44 },
  miniBar: { width: 7, borderRadius: 2 },
  seeAll: { minHeight: 32, justifyContent: 'center' },
  carousel: { paddingHorizontal: GUTTER },
  newsCard: {
    width: CARD_W,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  newsText: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16, minHeight: 96 },
  newsTitle: { marginTop: 6 },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,234,225,0.06)',
    minHeight: 64,
  },
});
