import { pulseApiSnippet, voteShare, type PulsePost, type PulseSide } from '@vigas/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { SITE_URL } from '@/lib/api';
import { agoLabel, intl, navStamp, usd } from '@/lib/format';
import { modelLabel, reactToPost, runCostMicros, toggleBookmark } from '@/lib/pulse';
import { toast } from '@/lib/toast';
import { colors, radius } from '@/theme';

import { CodeWell, FlutedBar, Led, SpecStrip, Tag } from './boxes';
import { KeyButton } from './buttons';
import { Icon, type IconName } from './icons';
import { Monogram, OrgMonogram } from './monogram';
import { DotGrid } from './news-cover';
import { PressableScale } from './pressable';
import { Segmented } from './segmented';
import { Sheet } from './sheet';
import { Label, Span, T } from './text';

export const KIND_TONE: Record<PulsePost['kind'], { label: string; color: string }> = {
  prompt: { label: 'Prompt', color: colors.sand },
  battle: { label: 'Battle', color: colors.orange },
  design: { label: 'Design', color: colors.indigo },
};

export function runInChat(prompt: string, modelId?: string) {
  router.navigate({
    pathname: '/chat',
    params: { prompt, mode: 'chat', model: modelId && modelId !== 'vigas/auto' ? modelId : '', t: navStamp() },
  });
}

function sharePost(post: PulsePost) {
  const msg = `${post.body ? `${post.body}\n\n` : ''}“${post.prompt}”\n\n— @${post.author.handle} on Vigas Pulse · ${SITE_URL}`;
  void Share.share({ message: msg }).catch(() => undefined);
}

/** A Pulse post: author row, caption and a kind-specific payload, then the action rail. */
export function PostCard({ post, onCode }: { post: PulsePost; onCode: (post: PulsePost) => void }) {
  const tone = KIND_TONE[post.kind];
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Monogram letter={post.author.name.slice(0, 1)} color={post.author.color} size={38} radius={19} />
        <View style={styles.flex}>
          <View style={styles.nameRow}>
            <T f="sansSemi" size={14.5} numberOfLines={1} style={styles.shrink}>
              {post.author.name}
            </T>
            {post.author.verified ? <Led color={colors.orange} size={6} still /> : null}
          </View>
          <T f="mono" size={11.5} color={colors.ink3} numberOfLines={1}>
            @{post.author.handle} · {agoLabel(post.createdAt)}
          </T>
        </View>
        <Tag text={tone.label} color={tone.color} />
      </View>

      {post.body ? (
        <T size={15} lh={1.45} color={colors.ink} style={styles.body}>
          {post.body}
        </T>
      ) : null}

      {post.kind === 'prompt' ? <PromptWell post={post} /> : null}
      {post.kind !== 'prompt' && post.sides ? <Comparison post={post} sides={post.sides} /> : null}

      {post.tags.length ? (
        <View style={styles.tags}>
          {post.tags.map((t) => (
            <T key={t} f="mono" size={11.5} color={colors.ink3}>
              #{t}
            </T>
          ))}
        </View>
      ) : null}

      <ActionRail post={post} onCode={onCode} />
    </View>
  );
}

function PromptWell({ post }: { post: PulsePost }) {
  const [open, setOpen] = useState(false);
  const cost = runCostMicros(post.modelId);
  return (
    <CodeWell
      caption={post.modelId}
      meta={
        cost !== null ? (
          <T f="mono" size={11} color={colors.green}>
            ≈{usd(cost)}/run
          </T>
        ) : null
      }
      style={styles.payload}
    >
      <T f="mono" size={12.5} lh={1.55} color={colors.bodySoft} numberOfLines={open ? undefined : 6} selectable>
        <Span f="mono" color={colors.orange}>
          {'> '}
        </Span>
        {post.prompt}
      </T>
      {post.prompt.length > 220 ? (
        <Pressable accessibilityRole="button" onPress={() => setOpen((v) => !v)} hitSlop={10} style={styles.more}>
          <T f="monoMedium" size={11.5} color={colors.indigo}>
            {open ? '— collapse' : '+ show full prompt'}
          </T>
        </Pressable>
      ) : null}
    </CodeWell>
  );
}

