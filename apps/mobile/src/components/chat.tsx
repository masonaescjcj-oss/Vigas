import { AUTO_MODEL_ID, formatContext, formatPricePerMillion, type ModelListItem } from '@vigas/core';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
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
  onSwitchModel: () => void;
  canAct: boolean;
}

export function AssistantMessage({ msg, costLabel, onShare, onRegenerate, onSwitchModel, canAct }: AssistantMessageProps) {
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
            <Pressable accessibilityRole="button" onPress={onSwitchModel} disabled={!canAct} style={({ pressed }) => [styles.tc, pressed && styles.tcPressed]}>
              <T size={12} color={colors.ink2}>
                Switch model
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
});
