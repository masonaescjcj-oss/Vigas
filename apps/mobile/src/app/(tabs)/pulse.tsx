import { PULSE_KINDS, type PulsePost, type PulsePostKind, type PulseSort } from '@vigas/core';
import { router, useScrollToTop } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CodeWell, FlutedRule, Led, SpecStrip } from '@/components/boxes';
import { KeyButton } from '@/components/buttons';
import { ChipRow } from '@/components/chips';
import { Icon } from '@/components/icons';
import { MenuTrigger, WalletPill } from '@/components/menu-drawer';
import { PressableScale } from '@/components/pressable';
import { ApiCodeSheet, PostCard } from '@/components/pulse';
import { Refresher, StatusScrim } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { Skeleton } from '@/components/skeleton';
import { EmptyState, OfflineNote } from '@/components/states';
import { Label, Span, T } from '@/components/text';
import { navStamp } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { usePulseFeed } from '@/lib/pulse';
import { colors, GUTTER, radius } from '@/theme';

type Filter = 'all' | PulsePostKind | 'saved';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'battle', label: 'Battles' },
  { id: 'prompt', label: 'Prompts' },
  { id: 'design', label: 'Designs' },
  { id: 'saved', label: 'Saved' },
];

const SORTS: { id: PulseSort; label: string }[] = [
  { id: 'hot', label: 'Hot' },
  { id: 'new', label: 'New' },
];

export default function PulseScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<PulseSort>('hot');
  const [codePost, setCodePost] = useState<PulsePost | null>(null);
  const feed = usePulseFeed(sort);
  const listRef = useRef<FlatList<PulsePost>>(null);
  useScrollToTop(listRef);

  const items = feed.items.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'saved') return !!p.bookmarked;
    return p.kind === filter;
  });

  const battleCount = feed.items.filter((p) => p.kind === 'battle').length;
  const promptCount = feed.items.filter((p) => p.kind === 'prompt').length;
  const designCount = feed.items.filter((p) => p.kind === 'design').length;

  const openCompose = (kind: PulsePostKind = 'prompt') => {
    haptics.press();
    router.push({ pathname: '/compose', params: { kind, t: navStamp() } });
  };

  const header = (
    <View>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <MenuTrigger />
        <View style={styles.flex}>
          <T f="serif" size={30} lh={1.05} ls={-0.02} accessibilityRole="header">
            Pulse
          </T>
        </View>
        <WalletPill />
        <KeyButton
          label="Post"
          height={36}
          radius={11}
          fontSize={13}
          icon={<Icon name="plus" size={14} color={colors.onOrange} />}
          accessibilityLabel="Share prompt, battle or design"
          onPress={() => openCompose(filter === 'battle' || filter === 'design' ? filter : 'prompt')}
        />
      </View>

      <View style={styles.masthead}>
        <View style={styles.liveRow}>
          <Led color={colors.orange} size={7} />
          <Label color={colors.sand}>§ Builder stream · Prompts · A/B Battles · UI</Label>
        </View>
        <T f="serif" size={34} lh={1.06} ls={-0.02} style={styles.heroTitle}>
          Ship prompts, compare{' '}
          <Span f="serifItalic" color={colors.sand}>
            models live.
          </Span>
        </T>

        <SpecStrip
          items={[
            { label: 'Battles', value: String(battleCount), color: colors.orangeText },
            { label: 'Prompts', value: String(promptCount), color: colors.sand },
            { label: 'Designs', value: String(designCount), color: colors.indigo },
          ]}
          style={styles.specs}
        />

        {/* Quick composer card modeled after the website's LCD terminal well */}
        <PressableScale accessibilityLabel="Create a Pulse post" onPress={() => openCompose('prompt')} style={styles.quickWrap}>
          <CodeWell caption="vigas://pulse/new" meta={<T f="mono" size={10.5} color={colors.orangeText}>TAP TO POST</T>}>
            <T f="mono" size={12.5} color={colors.ink2}>
              <Span f="mono" color={colors.orange}>
                {'> '}
              </Span>
              Share a prompt recipe, blind model battle, or UI showdown…
            </T>
            <View style={styles.quickKinds}>
              {PULSE_KINDS.map((k) => (
                <Pressable
                  key={k}
                  accessibilityRole="button"
                  onPress={() => openCompose(k)}
                  hitSlop={6}
                  style={styles.quickPill}
                >
                  <T f="monoMedium" size={11} color={colors.ink}>
                    + {k}
                  </T>
                </Pressable>
              ))}
            </View>
          </CodeWell>
        </PressableScale>

        <View style={styles.controls}>
          <Segmented options={SORTS} value={sort} onChange={setSort} height={36} fontSize={13} tone="dark" style={styles.sortSeg} />
          <FlutedRule style={styles.sortRule} />
        </View>
      </View>

      <ChipRow options={FILTERS} value={filter} onChange={setFilter} accessibilityLabel="Filter posts" style={styles.chips} height={38} />
      {feed.offline ? <OfflineNote style={styles.offline} onRetry={() => void feed.refresh()} /> : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <Animated.FlatList
        ref={listRef}
        data={items}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <Animated.View entering={index < 6 ? FadeInDown.duration(320).delay(index * 45) : undefined} style={styles.postWrap}>
            <PostCard post={item} onCode={setCodePost} />
          </Animated.View>
        )}
        itemLayoutAnimation={LinearTransition.duration(220)}
        ListEmptyComponent={
          feed.pending ? (
            <View style={styles.skel}>
              <Skeleton height={220} radius={radius.card} />
              <Skeleton height={260} radius={radius.card} />
            </View>
          ) : (
            <EmptyState
              title={filter === 'saved' ? 'No saved posts yet' : 'Nothing here yet'}
              body={filter === 'saved' ? 'Bookmark any prompt or battle to find it fast.' : 'Be the first builder to post in this track.'}
            />
          )
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<Refresher refreshing={feed.refreshing} progressViewOffset={insets.top} onRefresh={() => void feed.refresh()} />}
      />
      <StatusScrim />
      <ApiCodeSheet post={codePost} onClose={() => setCodePost(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, minWidth: 0 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 10,
    paddingRight: GUTTER,
    paddingBottom: 6,
  },
  masthead: { paddingHorizontal: GUTTER, paddingTop: 6 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroTitle: { marginTop: 6 },
  specs: { marginTop: 14 },
  quickWrap: { marginTop: 14 },
  quickKinds: { flexDirection: 'row', gap: 8, marginTop: 10 },
  quickPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  sortSeg: { width: 150 },
  sortRule: { flex: 1, opacity: 0.45 },
  chips: { marginTop: 12, marginBottom: 14 },
  offline: { marginBottom: 12 },
  postWrap: { paddingHorizontal: GUTTER, marginBottom: 14 },
  skel: { paddingHorizontal: GUTTER, gap: 14 },
  list: { paddingBottom: 32 },
});
