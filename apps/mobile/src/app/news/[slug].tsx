import type { Article, Cover, LeaderboardEntry, ModelListItem } from '@vigas/core';
import { formatPricePerMillion, initials } from '@vigas/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  SlideInDown,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Rect } from 'react-native-svg';

import { KeyButton } from '@/components/buttons';
import { Markdown, parseBlocks } from '@/components/markdown';
import { Avatar } from '@/components/monogram';
import { DotGrid } from '@/components/news-cover';
import { IconButton } from '@/components/pressable';
import { Skeleton } from '@/components/skeleton';
import { EmptyState, OfflineNote } from '@/components/states';
import { Heading, Label, Span, T } from '@/components/text';
import { api, SITE_URL } from '@/lib/api';
import { fallbackArticle, fallbackLeaderboard, fallbackModels } from '@/lib/fallback';
import { baseModelName, navStamp, pct, shortDate, splitTitle } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useRemote } from '@/lib/remote';
import { toggleSaved, useIsSaved } from '@/lib/saved';
import { colors, GUTTER } from '@/theme';

const HEADER_H = 60;

export default function ArticleScreen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const saved = useIsSaved(slug);

  const article = useRemote<Article | null>(`article:${slug}`, () => api.article(slug), { fallback: () => fallbackArticle(slug) });
  const board = useRemote('lb:overall', () => api.leaderboard('overall'), { fallback: () => fallbackLeaderboard('overall') });
  const models = useRemote('models', () => api.models(), { fallback: fallbackModels });

  const progress = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    const max = Math.max(1, e.contentSize.height - e.layoutMeasurement.height);
    progress.set(Math.min(1, Math.max(0, e.contentOffset.y / max)));
  });
  const bar = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  const a = article.data;
  const mentioned = a ? pickModel(a, models.data?.items ?? []) : null;
  const chart = a ? chartRows(a, board.data?.entries ?? []) : null;

  const share = () => {
    if (!a) return;
    haptics.tap();
    void Share.share({ title: a.title, message: `${a.title}\n${SITE_URL}/news/${a.slug}` }).catch(() => undefined);
  };

  const openChat = () => {
    if (!a) return;
    router.navigate({
      pathname: '/chat',
      params: {
        mode: 'chat',
        model: mentioned?.id ?? '',
        prompt: mentioned ? `What is ${mentioned.name} best at, and what does it cost?` : `Summarize this story for me: “${a.title}”`,
        t: navStamp(),
      },
    });
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + HEADER_H, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {article.offline && a ? <OfflineNote style={styles.offline} onRetry={() => void article.refresh()} /> : null}
        {a ? (
          <ArticleBody article={a} chart={chart} />
        ) : article.pending ? (
          <ArticleSkeleton />
        ) : (
          <EmptyState title="Story not found" body={article.error ?? 'It may have been moved or unpublished.'} />
        )}
      </Animated.ScrollView>

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <IconButton icon="back" accessibilityLabel="Back" onPress={goBack} />
        <T f="mono" size={12} ls={0.1} color={colors.ink3}>
          VIGAS NEWS
        </T>
        <IconButton
          icon="bookmark"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save story'}
          accessibilityState={{ selected: saved }}
          color={saved ? colors.orange : colors.ink}
          fill={saved ? colors.orange : 'none'}
          iconSize={21}
          style={styles.pushRight}
          onPress={() => {
            haptics.tap();
            toggleSaved(slug);
          }}
        />
        <IconButton icon="share" accessibilityLabel="Share" iconSize={21} onPress={share} disabled={!a} />
        <View style={styles.progressTrack} pointerEvents="none">
          <Animated.View style={[styles.progress, bar]} />
        </View>
      </View>

      {a ? (
        <Animated.View
          entering={SlideInDown.delay(250).duration(380).easing(Easing.out(Easing.cubic))}
          style={[styles.dock, { bottom: insets.bottom + 14 }]}
        >
          <View style={styles.flex}>
            <T f="mono" size={12} color={colors.ink3}>
              In this story
            </T>
            <T f="sansMedium" size={14} numberOfLines={1}>
              {mentioned
                ? `${mentioned.name} · ${formatPricePerMillion(mentioned.inputPerMillionMicros)} / ${formatPricePerMillion(mentioned.outputPerMillionMicros)}`
                : 'Ask Vigas about it'}
            </T>
          </View>
          <KeyButton label="Try in Chat" onPress={openChat} />
        </Animated.View>
      ) : null}
    </View>
  );
}

