import {
  formatContext,
  formatPricePerMillion,
  MODEL_TAGS,
  NEWS_CATEGORIES,
  TOOL_CATEGORIES,
  type ModelListItem,
  type ModelTag,
  type NewsCategory,
  type NewsListItem,
  type ToolCategory,
  type ToolItem,
} from '@vigas/core';
import { router, useLocalSearchParams, useScrollToTop } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Share, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CodeWell, Led, SpecStrip, Tag } from '@/components/boxes';
import { KeyButton } from '@/components/buttons';
import { ChipRow } from '@/components/chips';
import { Icon } from '@/components/icons';
import { MenuTrigger, WalletPill } from '@/components/menu-drawer';
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
import { fallbackModels, fallbackNews, fallbackTools } from '@/lib/fallback';
import { agoLabel, intl, shortTitle } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useRemote } from '@/lib/remote';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';
import { colors, GUTTER, orgMark, radius, withAlpha } from '@/theme';

type Seg = 'news' | 'models' | 'tools';
type ConnectClient = 'cursor' | 'cline' | 'claude' | 'n8n';
type Row =
  | { kind: 'tool'; tool: ToolItem }
  | { kind: 'news'; item: NewsListItem }
  | { kind: 'model'; model: ModelListItem };
type VoteState = { voted: boolean; votes: number };

const SEGMENTS = [
  { id: 'tools', label: 'Tools' },
  { id: 'models', label: 'Models' },
  { id: 'news', label: 'News' },
] as const;

const CONNECT_TABS: { id: ConnectClient; label: string; snippet: string; note: string }[] = [
  {
    id: 'cursor',
    label: 'Cursor',
    note: 'Settings → Models → OpenAI API Key → Override Base URL',
    snippet: 'Base URL: https://api.vigas.ai/v1\nAPI Key:  vg_live_••••••••\nModel:    anthropic/claude-fable-5.2',
  },
  {
    id: 'cline',
    label: 'Cline',
    note: 'API Provider: OpenAI Compatible',
    snippet: 'Base URL: https://api.vigas.ai/v1\nAPI Key:  vg_live_••••••••\nModel ID: deepseek/v4.1-flash',
  },
  {
    id: 'claude',
    label: 'Claude Code',
    note: 'Drop into ~/.zshrc or .env',
    snippet: 'export ANTHROPIC_BASE_URL="https://api.vigas.ai"\nexport ANTHROPIC_API_KEY="vg_live_••••••••"',
  },
  {
    id: 'n8n',
    label: 'n8n',
    note: 'OpenAI Credential → Base URL override',
    snippet: 'Base URL: https://api.vigas.ai/v1\nAPI Key:  vg_live_••••••••\nAuto:     vigas/auto',
  },
];

