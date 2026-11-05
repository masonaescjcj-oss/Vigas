import type { NewsListItem, ToolItem, WalletResponse } from '@vigas/core';
import { router, useScrollToTop } from 'expo-router';
import { useRef } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyButton } from '@/components/buttons';
import { Icon, LogoMark } from '@/components/icons';
import { Avatar, Monogram } from '@/components/monogram';
import { NewsCover } from '@/components/news-cover';
import { Colonnade } from '@/components/pillars';
import { IconButton, PressableScale } from '@/components/pressable';
import { Refresher, StatusScrim } from '@/components/screen';
import { Skeleton, SkeletonRow } from '@/components/skeleton';
import { OfflineNote } from '@/components/states';
import { Heading, Label, Span, T } from '@/components/text';
import { api } from '@/lib/api';
import { fallbackHome } from '@/lib/fallback';
import { agoLabel, dayLabel, greeting, intl, navStamp, pct, pillarName, shortTitle, usd } from '@/lib/format';
import { useRemote } from '@/lib/remote';
import { useSession, userInitials } from '@/lib/session';
import { useWallet } from '@/lib/wallet';
import { colors, GUTTER, radius } from '@/theme';

const PROMPTS = ['Compare Opus vs GPT-6', 'AI news in 60 seconds', 'Cheapest model for PDFs', 'Write a launch tweet'];
const CARD_W = 290;
const CARD_GAP = 10;

const openChat = (prompt?: string) =>
  router.navigate({ pathname: '/chat', params: { prompt: prompt ?? '', mode: 'chat', t: navStamp() } });

const enter = (i: number) => FadeInDown.duration(420).delay(40 + i * 55);

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useSession();
  const home = useRemote('home', () => api.home(), { fallback: fallbackHome });
  const wallet = useWallet();
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);

  const feed = home.data;
  const now = new Date();

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <Refresher
            refreshing={home.refreshing || wallet.refreshing}
            progressViewOffset={insets.top}
            onRefresh={() => {
              void home.refresh();
              void wallet.refresh();
            }}
          />
        }
      >
        <View style={styles.header}>
          <LogoMark size={22} />
          <T f="serif" size={26} lh={1.05} style={styles.brand}>
            Vigas
          </T>
          <IconButton
            icon="search"
            accessibilityLabel="Search"
            style={styles.pushRight}
            onPress={() => router.navigate({ pathname: '/explore', params: { focus: '1', t: navStamp() } })}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={token ? 'Account and wallet' : 'Sign in'}
            hitSlop={5}
            onPress={() => (token ? router.navigate('/wallet') : router.push('/sign-in'))}
            style={styles.avatarBtn}
          >
            {token ? (
              <Avatar text={userInitials(user)} />
            ) : (
              <View style={styles.guest}>
                <Icon name="lock" size={16} color={colors.ink2} />
              </View>
            )}
          </Pressable>
        </View>

        <Animated.View entering={enter(0)} style={styles.hero}>
          <Label>{dayLabel(now)}</Label>
          <T f="serif" size={38} lh={1.08} ls={-0.02} accessibilityRole="header" style={styles.h1}>
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
                <T f="mono" size={12} color={colors.ink}>
                  vigas/auto
                </T>
              </View>
              <View style={[styles.askIcon, styles.pushRight]}>
                <Icon name="mic" size={20} color={colors.ink2} />
              </View>
              <View style={styles.sendKey}>
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
                <T size={14} color={colors.ink2}>
                  {p}
                </T>
              </PressableScale>
            ))}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <CreditsStrip signedIn={!!token} wallet={wallet.data} pending={wallet.pending} error={wallet.error} />
        </Animated.View>

        {home.offline ? <OfflineNote style={styles.offline} onRetry={() => void home.refresh()} /> : null}

        <Animated.View entering={enter(3)} style={styles.section}>
          <View style={styles.sectionHead}>
            <Heading size={26}>Today in AI</Heading>
            <SeeAll label="See all" onPress={() => router.navigate({ pathname: '/explore', params: { seg: 'news', t: navStamp() } })} />
          </View>
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

        <Animated.View entering={enter(4)} style={[styles.card, styles.agents]}>
          <View style={[styles.sectionHead, styles.noPad, { marginBottom: 16 }]}>
            <Heading>Top agents</Heading>
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
              onPress={() => router.navigate('/ranks')}
            />
          ) : (
            <View style={[styles.row, { alignItems: 'flex-end', height: 190 }]}>
              {[110, 90, 80, 74, 70].map((h, i) => (
                <Skeleton key={i} height={h} style={styles.flex} radius={4} />
              ))}
            </View>
          )}
        </Animated.View>

        <Animated.View entering={enter(5)} style={styles.tools}>
          <View style={[styles.sectionHead, styles.noPad, { marginBottom: 6 }]}>
            <Heading>Trending tools</Heading>
            <SeeAll label="Explore" onPress={() => router.navigate({ pathname: '/explore', params: { seg: 'tools', t: navStamp() } })} />
          </View>
          {feed
            ? feed.trendingTools.slice(0, 3).map((t) => <ToolRow key={t.slug} tool={t} />)
            : [0, 1, 2].map((i) => <SkeletonRow key={i} />)}
        </Animated.View>
      </ScrollView>
      <StatusScrim />
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
          <Label>Credits</Label>
          <T f="serif" size={30} lh={1.1}>
            One balance
          </T>
          <T f="mono" size={12} color={colors.ink3}>
            API · Chat · RetroBuild
          </T>
        </View>
        <KeyButton label="Sign in" onPress={() => router.push('/sign-in')} />
      </View>
    );
  }

  const week = wallet?.week.slice(-7) ?? [];
  const max = Math.max(...week.map((d) => d.costMicros), 1);
  const today = week[week.length - 1]?.costMicros ?? 0;

  return (
    <View style={[styles.card, styles.credits]}>
      <View style={styles.flex}>
        <Label>Credits</Label>
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
      <KeyButton label="Top up" onPress={() => router.navigate('/wallet')} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', gap: CARD_GAP },
  pushRight: { marginLeft: 'auto' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 14, paddingBottom: 4, paddingLeft: GUTTER, paddingRight: 12 },
  brand: { marginLeft: 4 },
  avatarBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  guest: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  hero: { paddingHorizontal: GUTTER, paddingTop: 14 },
  h1: { marginTop: 8, marginBottom: 18 },
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
  modelPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.line2 },
  askIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendKey: { width: 44, height: 47 },
  sendEdge: { position: 'absolute', top: 3, left: 0, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.orangeEdge },
  sendFace: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  prompts: { paddingHorizontal: GUTTER, gap: 10, paddingTop: 12 },
  prompt: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(239,234,225,0.1)',
    justifyContent: 'center',
  },
  card: {
    marginHorizontal: GUTTER,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  credits: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  miniBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 44 },
  miniBar: { width: 7, borderRadius: 2 },
  offline: { marginTop: 16 },
  section: { marginTop: 26 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    marginBottom: 12,
  },
  noPad: { paddingHorizontal: 0 },
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
  agents: { marginTop: 26, padding: 18 },
  tools: { marginTop: 26, marginHorizontal: GUTTER },
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
