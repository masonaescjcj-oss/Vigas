import { AUTO_MODEL_ID, formatContext, formatPricePerMillion, type ArenaVote, type ModelListItem } from '@vigas/core';
import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { colors, GUTTER, orgMark, withAlpha } from '@/theme';

import { Icon, LogoMark } from './icons';
import { Markdown } from './markdown';
import { Monogram } from './monogram';
import { IconButton } from './pressable';
import { Sheet } from './sheet';
import { Span, T } from './text';

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Model the user asked for when the message was sent (may be `vigas/auto`). */
  requested?: string;
  /** Model that actually answered (from the stream). */
  model?: string | null;
  costUsd?: number | null;
  status: 'streaming' | 'done' | 'error' | 'stopped';
  error?: string;
}

/** "anthropic/claude-sonnet-5.5" → "claude-sonnet-5.5". */
export const modelSlug = (id: string) => (id === AUTO_MODEL_ID ? id : (id.split('/').pop() ?? id));

export function UserBubble({ text }: { text: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(220)} style={styles.user}>
      <T size={15} lh={1.5} selectable>
        {text}
      </T>
    </Animated.View>
  );
}

export function AssistantMark() {
  return (
    <View style={styles.mark}>
      <LogoMark size={15} />
    </View>
  );
}

export interface AssistantMessageProps {
  msg: ChatMsg;
  costLabel: string | null;
  onShare: () => void;
  onRegenerate: () => void;
  onArena: () => void;
  canAct: boolean;
}