const TOOL_CHIPS: { id: 'All' | ToolCategory; label: string }[] = [{ id: 'All', label: 'All' }, ...TOOL_CATEGORIES.map((c) => ({ id: c, label: c }))];
const NEWS_CHIPS: { id: 'All' | NewsCategory; label: string }[] = [{ id: 'All', label: 'All' }, ...NEWS_CATEGORIES.map((c) => ({ id: c, label: c }))];
const MODEL_CHIPS: { id: 'All' | ModelTag; label: string }[] = [
  { id: 'All', label: 'All' },
  ...MODEL_TAGS.map((t) => ({ id: t, label: t[0]!.toUpperCase() + t.slice(1) })),
];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ seg?: string; focus?: string; t?: string }>();
  const { token, expire } = useSession();

  const [seg, setSeg] = useState<Seg>(params.seg === 'news' || params.seg === 'models' ? params.seg : 'tools');
  const [connectTab, setConnectTab] = useState<ConnectClient>('cursor');
  const [query, setQuery] = useState('');
  const [toolCat, setToolCat] = useState<'All' | ToolCategory>('All');
  const [newsCat, setNewsCat] = useState<'All' | NewsCategory>('All');
  const [modelTag, setModelTag] = useState<'All' | ModelTag>('All');
  const [votes, setVotes] = useState<Record<string, VoteState>>({});
  const [detail, setDetail] = useState<ToolItem | null>(null);

  // Deep links from Home ("See all", search) re-select the segment each time they're followed.
  const [lastNav, setLastNav] = useState(params.t);
  if (params.t !== lastNav) {
    setLastNav(params.t);
    if (params.seg === 'news' || params.seg === 'models' || params.seg === 'tools') setSeg(params.seg);
  }

  const inputRef = useRef<TextInputInstance>(null);
  useEffect(() => {
    if (!params.focus || !params.t) return;
    const id = setTimeout(() => inputRef.current?.focus(), 320);
    return () => clearTimeout(id);
  }, [params.focus, params.t]);

  const listRef = useRef<FlatList<Row>>(null);
  useScrollToTop(listRef);

  const news = useRemote('news', () => api.news({ limit: 60 }), { fallback: fallbackNews });
  const tools = useRemote('tools', () => api.tools({ sort: 'votes' }), { fallback: fallbackTools });
  const models = useRemote('models', () => api.models(), { fallback: fallbackModels });
  const active = seg === 'tools' ? tools : seg === 'models' ? models : news;

  const q = query.trim().toLowerCase();
  const voteOf = (t: ToolItem): VoteState => votes[t.slug] ?? { voted: !!t.voted, votes: t.votes };

  const allTools = tools.data?.items ?? [];
  const allModels = models.data?.items ?? [];

  const toolRows: Row[] = allTools
    .filter((t) => (toolCat === 'All' || t.category === toolCat) && (!q || `${t.name} ${t.tagline} ${t.category}`.toLowerCase().includes(q)))
    .map((tool) => ({ kind: 'tool', tool }));
  const newsRows: Row[] = (news.data?.items ?? [])
    .filter((n) => (newsCat === 'All' || n.category === newsCat) && (!q || `${n.title} ${n.dek} ${n.category}`.toLowerCase().includes(q)))
    .map((item) => ({ kind: 'news', item }));
  const modelRows: Row[] = allModels
    .filter((m) => (modelTag === 'All' || m.tags.includes(modelTag)) && (!q || `${m.name} ${m.id} ${m.org}`.toLowerCase().includes(q)))
    .map((model) => ({ kind: 'model', model }));

  const rows = seg === 'tools' ? toolRows : seg === 'models' ? modelRows : newsRows;
  const trending = [...allTools].sort((a, b) => b.votes - a.votes).slice(0, 3);
  const showTrending = seg === 'tools' && !q && toolCat === 'All' && trending.length > 0;
  const activeConnect = CONNECT_TABS.find((c) => c.id === connectTab) ?? CONNECT_TABS[0]!;

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

  const searchPlaceholder =
    seg === 'tools'
      ? allTools.length
        ? `Search ${intl(allTools.length)} tools`
        : 'Search tools'
      : seg === 'models'
        ? allModels.length
          ? `Search ${intl(allModels.length)} models & API prices`
          : 'Search models'
        : 'Search AI news';

  const header = (
    <View>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <MenuTrigger />
        <View style={styles.flex}>
          <T f="serif" size={30} lh={1.05} ls={-0.02} accessibilityRole="header">
            Hub
          </T>
        </View>
        <WalletPill />
      </View>

      <View style={styles.head}>
        <Segmented
          options={SEGMENTS}
          value={seg}
          onChange={(s) => setSeg(s)}
          accessibilityLabel="Section"
          pad={4}
          style={styles.segments}
        />
        <View style={styles.search}>
          <Icon name="search" size={20} color={colors.ink3} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
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
      ) : seg === 'models' ? (
        <ChipRow options={MODEL_CHIPS} value={modelTag} onChange={(t) => setModelTag(t)} accessibilityLabel="Model capability" style={styles.chips} height={38} />
      ) : (
        <ChipRow options={NEWS_CHIPS} value={newsCat} onChange={(c) => setNewsCat(c)} accessibilityLabel="News category" style={styles.chips} height={38} />
      )}

      {active.offline ? <OfflineNote style={styles.offline} onRetry={() => void active.refresh()} /> : null}

      {/* Models Gateway Spec Strip */}
      {seg === 'models' && !q ? (
        <View style={styles.gatewayBox}>
          <SpecStrip
            items={[
              { label: 'Gateway', value: 'api.vigas.ai', color: colors.orangeText },
              { label: 'Fee', value: '0% first $5', color: colors.green },
              { label: 'Routing', value: 'Auto-failover' },
            ]}
          />
        </View>
      ) : null}

      {/* Connect in 30s LCD box inside Tools */}
      {showTrending ? (
        <>
          <View style={styles.connectBox}>
            <View style={styles.connectHead}>
              <View style={styles.flex}>
                <Label color={colors.sand}>§ Connect in 30 seconds</Label>
                <T f="serif" size={24} lh={1.1} style={styles.connectTitle}>
                  Use your Vigas key in <Span f="serifItalic" color={colors.sand}>any IDE.</Span>
                </T>
              </View>
              <Led color={colors.green} size={7} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.connectPills}>
              {CONNECT_TABS.map((tab) => {
                const on = tab.id === connectTab;
                return (
                  <Pressable
                    key={tab.id}
                    accessibilityRole="button"
                    onPress={() => {
                      haptics.select();
                      setConnectTab(tab.id);
                    }}
                    style={[styles.connectPill, on && styles.connectPillOn]}
                  >
                    <T f="monoMedium" size={12} color={on ? colors.onOrange : colors.ink2}>
                      {tab.label}
                    </T>
                  </Pressable>
                );
              })}
            </ScrollView>
            <CodeWell caption={activeConnect.note} meta={<Tag text="OPENAI V1" color={colors.green} />}>
              <T f="mono" size={11.5} lh={1.55} color={colors.bodySoft} selectable>
                {activeConnect.snippet}
              </T>
            </CodeWell>
            <View style={styles.connectActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void Share.share({ message: activeConnect.snippet }).catch(() => undefined)}
                style={styles.connectGhost}
              >
                <Icon name="share" size={15} color={colors.ink} />
                <T f="monoMedium" size={12} color={colors.ink}>
                  Share config
                </T>
              </Pressable>
              <KeyButton
                label="Get API key"
                height={36}
                radius={11}
                fontSize={13}
                icon={<Icon name="key" size={14} color={colors.onOrange} />}
                onPress={() => router.navigate('/wallet')}
              />
            </View>
          </View>

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
      ) : seg === 'models' ? (
        <Heading style={styles.allTools}>{q || modelTag !== 'All' ? `${modelRows.length} models` : `${modelRows.length} models · tap to chat`}</Heading>
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
        keyExtractor={(r) => (r.kind === 'tool' ? `t:${r.tool.slug}` : r.kind === 'model' ? `m:${r.model.id}` : `n:${r.item.slug}`)}
        ListHeaderComponent={header}
        renderItem={({ item, index }) =>
          item.kind === 'tool' ? (
            <ToolRow tool={item.tool} vote={voteOf(item.tool)} index={index} onVote={() => void vote(item.tool)} onOpen={() => setDetail(item.tool)} />
          ) : item.kind === 'model' ? (
            <ModelRow model={item.model} index={index} />
          ) : (
            <NewsRow item={item.item} index={index} />
          )
        }
        itemLayoutAnimation={LinearTransition.duration(220)}
        ListEmptyComponent={
          active.pending ? (
            <View style={styles.pad}>
              {[0, 1, 2, 3, 4].map((i) => (
                <SkeletonRow key={i} square={seg === 'news' ? 64 : 48} />
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

function ModelRow({ model, index }: { model: ModelListItem; index: number }) {
  const chg = model.priceChange24h;
  const badgeColor = chg < 0 ? colors.green : chg > 0 ? colors.red : colors.ink3;
  const badgeText = chg < 0 ? `▼ ${Math.abs(chg)}%` : chg > 0 ? `▲ ${chg}%` : '—';
  const mark = orgMark(model.org);
  return (
    <Animated.View entering={index < 10 ? FadeInDown.duration(320).delay(index * 30) : undefined} style={styles.pad}>
      <PressableScale
        accessibilityLabel={`${model.name} by ${model.org}. Open in Chat`}
        onPress={() => {
          haptics.select();
          router.navigate({ pathname: '/chat', params: { model: model.id, t: String(Date.now()) } });
        }}
        scaleTo={0.985}
        style={styles.modelRow}
      >
        <Monogram letter={mark.letter} color={mark.color} size={46} radius={13} />
        <View style={styles.flex}>
          <View style={styles.modelHead}>
            <T f="sansSemi" numberOfLines={1} style={styles.flex}>
              {model.name}
            </T>
            <T f="monoSemi" size={11} color={badgeColor}>
              {badgeText}
            </T>
          </View>
          <T f="mono" size={12} color={colors.ink3} numberOfLines={1}>
            {model.id}
          </T>
          <T f="mono" size={12} color={colors.ink2}>
            {formatContext(model.contextLength)} · IN {formatPricePerMillion(model.inputPerMillionMicros)} · OUT {formatPricePerMillion(model.outputPerMillionMicros)}
          </T>
        </View>
        <Icon name="chevronRight" size={18} color={colors.ink3} />
      </PressableScale>
    </Animated.View>
  );
}

function ToolRow({ tool, vote, index, onVote, onOpen }: { tool: ToolItem; vote: VoteState; index: number; onVote: () => void; onOpen: () => void }) {
  return (
    <Animated.View entering={index < 10 ? FadeInDown.duration(320).delay(index * 35) : undefined} style={styles.pad}>
      <View style={styles.toolRow}>
        <PressableScale accessibilityLabel={`${tool.name}: ${tool.tagline}`} onPress={onOpen} style={styles.toolMain} scaleTo={0.985}>
          <Monogram letter={tool.letter} color={tool.color} size={48} radius={14} />
          <View style={styles.flex}>
            <View style={styles.toolTitleRow}>
              <T f="sansSemi">{tool.name}</T>
              {tool.runsOnVigas ? <Tag text="VIGAS KEY" color={colors.green} /> : null}
            </View>
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
            <CodeWell caption="Runs on your Vigas API key" meta={<Led color={colors.green} size={6} />}>
              <T f="mono" size={12} lh={1.5} color={colors.bodySoft} selectable>
                {'Base URL: https://api.vigas.ai/v1\nAPI Key:  Create in Wallet → API Keys'}
              </T>
            </CodeWell>
          ) : null}
          <View style={styles.sheetActions}>
            {tool.runsOnVigas ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  router.navigate('/wallet');
                }}
                style={styles.sheetGhost}
              >
                <Icon name="key" size={16} color={colors.ink} />
                <T f="sansMedium" size={14}>
                  Get key
                </T>
              </Pressable>
            ) : null}
            <KeyButton
              label="Visit site"
              height={48}
              fontSize={15}
              style={styles.flex}
              onPress={() => {
                void WebBrowser.openBrowserAsync(tool.url, { toolbarColor: colors.bg, controlsColor: colors.orange }).catch(() =>
                  toast('Couldn’t open the browser.', 'error'),
                );
              }}
            />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, minWidth: 0 },
  pad: { paddingHorizontal: GUTTER },
  listContent: { paddingBottom: 32, flexGrow: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 10,
    paddingRight: GUTTER,
    paddingBottom: 4,
  },
  head: { paddingHorizontal: GUTTER },
  segments: { marginTop: 10 },
  search: {
    marginTop: 12,
    height: 50,
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
  input: { flex: 1, minWidth: 0, color: colors.ink, fontFamily: 'Inter_400Regular', fontSize: 15.5, paddingVertical: 0, height: 48 },
  chips: { marginTop: 14 },
  offline: { marginTop: 14 },
  gatewayBox: { paddingHorizontal: GUTTER, marginTop: 14 },
  connectBox: {
    marginTop: 18,
    marginHorizontal: GUTTER,
    padding: 16,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
    gap: 12,
  },
  connectHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  connectTitle: { marginTop: 4 },
  connectPills: { gap: 7 },
  connectPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  connectPillOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  connectActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  connectGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line2,
  },
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
  allTools: { marginTop: 22, marginBottom: 4, marginHorizontal: GUTTER },
  newsGap: { height: 16 },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,234,225,0.06)',
  },
  modelHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,234,225,0.06)',
  },
  toolTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
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
  sheetActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line2,
  },
});