function Comparison({ post, sides }: { post: PulsePost; sides: [PulseSide, PulseSide] }) {
  const revealed = !!post.voted;
  const share = voteShare(sides);
  const total = sides[0].votes + sides[1].votes;
  const lead = share[0] === share[1] ? -1 : share[0] > share[1] ? 0 : 1;
  const vote = (side: 'a' | 'b') => {
    if (revealed) return;
    haptics.press();
    reactToPost(post, { action: 'vote', side });
  };
  return (
    <View style={styles.payload}>
      <CodeWell caption="prompt" style={styles.promptMini}>
        <T f="mono" size={12} lh={1.5} color={colors.bodySoft} numberOfLines={3}>
          <Span f="mono" color={colors.orange}>
            {'> '}
          </Span>
          {post.prompt}
        </T>
      </CodeWell>
      <View style={styles.sides}>
        {sides.map((s, i) => (
          <SideCard
            key={s.modelId}
            side={s}
            letter={i === 0 ? 'A' : 'B'}
            kind={post.kind}
            revealed={revealed}
            chosen={post.voted === (i === 0 ? 'a' : 'b')}
            leading={lead === i}
            pct={share[i] ?? 50}
            onVote={() => vote(i === 0 ? 'a' : 'b')}
          />
        ))}
      </View>
      <View style={styles.voteFoot}>
        <Led color={revealed ? colors.green : colors.sand} size={6} still={revealed} />
        <T f="mono" size={11.5} color={colors.ink3}>
          {revealed ? `${intl(total)} votes · you picked ${post.voted?.toUpperCase()}` : 'Blind vote · results reveal after you pick'}
        </T>
      </View>
    </View>
  );
}

interface SideCardProps {
  side: PulseSide;
  letter: 'A' | 'B';
  kind: PulsePost['kind'];
  revealed: boolean;
  chosen: boolean;
  leading: boolean;
  pct: number;
  onVote: () => void;
}

function SideCard({ side, letter, kind, revealed, chosen, leading, pct, onVote }: SideCardProps) {
  const accent = leading ? colors.orange : colors.sand;
  return (
    <PressableScale
      accessibilityLabel={revealed ? `${side.modelName}: ${pct}% of votes` : `Vote ${letter}: ${side.modelName}`}
      accessibilityState={{ selected: chosen, disabled: revealed }}
      onPress={onVote}
      scaleTo={revealed ? 1 : 0.97}
      style={[styles.side, chosen && styles.sideChosen]}
    >
      {kind === 'design' ? <Artboard palette={side.palette} letter={letter} /> : null}
      <View style={styles.sideHead}>
        {kind !== 'design' ? (
          <View style={[styles.plinth, chosen && styles.plinthOn]}>
            <T f="serif" size={18} lh={1} color={chosen ? colors.onOrange : colors.ink}>
              {letter}
            </T>
          </View>
        ) : null}
        <OrgMonogram org={side.org} size={22} radius={6} />
        <T f="sansSemi" size={12.5} lh={1.25} numberOfLines={2} style={styles.flex}>
          {side.modelName}
        </T>
      </View>
      <T size={12.5} lh={1.45} color={colors.ink2} numberOfLines={kind === 'design' ? 2 : 5} style={styles.excerpt}>
        {side.excerpt}
      </T>
      <View style={styles.metrics}>
        {side.latencyMs ? (
          <T f="mono" size={11} color={side.latencyMs <= 120 ? colors.green : colors.ink3}>
            {side.latencyMs}ms
          </T>
        ) : null}
        {side.costMicros !== undefined ? (
          <T f="mono" size={11} color={colors.ink3}>
            {usd(side.costMicros)}
          </T>
        ) : null}
      </View>
      {revealed ? (
        <View style={styles.result}>
          <T f="serif" size={26} lh={1} color={leading ? colors.orange : colors.ink2}>
            {pct}
            <Span f="serif" color={colors.ink3} style={styles.pctSign}>
              %
            </Span>
          </T>
          <FlutedBar pct={pct} fill={accent} groove={leading ? colors.orangeDeep : colors.sandDeep} height={8} />
        </View>
      ) : (
        <View style={styles.voteKey}>
          <T f="monoSemi" size={11.5} ls={0.08} color={colors.ink}>
            VOTE {letter}
          </T>
        </View>
      )}
    </PressableScale>
  );
}

