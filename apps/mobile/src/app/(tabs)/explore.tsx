import { NEWS_CATEGORIES, TOOL_CATEGORIES, type NewsCategory, type NewsListItem, type ToolCategory, type ToolItem } from '@vigas/core';
import { router, useLocalSearchParams, useScrollToTop } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyButton } from '@/components/buttons';
import { ChipRow } from '@/components/chips';
import { Icon } from '@/components/icons';
import { Monogram } from '@/components/monogram';
import { NewsCover } from '@/components/news-cover';
import { IconButton, PressableScale } from '@/components/pressable';
import { Refresher, StatusScrim } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { Sheet } from '@/components/sheet';
import { SkeletonRow } from '@/components/skeleton';
import { EmptyState, OfflineNote } from '@/components/states';
import { Heading, Label, Span, T } from '@/components/text';
import { api, errorMessage, isUnauthorized, withTimeout } from '@/lib/api';
import { fallbackNews, fallbackTools } from '@/lib/fallback';
import { agoLabel, intl, shortTitle } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useRemote } from '@/lib/remote';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';
import { colors, GUTTER, withAlpha } from '@/theme';

type Seg = 'news' | 'tools';
type Row = { kind: 'tool'; tool: ToolItem } | { kind: 'news'; item: NewsListItem };
type VoteState = { voted: boolean; votes: number };