type ChartRow = { name: string; value: number; highlight: boolean };

/** The first mentioned model that's in the catalogue, for the "In this story" dock. */
function pickModel(a: Article, models: ModelListItem[]): ModelListItem | null {
  for (const id of a.mentionedModelIds) {
    const m = models.find((x) => x.id === id);
    if (m) return m;
  }
  return null;
}

/**
 * Leaderboard stories get a win-share bar chart: the mentioned models plus the leaders, top four,
 * with the story's lead model highlighted.
 */
function chartRows(a: Article, entries: LeaderboardEntry[]): ChartRow[] | null {
  if (!['Models', 'Agents', 'Analysis'].includes(a.category)) return null;
  const onBoard = a.mentionedModelIds.filter((id) => entries.some((e) => e.modelId === id));
  if (onBoard.length === 0) return null;
  const lead = onBoard[0];
  const picked = new Map<string, LeaderboardEntry>();
  for (const e of entries) if (onBoard.includes(e.modelId)) picked.set(e.modelId, e);
  for (const e of entries) {
    if (picked.size >= 4) break;
    picked.set(e.modelId, e);
  }
  return [...picked.values()]
    .sort((x, y) => y.winRate - x.winRate)
    .slice(0, 4)
    .map((e) => ({ name: baseModelName(e.name), value: e.winRate, highlight: e.modelId === lead }));
}