/** Typographic thumbnail of a generated UI, drawn from the design's palette on a dot grid. */
function Artboard({ palette, letter }: { palette?: string[]; letter: 'A' | 'B' }) {
  const [bg, accent, ink, block] = palette ?? [colors.cover, colors.orange, colors.ink, colors.pillar];
  return (
    <View style={[styles.artboard, { backgroundColor: bg }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <DotGrid spacing={9} opacity={0.12} />
      <View style={styles.abNav}>
        <View style={[styles.abLogo, { backgroundColor: accent }]} />
        <View style={[styles.abLine, { width: 22, backgroundColor: ink, opacity: 0.35 }]} />
        <View style={[styles.abLine, { width: 16, backgroundColor: ink, opacity: 0.35 }]} />
      </View>
      <View style={[styles.abHead, { width: '82%', backgroundColor: ink }]} />
      <View style={[styles.abHead, { width: '56%', backgroundColor: ink }]} />
      <View style={[styles.abLine, { width: '70%', backgroundColor: ink, opacity: 0.3, marginTop: 6 }]} />
      <View style={[styles.abCta, { backgroundColor: accent }]} />
      <View style={styles.abCards}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.abCard, { backgroundColor: block }]} />
        ))}
      </View>
      <View style={styles.abTag}>
        <T f="serif" size={15} lh={1} color={colors.ink}>
          {letter}
        </T>
      </View>
    </View>
  );
}

function ActionRail({ post, onCode }: { post: PulsePost; onCode: (post: PulsePost) => void }) {
  return (
    <View style={styles.rail}>
      <RailButton
        icon="heart"
        count={post.likes}
        active={!!post.liked}
        label={post.liked ? 'Unlike' : 'Like'}
        onPress={() => {
          haptics.tap();
          reactToPost(post, { action: post.liked ? 'unlike' : 'like' });
        }}
      />
      <RailButton
        icon="remix"
        count={post.remixes}
        label="Remix prompt"
        onPress={() => router.push({ pathname: '/compose', params: { prompt: post.prompt, model: post.modelId, t: navStamp() } })}
      />
      <RailButton
        icon="bookmark"
        active={!!post.bookmarked}
        label={post.bookmarked ? 'Remove bookmark' : 'Bookmark'}
        onPress={() => {
          haptics.tap();
          toast(toggleBookmark(post.id) ? 'Saved to bookmarks' : 'Removed from bookmarks');
        }}
      />
      <RailButton icon="share" label="Share" onPress={() => sharePost(post)} />
      <View style={styles.railRight}>
        <Pressable accessibilityRole="button" accessibilityLabel="API code" onPress={() => onCode(post)} hitSlop={6} style={styles.apiBtn}>
          <Icon name="code" size={16} color={colors.ink} />
          <T f="monoMedium" size={12} color={colors.ink}>
            API
          </T>
        </Pressable>
        <KeyButton
          label="Run"
          height={34}
          radius={11}
          fontSize={13}
          icon={<Icon name="play" size={13} color={colors.onOrange} fill={colors.onOrange} />}
          accessibilityLabel={`Run in chat on ${modelLabel(post.modelId)}`}
          onPress={() => runInChat(post.prompt, post.kind === 'prompt' ? post.modelId : post.sides?.[0]?.modelId)}
        />
      </View>
    </View>
  );
}

function RailButton({ icon, count, active, label, onPress }: { icon: IconName; count?: number; active?: boolean; label: string; onPress: () => void }) {
  const color = active ? colors.orange : colors.ink2;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} onPress={onPress} style={styles.railBtn}>
      <Icon name={icon} size={19} color={color} fill={active && icon !== 'remix' ? colors.orange : 'none'} />
      {count !== undefined ? (
        <T f="mono" size={11.5} color={color}>
          {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
        </T>
      ) : null}
    </Pressable>
  );
}