export function AssistantMessage({ msg, costLabel, onShare, onRegenerate, onArena, canAct }: AssistantMessageProps) {
  const requested = msg.requested ?? AUTO_MODEL_ID;
  const routed = msg.model ? modelSlug(msg.model) : null;
  const done = msg.status === 'done' || msg.status === 'stopped';
  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <View style={styles.metaRow}>
        <AssistantMark />
        <T f="mono" size={12} color={colors.ink3} numberOfLines={1} style={styles.flex}>
          {requested === AUTO_MODEL_ID ? (
            <>
              auto → <Span color={colors.sand}>{routed ?? 'routing…'}</Span>
            </>
          ) : (
            <Span color={colors.sand}>{routed ?? modelSlug(requested)}</Span>
          )}
        </T>
      </View>
      <View style={styles.answer}>
        {msg.content ? <Markdown text={msg.content} /> : msg.status === 'streaming' ? <TypingDots /> : null}
        {msg.status === 'stopped' ? (
          <T f="mono" size={12} color={colors.ink3}>
            Stopped.
          </T>
        ) : null}
        {msg.status === 'error' ? (
          <View style={styles.errorBox}>
            <Icon name="info" size={16} color={colors.red} />
            <T size={14} color={colors.ink2} style={styles.flex}>
              {msg.error ?? 'Something went wrong.'}
            </T>
          </View>
        ) : null}
      </View>
      {done || msg.status === 'error' ? (
        <View style={styles.actions}>
          {msg.content ? <IconButton icon="share" iconSize={18} color={colors.ink3} accessibilityLabel="Share reply" onPress={onShare} /> : null}
          <IconButton
            icon="regenerate"
            iconSize={18}
            color={colors.ink3}
            accessibilityLabel={msg.status === 'error' ? 'Retry' : 'Regenerate'}
            onPress={onRegenerate}
            disabled={!canAct}
          />
          {msg.status !== 'error' ? (
            <Pressable accessibilityRole="button" onPress={onArena} disabled={!canAct} style={({ pressed }) => [styles.tc, pressed && styles.tcPressed]}>
              <T size={12} color={colors.ink2}>
                Compare in Arena
              </T>
            </Pressable>
          ) : null}
          {costLabel ? (
            <T f="mono" size={12} color={colors.ink3} style={styles.cost}>
              {costLabel}
            </T>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

function Dot({ delay }: { delay: number }) {
  const o = useSharedValue(0.25);
  useEffect(() => {
    o.set(
      withDelay(
        delay,
        withRepeat(withSequence(withTiming(1, { duration: 380 }), withTiming(0.25, { duration: 380 })), -1, false),
      ),
    );
  }, [delay, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View style={[styles.dot, style]} />;
}

export function TypingDots() {
  return (
    <View style={styles.dots} accessibilityLabel="Vigas is typing">
      <Dot delay={0} />
      <Dot delay={140} />
      <Dot delay={280} />
    </View>
  );
}

export interface ArenaSideView {
  label: 'A' | 'B';
  content: string | null;
  modelName?: string;
  modelId?: string;
  winner: boolean;
}

export function ArenaCard({ side, index }: { side: ArenaSideView; index: number }) {
  const revealed = !!side.modelName;
  const org = side.modelId?.split('/')[0]?.toUpperCase();
  return (
    <Animated.View
      entering={FadeInDown.duration(320).delay(index * 90)}
      style={[styles.arenaCard, side.winner && styles.arenaWinner]}
      accessibilityLabel={revealed ? `Model ${side.label} was ${side.modelName}` : `Model ${side.label}`}
    >
      <View style={styles.arenaHead}>
        <T f="serif" size={22} lh={1.1} style={styles.flex} numberOfLines={1}>
          {revealed ? side.modelName : `Model ${side.label}`}
        </T>
        <T f="mono" size={12} color={side.winner ? colors.orangeText : colors.ink3}>
          {revealed ? (org ?? 'REVEALED') : 'HIDDEN'}
        </T>
      </View>
      {side.content === null ? (
        <View style={styles.arenaLoading}>
          <TypingDots />
        </View>
      ) : (
        <Markdown text={side.content} color={colors.bodySoft} />
      )}
    </Animated.View>
  );
}

export function VoteBar({ onVote, busy, chosen }: { onVote: (v: ArenaVote) => void; busy: boolean; chosen: ArenaVote | null }) {
  const opts: { v: ArenaVote; label: string; narrow?: boolean }[] = [
    { v: 'a', label: 'A is better' },
    { v: 'tie', label: 'Tie', narrow: true },
    { v: 'b', label: 'B is better' },
  ];
  return (
    <Animated.View entering={FadeInDown.duration(220)} accessibilityRole="radiogroup" accessibilityLabel="Vote" style={styles.voteBar}>
      {opts.map((o) => {
        const on = chosen === o.v;
        return (
          <Pressable
            key={o.v}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, selected: on }}
            disabled={busy}
            onPress={() => onVote(o.v)}
            style={({ pressed }) => [styles.vote, o.narrow && styles.voteNarrow, (pressed || on) && styles.votePressed]}
          >
            {busy && on ? (
              <ActivityIndicator color={colors.orangeText} size="small" />
            ) : (
              <T f="sansMedium" size={14} color={on ? colors.orangeText : colors.ink}>
                {o.label}
              </T>
            )}
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

export interface ModelPickerProps {
  visible: boolean;
  onClose: () => void;
  models: ModelListItem[];
  value: string;
  onPick: (id: string) => void;
}

export function ModelPicker({ visible, onClose, models, value, onPick }: ModelPickerProps) {
  const data: (ModelListItem | null)[] = [null, ...models];
  return (
    <Sheet visible={visible} onClose={onClose} title="Choose a model" maxHeight="80%">
      <FlatList
        data={data}
        keyExtractor={(m) => m?.id ?? AUTO_MODEL_ID}
        contentContainerStyle={styles.pickerList}
        renderItem={({ item }) => {
          const id = item?.id ?? AUTO_MODEL_ID;
          const selected = id === value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              android_ripple={{ color: 'rgba(239,234,225,0.08)' }}
              onPress={() => {
                haptics.select();
                onPick(id);
              }}
              style={styles.pickRow}
            >
              {item ? (
                <Monogram letter={orgMark(item.org).letter} color={orgMark(item.org).color} size={38} radius={11} />
              ) : (
                <View style={styles.autoTile}>
                  <LogoMark size={18} />
                </View>
              )}
              <View style={styles.flex}>
                <T f="sansMedium">{item ? item.name : 'Auto'}</T>
                <T f="mono" size={12} color={colors.ink3} numberOfLines={1}>
                  {item
                    ? `${formatPricePerMillion(item.inputPerMillionMicros)} / ${formatPricePerMillion(item.outputPerMillionMicros)} per 1M · ${formatContext(item.contextLength)}`
                    : 'vigas/auto · best price-quality for each message'}
                </T>
              </View>
              {selected ? <Icon name="check" size={20} color={colors.orange} /> : null}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

export function ArenaIntro() {
  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.intro}>
      <View style={styles.introIcon}>
        <Icon name="arena" size={22} color={colors.onOrange} />
      </View>
      <T f="serif" size={34} lh={1.08}>
        Two hidden models.{'\n'}
        <Span f="serifItalic" color={colors.sand}>
          You pick the better one.
        </Span>
      </T>
      <T size={15} color={colors.ink2}>
        Ask anything. Both answers arrive side by side with names hidden; your vote reveals them and feeds the public
        leaderboard. Arena battles are free.
      </T>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  user: {
    alignSelf: 'flex-end',
    maxWidth: '84%',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 20,
    paddingVertical: 11,
    paddingHorizontal: 15,
  },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  answer: { marginTop: 10, gap: 10 },
  errorBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: withAlpha(colors.red, 0.08),
    borderWidth: 1,
    borderColor: withAlpha(colors.red, 0.3),
  },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginLeft: -10 },
  tc: {
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(239,234,225,0.12)',
    justifyContent: 'center',
    marginLeft: 4,
  },
  tcPressed: { backgroundColor: colors.raised },
  cost: { marginLeft: 'auto' },
  dots: { flexDirection: 'row', gap: 5, paddingVertical: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ink2 },
  arenaCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(239,234,225,0.1)',
    borderRadius: 20,
    padding: 16,
  },
  arenaWinner: { borderColor: colors.orange },
  arenaHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  arenaLoading: { minHeight: 60, justifyContent: 'center' },
  voteBar: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  vote: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteNarrow: { flexGrow: 0, flexBasis: 72 },
  votePressed: { borderColor: colors.orange },
  pickerList: { paddingBottom: 8 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: GUTTER, minHeight: 60 },
  autoTile: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.orangeSoft,
  },
  intro: { gap: 14, paddingTop: 8 },
  introIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