const SEGMENTS = [
  { id: 'news', label: 'News' },
  { id: 'tools', label: 'Tools' },
] as const;
const TOOL_CHIPS = [{ id: 'All', label: 'All' }, ...TOOL_CATEGORIES.map((c) => ({ id: c, label: c }))];
const NEWS_CHIPS = [{ id: 'All', label: 'All' }, ...NEWS_CATEGORIES.map((c) => ({ id: c, label: c }))];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ seg?: string; focus?: string; t?: string }>();
  const { token, expire } = useSession();

  const [seg, setSeg] = useState<Seg>(params.seg === 'news' ? 'news' : 'tools');
  const [query, setQuery] = useState('');
  const [toolCat, setToolCat] = useState<'All' | ToolCategory>('All');
  const [newsCat, setNewsCat] = useState<'All' | NewsCategory>('All');
  const [votes, setVotes] = useState<Record<string, VoteState>>({});
  const [detail, setDetail] = useState<ToolItem | null>(null);

  // Deep links from Home ("See all", search) re-select the segment each time they're followed.
  const [lastNav, setLastNav] = useState(params.t);
  if (params.t !== lastNav) {
    setLastNav(params.t);
    if (params.seg === 'news' || params.seg === 'tools') setSeg(params.seg);
  }

  const inputRef = useRef<TextInput>(null);
  useEffect(() => {
    if (!params.focus || !params.t) return;
    const id = setTimeout(() => inputRef.current?.focus(), 320);
    return () => clearTimeout(id);
  }, [params.focus, params.t]);

  const listRef = useRef<FlatList<Row>>(null);
  useScrollToTop(listRef);

  const news = useRemote('news', () => api.news({ limit: 60 }), { fallback: fallbackNews });
  const tools = useRemote('tools', () => api.tools({ sort: 'votes' }), { fallback: fallbackTools });
  const active = seg === 'tools' ? tools : news;

  const q = query.trim().toLowerCase();
  const voteOf = (t: ToolItem): VoteState => votes[t.slug] ?? { voted: !!t.voted, votes: t.votes };

  const allTools = tools.data?.items ?? [];
  const toolRows: Row[] = allTools
    .filter((t) => (toolCat === 'All' || t.category === toolCat) && (!q || `${t.name} ${t.tagline} ${t.category}`.toLowerCase().includes(q)))
    .map((tool) => ({ kind: 'tool', tool }));
  const newsRows: Row[] = (news.data?.items ?? [])
    .filter((n) => (newsCat === 'All' || n.category === newsCat) && (!q || `${n.title} ${n.dek} ${n.category}`.toLowerCase().includes(q)))
    .map((item) => ({ kind: 'news', item }));
  const rows = seg === 'tools' ? toolRows : newsRows;
  const trending = [...allTools].sort((a, b) => b.votes - a.votes).slice(0, 3);
  const showTrending = seg === 'tools' && !q && toolCat === 'All' && trending.length > 0;

  const vote = async (t: ToolItem) => {
    if (!token) {
      router.push('/sign-in');
      return;
    }
    const before = voteOf(t);
    const optimistic = { voted: !before.voted, votes: before.votes + (before.voted ? -1 : 1) };
    haptics.tap();
    setVotes((v) => ({ ...v, [t.slug]: optimistic }));
    try {
      const res = await withTimeout(api.voteTool(t.slug));
      setVotes((v) => ({ ...v, [t.slug]: { voted: res.voted, votes: res.votes } }));
    } catch (e) {
      setVotes((v) => ({ ...v, [t.slug]: before }));
      haptics.error();
      toast(errorMessage(e), 'error');
      if (isUnauthorized(e)) expire();
    }
  };

  const header = (
    <View>
      <View style={[styles.head, { paddingTop: insets.top + 24 }]}>
        <T f="serif" size={44} lh={1.05} ls={-0.02} accessibilityRole="header">
          Explore
        </T>
        <Segmented
          options={SEGMENTS}
          value={seg}
          onChange={(s) => setSeg(s)}
          accessibilityLabel="Section"
          style={styles.segments}
        />
        <View style={styles.search}>
          <Icon name="search" size={20} color={colors.ink3} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={seg === 'tools' ? (allTools.length ? `Search ${intl(allTools.length)} tools` : 'Search tools') : 'Search AI news'}
            placeholderTextColor={colors.ink3}
            accessibilityLabel="Search"
            returnKeyType="search"
            autoCorrect={false}
            selectionColor={colors.orange}
            cursorColor={colors.orange}
            style={styles.input}
          />
          {query ? (
            <IconButton icon="close" accessibilityLabel="Clear search" size={40} iconSize={18} color={colors.ink2} onPress={() => setQuery('')} />
          ) : null}
        </View>
      </View>
      {seg === 'tools' ? (
        <ChipRow options={TOOL_CHIPS} value={toolCat} onChange={(c) => setToolCat(c)} accessibilityLabel="Tool category" style={styles.chips} height={38} />
      ) : (
        <ChipRow options={NEWS_CHIPS} value={newsCat} onChange={(c) => setNewsCat(c)} accessibilityLabel="News category" style={styles.chips} height={38} />
      )}
      {active.offline ? <OfflineNote style={styles.offline} onRetry={() => void active.refresh()} /> : null}
      {showTrending ? (
        <>
          <View style={styles.trendHead}>
            <Icon name="flame" size={18} color={colors.orange} />
            <Heading>Trending this week</Heading>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendRow}>
            {trending.map((t, k) => (
              <PressableScale
                key={t.slug}
                accessibilityLabel={`Number ${k + 1} trending: ${t.name}`}
                onPress={() => setDetail(t)}
                style={[styles.trendCard, k === 0 && styles.trendFirst]}
              >
                <View style={styles.trendTop}>
                  <Monogram letter={t.letter} color={t.color} size={46} radius={13} />
                  <T f="serif" size={34} lh={1} color={k === 0 ? colors.orange : colors.pillar}>
                    {`0${k + 1}`}
                  </T>
                </View>
                <View>
                  <T f="sansSemi">{t.name}</T>
                  <T f="mono" size={12} color={colors.ink3}>
                    {t.category} · ▲ {intl(voteOf(t).votes)}
                  </T>
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        </>
      ) : null}
      {seg === 'tools' ? (
        <Heading style={styles.allTools}>{q || toolCat !== 'All' ? `${toolRows.length} tools` : 'All tools'}</Heading>
      ) : (
        <View style={styles.newsGap} />
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <Animated.FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(r) => (r.kind === 'tool' ? `t:${r.tool.slug}` : `n:${r.item.slug}`)}
        ListHeaderComponent={header}
        renderItem={({ item, index }) =>
          item.kind === 'tool' ? (
            <ToolRow tool={item.tool} vote={voteOf(item.tool)} index={index} onVote={() => void vote(item.tool)} onOpen={() => setDetail(item.tool)} />
          ) : (
            <NewsRow item={item.item} index={index} />
          )
        }
        itemLayoutAnimation={LinearTransition.duration(220)}
        ListEmptyComponent={
          active.pending ? (
            <View style={styles.pad}>
              {[0, 1, 2, 3, 4].map((i) => (
                <SkeletonRow key={i} square={seg === 'tools' ? 48 : 64} />
              ))}
            </View>
          ) : (
            <EmptyState title="Nothing matches" body={q ? `No ${seg} for “${query.trim()}”.` : 'Pull to refresh.'} />
          )
        }
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={<Refresher refreshing={active.refreshing} progressViewOffset={insets.top} onRefresh={() => void active.refresh()} />}
      />
      <StatusScrim />
      <ToolSheet tool={detail} vote={detail ? voteOf(detail) : null} onVote={() => detail && void vote(detail)} onClose={() => setDetail(null)} />
    </View>
  );
}

function ToolRow({ tool, vote, index, onVote, onOpen }: { tool: ToolItem; vote: VoteState; index: number; onVote: () => void; onOpen: () => void }) {
  return (
    <Animated.View entering={index < 10 ? FadeInDown.duration(320).delay(index * 35) : undefined} style={styles.pad}>
      <View style={styles.toolRow}>
        <PressableScale accessibilityLabel={`${tool.name}: ${tool.tagline}`} onPress={onOpen} style={styles.toolMain} scaleTo={0.985}>
          <Monogram letter={tool.letter} color={tool.color} size={48} radius={14} />
          <View style={styles.flex}>
            <T f="sansSemi">{tool.name}</T>
            <T size={13} lh={1.35} color={colors.ink2}>
              {tool.tagline}
            </T>
            <T f="mono" size={12} color={colors.ink3}>
              {tool.category} · {tool.pricing} ·{' '}
              <Span color={colors.sand}>★ {tool.rating.toFixed(1)}</Span>
            </T>
          </View>
        </PressableScale>
        <UpvoteButton name={tool.name} vote={vote} onPress={onVote} />
      </View>
    </Animated.View>
  );
}

function UpvoteButton({ name, vote, onPress }: { name: string; vote: VoteState; onPress: () => void }) {
  const on = vote.voted;
  return (
    <PressableScale
      accessibilityLabel={`Upvote ${name}`}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      scaleTo={0.9}
      style={[styles.upvote, on ? styles.upvoteOn : styles.upvoteOff]}
    >
      <Icon name="chevronUp" size={16} color={on ? colors.orangeText : colors.ink} />
      <T f="monoSemi" size={12} lh={1.2} color={on ? colors.orangeText : colors.ink}>
        {intl(vote.votes)}
      </T>
    </PressableScale>
  );
}

function NewsRow({ item, index }: { item: NewsListItem; index: number }) {
  return (
    <Animated.View entering={index < 10 ? FadeInDown.duration(320).delay(index * 35) : undefined} style={styles.pad}>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={item.title}
        onPress={() => router.push({ pathname: '/news/[slug]', params: { slug: item.slug } })}
        style={styles.newsRow}
        scaleTo={0.985}
      >
        <View style={styles.flex}>
          <T f="monoSemi" size={12} ls={0.08} color={colors.orange}>
            {item.category.toUpperCase()}{' '}
            <Span f="monoMedium" color={colors.ink3}>
              · {agoLabel(item.publishedAt)}
            </Span>
          </T>
          <T f="serif" size={20} lh={1.18} style={styles.newsTitle} numberOfLines={4}>
            {shortTitle(item.title)}
          </T>
        </View>
        <NewsCover cover={item.cover} variant="thumb" />
      </PressableScale>
    </Animated.View>
  );
}

function ToolSheet({ tool, vote, onVote, onClose }: { tool: ToolItem | null; vote: VoteState | null; onVote: () => void; onClose: () => void }) {
  return (
    <Sheet visible={!!tool} onClose={onClose}>
      {tool && vote ? (
        <View style={styles.sheetBody}>
          <View style={styles.sheetHead}>
            <Monogram letter={tool.letter} color={tool.color} size={56} radius={16} />
            <View style={styles.flex}>
              <Heading size={28}>{tool.name}</Heading>
              <T f="mono" size={12} color={colors.ink3}>
                {tool.category} · {tool.pricing} · <Span color={colors.sand}>★ {tool.rating.toFixed(1)}</Span>
              </T>
            </View>
            <UpvoteButton name={tool.name} vote={vote} onPress={onVote} />
          </View>
          <T size={16} color={colors.ink}>
            {tool.tagline}
          </T>
          <T size={14} color={colors.ink2}>
            {tool.description}
          </T>
          {tool.runsOnVigas ? (
            <View style={styles.runsOn}>
              <Icon name="check" size={14} color={colors.green} />
              <Label color={colors.green}>Runs on your Vigas key</Label>
            </View>
          ) : null}
          <KeyButton
            label="Visit site"
            height={50}
            fontSize={16}
            onPress={() => {
              void WebBrowser.openBrowserAsync(tool.url, { toolbarColor: colors.bg, controlsColor: colors.orange }).catch(() =>
                toast('Couldn’t open the browser.', 'error'),
              );
            }}
          />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, minWidth: 0 },
  pad: { paddingHorizontal: GUTTER },
  listContent: { paddingBottom: 28, flexGrow: 1 },
  head: { paddingHorizontal: GUTTER },
  segments: { marginTop: 18, padding: 4 },
  search: {
    marginTop: 12,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(239,234,225,0.1)',
  },
  input: { flex: 1, minWidth: 0, color: colors.ink, fontFamily: 'Inter_400Regular', fontSize: 16, paddingVertical: 0, height: 50 },
  chips: { marginTop: 14 },
  offline: { marginTop: 14 },
  trendHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 22, paddingBottom: 12, paddingHorizontal: GUTTER },
  trendRow: { paddingHorizontal: GUTTER, gap: 8 },
  trendCard: {
    width: 200,
    padding: 16,
    gap: 12,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  trendFirst: { borderColor: withAlpha(colors.orange, 0.4) },
  trendTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  allTools: { marginTop: 24, marginBottom: 4, marginHorizontal: GUTTER },
  newsGap: { height: 16 },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,234,225,0.06)',
  },
  toolMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  upvote: {
    width: 52,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  upvoteOn: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  upvoteOff: { borderColor: colors.line2, backgroundColor: 'transparent' },
  newsRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,234,225,0.06)',
  },
  newsTitle: { marginTop: 5 },
  sheetBody: { paddingHorizontal: GUTTER, paddingTop: 8, gap: 14 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  runsOn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