type Lang = 'curl' | 'python' | 'node';
const LANGS: { id: Lang; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'python', label: 'Python' },
  { id: 'node', label: 'Node' },
];

/** "Run via API" sheet: the post's prompt as an OpenAI-compatible request against api.vigas.ai. */
export function ApiCodeSheet({ post, onClose }: { post: PulsePost | null; onClose: () => void }) {
  const [lang, setLang] = useState<Lang>('python');
  const modelId = post ? (post.kind === 'prompt' ? post.modelId : (post.sides?.[0]?.modelId ?? post.modelId)) : 'vigas/auto';
  const code = post ? pulseApiSnippet({ prompt: post.prompt, modelId }, lang) : '';
  const cost = runCostMicros(modelId);
  return (
    <Sheet visible={!!post} onClose={onClose} title="Run via API">
      <View style={styles.sheetBody}>
        <SpecStrip
          items={[
            { label: 'Model', value: modelLabel(modelId) },
            { label: 'Per run', value: cost !== null ? `≈${usd(cost)}` : 'auto', color: colors.green },
            { label: 'Endpoint', value: '/v1' },
          ]}
        />
        <Segmented options={LANGS} value={lang} onChange={setLang} height={38} fontSize={13} />
        <CodeWell caption="POST api.vigas.ai/v1/chat/completions" meta={<Led size={6} />}>
          <T f="mono" size={11.5} lh={1.55} color={colors.bodySoft} selectable>
            {code}
          </T>
        </CodeWell>
        <Label>OpenAI-compatible · one key for every model · pay per token</Label>
        <View style={styles.sheetActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void Share.share({ message: code }).catch(() => undefined)}
            style={styles.ghost}
          >
            <Icon name="share" size={17} color={colors.ink} />
            <T f="sansMedium" size={14}>
              Share code
            </T>
          </Pressable>
          <KeyButton
            label="Get API key"
            icon={<Icon name="key" size={16} color={colors.onOrange} />}
            style={styles.flex}
            onPress={() => {
              onClose();
              router.navigate('/wallet');
            }}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  body: { marginTop: 12 },
  payload: { marginTop: 12 },
  more: { marginTop: 8, minHeight: 28, justifyContent: 'center' },
  promptMini: { marginBottom: 10 },
  sides: { flexDirection: 'row', gap: 8 },
  side: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.bg2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
    gap: 8,
  },
  sideChosen: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  sideHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  plinth: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderTopWidth: 1,
    borderTopColor: colors.line3,
  },
  plinthOn: { backgroundColor: colors.orange, borderTopColor: colors.orangeText },
  excerpt: { minHeight: 36 },
  metrics: { flexDirection: 'row', gap: 10 },
  result: { gap: 6, marginTop: 2 },
  pctSign: { fontSize: 15 },
  voteKey: {
    marginTop: 2,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line2,
    borderBottomWidth: 3,
    borderBottomColor: colors.strong,
  },
  voteFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  artboard: { aspectRatio: 0.92, borderRadius: 10, overflow: 'hidden', padding: 10, gap: 5, borderWidth: 1, borderColor: colors.line },
  abNav: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  abLogo: { width: 10, height: 10, borderRadius: 3 },
  abLine: { height: 3, borderRadius: 2 },
  abHead: { height: 8, borderRadius: 2 },
  abCta: { width: '46%', height: 14, borderRadius: 7, marginTop: 8 },
  abCards: { flexDirection: 'row', gap: 4, marginTop: 'auto' },
  abCard: { flex: 1, height: 22, borderRadius: 4 },
  abTag: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,17,15,0.75)',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  rail: { flexDirection: 'row', alignItems: 'center', marginTop: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 4 },
  railBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, minWidth: 44, paddingHorizontal: 6 },
  railRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 },
  apiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  sheetBody: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },
  sheetActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line2,
  },
});