function ArticleBody({ article: a, chart }: { article: Article; chart: ChartRow[] | null }) {
  const [main, tail] = splitTitle(a.title);
  // Chart after the first paragraph, pull quote after the second (or the last block of a short story).
  const blocks = parseBlocks(a.body);
  const paragraphs = blocks.flatMap((b, i) => (b.kind === 'p' ? [i] : []));
  const inserts: Record<number, ReactNode> = {};
  if (chart) inserts[paragraphs[0] ?? 0] = <WinShareChart rows={chart} />;
  if (a.pullQuote) {
    const at = paragraphs[1] ?? Math.max(0, blocks.length - 1);
    const existing = inserts[at];
    inserts[at] = (
      <>
        {existing}
        <View style={styles.quote}>
          <T f="serifItalic" size={25} lh={1.28} color={colors.sand}>
            “{a.pullQuote.text}”
          </T>
          <T f="mono" size={12} color={colors.ink3}>
            — {a.pullQuote.cite}
          </T>
        </View>
      </>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(280)}>
      <View style={styles.pad}>
        <View style={styles.kicker}>
          {a.flag ? (
            <View style={styles.flag}>
              <T f="monoSemi" size={12} ls={0.1} color={colors.onOrange}>
                {a.flag.toUpperCase()}
              </T>
            </View>
          ) : null}
          <T f="monoSemi" size={12} ls={0.1} color={colors.orange}>
            {a.category.toUpperCase()}
          </T>
        </View>
        <T f="serif" size={38} lh={1.06} ls={-0.024} accessibilityRole="header" style={styles.title}>
          {main}
          {tail ? (
            <Span f="serifItalic" color={colors.sand}>
              {' — '}
              {tail}
            </Span>
          ) : null}
        </T>
        <T f="serif" size={20} lh={1.4} color={colors.ink2} style={styles.dek}>
          {a.dek}
        </T>
        <View style={styles.byline}>
          <Avatar text={initials(a.author.name)} size={36} color={a.author.color} />
          <View>
            <T f="sansMedium" size={14}>
              {a.author.name}
            </T>
            <T f="mono" size={12} color={colors.ink3}>
              {shortDate(a.publishedAt)} · {a.readingMinutes} min read
            </T>
          </View>
        </View>
      </View>

      <Hero cover={a.cover} />

      <View style={styles.pad}>
        <Markdown text={a.body} variant="article" dropCap inserts={inserts} />
        {a.faq.length ? (
          <View style={styles.faq}>
            <Heading size={26}>Questions</Heading>
            {a.faq.map((f) => (
              <View key={f.q} style={styles.faqItem}>
                <T f="sansSemi" size={15}>
                  {f.q}
                </T>
                <T size={15} color={colors.ink2}>
                  {f.a}
                </T>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

/** The design's cover art: sun discs in the story color behind the Vigas colonnade, on a dot grid. */
function Hero({ cover }: { cover: Cover }) {
  return (
    <View style={styles.hero} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <DotGrid spacing={14} opacity={0.07} />
      <Svg viewBox="0 0 412 200" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
        <Circle cx={206} cy={86} r={96} fill={cover.color} opacity={0.14} />
        <Circle cx={206} cy={86} r={70} fill={cover.color} opacity={0.32} />
        <Circle cx={206} cy={86} r={46} fill={colors.sand} />
        <Rect x={96} y={64} width={220} height={8} fill={colors.ink} />
        {[108, 150, 198, 246, 288].map((x) => (
          <Rect key={x} x={x} y={76} width={16} height={78} fill={colors.ink} />
        ))}
        <Rect x={88} y={154} width={236} height={8} fill={colors.ink} />
        <Rect x={74} y={162} width={264} height={10} fill={colors.ink} opacity={0.7} />
      </Svg>
      <View style={styles.heroCaption}>
        <T f="mono" size={12} color={colors.ink3}>
          {cover.caption}
        </T>
        <T f="serif" size={30} lh={1} color={cover.color}>
          {cover.big}
        </T>
      </View>
    </View>
  );
}

function ChartBar({ row, max, index }: { row: ChartRow; max: number; index: number }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.set(withDelay(200 + index * 90, withTiming((row.value / max) * 100, { duration: 700, easing: Easing.out(Easing.cubic) })));
  }, [row.value, max, index, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.get()}%` }));
  return (
    <View style={styles.chartRow}>
      <View style={styles.chartTrack}>
        <Animated.View style={[styles.chartFill, { backgroundColor: row.highlight ? colors.orange : colors.bar }, fill]} />
        <T size={13} color={row.highlight ? colors.onOrange : colors.ink} numberOfLines={1} style={styles.chartLabel}>
          {row.name}
        </T>
      </View>
      <T f="mono" size={12} color={colors.green} align="right" style={styles.chartValue}>
        {pct(row.value)}
      </T>
    </View>
  );
}

function WinShareChart({ rows }: { rows: ChartRow[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <Animated.View
      entering={FadeInDown.duration(320)}
      style={styles.chart}
      accessibilityLabel={`Agent win share: ${rows.map((r) => `${r.name} ${pct(r.value)}`).join(', ')}`}
    >
      <T f="sansSemi" size={14}>
        Agent win share
      </T>
      <View style={styles.chartRows}>
        {rows.map((r, i) => (
          <ChartBar key={r.name} row={r} max={max} index={i} />
        ))}
      </View>
      <Label style={styles.chartSource}>Source · Vigas leaderboard</Label>
    </Animated.View>
  );
}

function ArticleSkeleton() {
  return (
    <View style={[styles.pad, { gap: 14, paddingTop: 20 }]} accessibilityLabel="Loading story">
      <Skeleton width={120} height={14} />
      <Skeleton height={36} />
      <Skeleton width="80%" height={36} />
      <Skeleton width="90%" height={18} />
      <Skeleton height={200} radius={0} style={{ marginHorizontal: -GUTTER, marginVertical: 10, width: 'auto' }} />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} width={i === 3 ? '60%' : '100%'} height={16} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, minWidth: 0 },
  pad: { paddingHorizontal: GUTTER },
  pushRight: { marginLeft: 'auto' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: 'rgba(18,17,15,0.94)',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 2 },
  progress: { height: 2, backgroundColor: colors.orange },
  offline: { marginTop: 12 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 20 },
  flag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, backgroundColor: colors.orange },
  title: { marginTop: 14, marginBottom: 12 },
  dek: { marginBottom: 18 },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hero: {
    marginVertical: 20,
    height: 200,
    backgroundColor: colors.cover,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  heroCaption: { position: 'absolute', left: GUTTER, top: 14 },
  quote: { gap: 8 },
  chart: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(239,234,225,0.1)',
  },
  chartRows: { gap: 6, marginTop: 12 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chartTrack: { flex: 1, height: 30, borderRadius: 7, backgroundColor: colors.bg2, overflow: 'hidden', justifyContent: 'center' },
  chartFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 7 },
  chartLabel: { paddingHorizontal: 10 },
  chartValue: { width: 56 },
  chartSource: { marginTop: 12 },
  faq: { marginTop: 32, gap: 14 },
  faqItem: { gap: 4, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
  dock: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingRight: 8,
    paddingLeft: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(28,27,24,0.97)',
    borderWidth: 1,
    borderColor: colors.line2,
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 20 },
    elevation: 16,
  },
});
