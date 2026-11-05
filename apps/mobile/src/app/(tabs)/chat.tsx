import { AUTO_MODEL_ID, type ArenaBattleResponse, type ArenaVote, type ArenaVoteResponse } from '@vigas/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyButton } from '@/components/buttons';
import {
  ArenaCard,
  ArenaIntro,
  AssistantMessage,
  ModelPicker,
  UserBubble,
  VoteBar,
  modelSlug,
  type ArenaSideView,
  type ChatMsg,
} from '@/components/chat';
import { Icon, LogoMark, StopGlyph } from '@/components/icons';
import { IconButton, PressableScale } from '@/components/pressable';
import { Segmented } from '@/components/segmented';
import { Label, Span, T } from '@/components/text';
import { ApiError, api, errorMessage, isUnauthorized, withTimeout } from '@/lib/api';
import { fallbackModels } from '@/lib/fallback';
import { intl, usdFromDollars } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useRemote } from '@/lib/remote';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';
import { useKeyboardVisible } from '@/lib/use-keyboard';
import { colors } from '@/theme';

type Mode = 'chat' | 'arena';

type ArenaState =
  | { phase: 'idle' }
  | { phase: 'loading'; prompt: string }
  | { phase: 'error'; prompt: string; message: string }
  | { phase: 'ready'; prompt: string; battle: ArenaBattleResponse; voting: ArenaVote | null }
  | { phase: 'revealed'; prompt: string; battle: ArenaBattleResponse; result: ArenaVoteResponse };

const MODES = [
  { id: 'chat', label: 'Chat' },
  { id: 'arena', label: 'Arena' },
] as const;

const SUGGESTIONS = [
  'Which model should I use to summarize 10,000 contracts — and what will it cost?',
  'Explain the Vigas leaderboard in two sentences.',
  'Draft a launch tweet for a note-taking app.',
];
const ARENA_SUGGESTIONS = ['Summarize an NDA in five bullets for a founder.', 'Write a haiku about latency.', 'Explain RAG to a 12-year-old.'];

/** Abort streams that produce nothing for this long. */
const FIRST_BYTE_MS = 30_000;

let seq = 0;
const uid = () => `${Date.now().toString(36)}-${(++seq).toString(36)}`;

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  const { token, expire } = useSession();
  const params = useLocalSearchParams<{ prompt?: string; mode?: string; model?: string; t?: string }>();

  const [mode, setMode] = useState<Mode>(params.mode === 'arena' ? 'arena' : 'chat');
  const [model, setModel] = useState<string>(params.model || AUTO_MODEL_ID);
  const [draft, setDraft] = useState(params.prompt ?? '');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState({ tokens: 0, cost: 0 });
  const [arena, setArena] = useState<ArenaState>({ phase: 'idle' });
  const [picker, setPicker] = useState(false);

  // Links from Home, Ranks and articles (prompt / model / mode) apply each time they're followed.
  const [lastNav, setLastNav] = useState(params.t);
  if (params.t !== lastNav) {
    setLastNav(params.t);
    if (params.mode === 'arena' || params.mode === 'chat') setMode(params.mode);
    if (params.model) setModel(params.model);
    if (params.prompt) setDraft(params.prompt);
  }

  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<ChatMsg>>(null);
  const arenaRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const atBottom = useRef(true);

  useEffect(() => {
    if (!params.t || params.mode === 'arena') return;
    const id = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(id);
  }, [params.t, params.mode]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const models = useRemote('models', () => api.models(), { fallback: fallbackModels });
  const modelInfo = models.data?.items.find((m) => m.id === model);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  };

  const handleAuthError = (e: unknown) => {
    if (isUnauthorized(e)) {
      expire();
      router.push('/sign-in');
    }
  };

  // ── Chat ────────────────────────────────────────────────────────────────

  const updateMsg = (id: string, patch: Partial<ChatMsg> | ((m: ChatMsg) => Partial<ChatMsg>)) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m)));

  const stream = async (assistantId: string, history: ChatMsg[]) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreaming(true);
    let buffer = '';
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let gotFirst = false;
    let timedOut = false;
    let modelSeen = false;
    const firstByte = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, FIRST_BYTE_MS);

    const flush = () => {
      flushTimer = null;
      const chunk = buffer;
      buffer = '';
      if (chunk) updateMsg(assistantId, (m) => ({ content: m.content + chunk }));
    };

    try {
      const res = await api.chat(
        { model, messages: history.map((m) => ({ role: m.role, content: m.content })) },
        {
          signal: ctrl.signal,
          onDelta: (d) => {
            if (!gotFirst) {
              gotFirst = true;
              clearTimeout(firstByte);
            }
            buffer += d;
            flushTimer ??= setTimeout(flush, 40);
          },
          onChunk: (c) => {
            if (!modelSeen && c.model) {
              modelSeen = true;
              updateMsg(assistantId, { model: c.model });
            }
          },
        },
      );
      if (flushTimer) clearTimeout(flushTimer);
      flush();
      updateMsg(assistantId, (m) => ({
        content: res.content || m.content,
        model: res.model ?? m.model,
        costUsd: res.costUsd,
        status: 'done',
      }));
      setUsage((u) => ({ tokens: u.tokens + res.promptTokens + res.completionTokens, cost: u.cost + (res.costUsd ?? 0) }));
    } catch (e) {
      if (flushTimer) clearTimeout(flushTimer);
      flush();
      if (ctrl.signal.aborted && !timedOut) {
        updateMsg(assistantId, { status: 'stopped' });
      } else {
        haptics.error();
        updateMsg(assistantId, {
          status: 'error',
          error: timedOut ? 'No response from the model. Try again.' : errorMessage(e),
        });
        handleAuthError(e);
      }
    } finally {
      clearTimeout(firstByte);
      abortRef.current = null;
      setStreaming(false);
    }
  };

  const sendChat = (text: string) => {
    const user: ChatMsg = { id: uid(), role: 'user', content: text, status: 'done' };
    const assistant: ChatMsg = { id: uid(), role: 'assistant', content: '', status: 'streaming' };
    const history = [...messages.filter((m) => m.role === 'user' || (m.status === 'done' && m.content)), user];
    atBottom.current = true;
    setMessages((prev) => [...prev, user, assistant]);
    void stream(assistant.id, history);
  };

  const regenerate = (assistantId: string) => {
    if (streaming) return;
    if (!token) {
      router.push('/sign-in');
      return;
    }
    const idx = messages.findIndex((m) => m.id === assistantId);
    if (idx < 1) return;
    const history = messages.slice(0, idx).filter((m) => m.role === 'user' || (m.status === 'done' && m.content));
    const fresh: ChatMsg = { id: uid(), role: 'assistant', content: '', status: 'streaming' };
    haptics.tap();
    setMessages((prev) => [...prev.slice(0, idx), fresh]);
    void stream(fresh.id, history);
  };

  // ── Arena ───────────────────────────────────────────────────────────────

  const startBattle = async (prompt: string) => {
    setArena({ phase: 'loading', prompt });
    try {
      const battle = await withTimeout(api.arenaBattle(prompt), 120_000);
      setArena({ phase: 'ready', prompt, battle, voting: null });
      haptics.tap();
    } catch (e) {
      haptics.error();
      setArena({ phase: 'error', prompt, message: errorMessage(e) });
      handleAuthError(e);
    }
  };

  const castVote = async (vote: ArenaVote) => {
    if (arena.phase !== 'ready' || arena.voting) return;
    const { prompt, battle } = arena;
    haptics.press();
    setArena({ phase: 'ready', prompt, battle, voting: vote });
    try {
      const result = await withTimeout(api.arenaVote(battle.battleId, vote));
      setArena({ phase: 'revealed', prompt, battle, result });
      haptics.success();
    } catch (e) {
      setArena({ phase: 'ready', prompt, battle, voting: null });
      haptics.error();
      toast(e instanceof ApiError && e.status === 409 ? 'This battle already has a vote.' : errorMessage(e), 'error');
      handleAuthError(e);
    }
  };

  const toArena = (prompt: string) => {
    setMode('arena');
    if (!token) {
      setDraft(prompt);
      router.push('/sign-in');
      return;
    }
    void startBattle(prompt);
  };

  // ── Composer ────────────────────────────────────────────────────────────

  const send = () => {
    const text = draft.trim();
    if (!text || streaming || arena.phase === 'loading') return;
    if (!token) {
      router.push('/sign-in');
      return;
    }
    haptics.tap();
    setDraft('');
    if (mode === 'arena') void startBattle(text);
    else sendChat(text);
  };

  const stop = () => {
    haptics.tap();
    abortRef.current?.abort();
  };

  const newConversation = () => {
    if (streaming) abortRef.current?.abort();
    haptics.select();
    if (mode === 'arena') setArena({ phase: 'idle' });
    else {
      setMessages([]);
      setUsage({ tokens: 0, cost: 0 });
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  const isArena = mode === 'arena';
  const modelLabel = isArena ? 'Arena · 2 hidden' : modelSlug(model);
  const meta = isArena
    ? 'Free · your vote shapes the Ranks'
    : usage.tokens > 0
      ? `${intl(usage.tokens)} tokens · ${usdFromDollars(usage.cost)}`
      : modelInfo
        ? `${modelInfo.name} · pay per token`
        : 'Best model per message · pay per token';
  const showVote = isArena && arena.phase === 'ready';
  const busy = streaming || arena.phase === 'loading';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton icon="back" accessibilityLabel="Back" onPress={goBack} />
        <View style={styles.flex}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isArena ? 'Arena mode: two hidden models' : `Model ${modelLabel}. Change model`}
            disabled={isArena}
            onPress={() => setPicker(true)}
            hitSlop={8}
            style={styles.modelBtn}
          >
            <View style={[styles.liveDot, isArena && { backgroundColor: colors.orange }]} />
            <T f="monoMedium" size={14} numberOfLines={1} style={styles.shrink}>
              {modelLabel}
            </T>
            {!isArena ? <Icon name="chevronDown" size={15} /> : null}
          </Pressable>
          <T f="mono" size={12} color={colors.ink3} numberOfLines={1}>
            {meta}
          </T>
        </View>
        <Segmented options={MODES} value={mode} onChange={(m) => setMode(m)} tone="dark" stretch={false} height={36} fontSize={13} accessibilityLabel="Mode" />
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        {isArena ? (
          <ScrollView
            ref={arenaRef}
            style={styles.flex}
            contentContainerStyle={styles.thread}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => arenaRef.current?.scrollToEnd({ animated: true })}
          >
            <Label color={colors.orangeText}>Arena · blind test</Label>
            {arena.phase === 'idle' ? (
              <>
                <ArenaIntro />
                <View style={styles.suggestions}>
                  {ARENA_SUGGESTIONS.map((s) => (
                    <Suggestion key={s} text={s} onPress={() => setDraft(s)} />
                  ))}
                </View>
              </>
            ) : (
              <>
                <UserBubble text={arena.prompt} />
                {arena.phase === 'error' ? (
                  <View style={styles.arenaError}>
                    <T size={14} color={colors.ink2}>
                      {arena.message}
                    </T>
                    <Pressable accessibilityRole="button" onPress={() => void startBattle(arena.prompt)} style={styles.retry} hitSlop={8}>
                      <Icon name="regenerate" size={16} color={colors.indigo} />
                      <T f="sansMedium" size={14} color={colors.indigo}>
                        Try again
                      </T>
                    </Pressable>
                  </View>
                ) : (
                  arenaSides(arena).map((side, i) => <ArenaCard key={side.label} side={side} index={i} />)
                )}
                {arena.phase === 'revealed' ? (
                  <Animated.View entering={FadeInDown.duration(260)} style={styles.voted}>
                    <Icon name="check" size={18} color={colors.green} />
                    <T size={14} style={styles.flex}>
                      Vote counted. It’s now part of the leaderboard.
                    </T>
                    <Pressable accessibilityRole="link" onPress={() => router.navigate('/ranks')} hitSlop={10}>
                      <T f="sansMedium" size={14} color={colors.indigo}>
                        Ranks
                      </T>
                    </Pressable>
                  </Animated.View>
                ) : null}
              </>
            )}
          </ScrollView>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            style={styles.flex}
            contentContainerStyle={[styles.thread, messages.length === 0 && styles.grow]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScroll={(e) => {
              const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
              atBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
            }}
            scrollEventThrottle={64}
            onContentSizeChange={() => {
              if (atBottom.current) listRef.current?.scrollToEnd({ animated: !streaming });
            }}
            ListEmptyComponent={<ChatEmpty onPick={(s) => setDraft(s)} />}
            renderItem={({ item, index }) =>
              item.role === 'user' ? (
                <UserBubble text={item.content} />
              ) : (
                <AssistantMessage
                  msg={item}
                  requested={model}
                  canAct={!streaming}
                  costLabel={item.costUsd !== null && item.costUsd !== undefined ? usdFromDollars(item.costUsd) : null}
                  onShare={() => void Share.share({ message: item.content }).catch(() => undefined)}
                  onRegenerate={() => regenerate(item.id)}
                  onArena={() => {
                    const prompt = [...messages.slice(0, index)].reverse().find((m) => m.role === 'user')?.content;
                    if (prompt) toArena(prompt);
                  }}
                />
              )
            }
          />
        )}

        <View style={[styles.composerWrap, { paddingBottom: keyboard ? 8 : insets.bottom + 10 }]}>
          {showVote ? <VoteBar onVote={(v) => void castVote(v)} busy={!!arena.voting} chosen={arena.voting} /> : null}
          {!token ? (
            <Animated.View entering={FadeIn} style={styles.signedOutHint}>
              <Icon name="lock" size={14} color={colors.ink3} />
              <T f="mono" size={12} color={colors.ink3} style={styles.flex}>
                {isArena ? 'Sign in to start a battle' : 'Sign in to chat · billed to your credits'}
              </T>
              <Pressable accessibilityRole="link" onPress={() => router.push('/sign-in')} hitSlop={10}>
                <T f="sansMedium" size={13} color={colors.indigo}>
                  Sign in
                </T>
              </Pressable>
            </Animated.View>
          ) : null}
          <View style={styles.composer}>
            <IconButton
              icon="plus"
              accessibilityLabel={isArena ? 'New battle' : 'New chat'}
              color={colors.ink2}
              onPress={newConversation}
            />
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder={isArena ? (arena.phase === 'revealed' ? 'Ask a new question…' : 'Ask both models…') : 'Message Vigas…'}
              placeholderTextColor={colors.ink3}
              accessibilityLabel="Message"
              multiline
              maxLength={8000}
              selectionColor={colors.orange}
              cursorColor={colors.orange}
              style={styles.input}
            />
            {streaming ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Stop generating" onPress={stop} style={styles.stop}>
                <StopGlyph color={colors.ink} />
              </Pressable>
            ) : (
              <KeyButton
                round
                height={44}
                accessibilityLabel={isArena ? 'Start battle' : 'Send'}
                icon={<Icon name="arrowUp" size={20} color={colors.onOrange} />}
                disabled={!draft.trim() || busy}
                loading={arena.phase === 'loading'}
                onPress={send}
                haptic={false}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <ModelPicker
        visible={picker}
        onClose={() => setPicker(false)}
        models={models.data?.items ?? []}
        value={model}
        onPick={(id) => {
          setModel(id);
          setPicker(false);
        }}
      />
    </View>
  );
}

function arenaSides(arena: ArenaState): ArenaSideView[] {
  if (arena.phase === 'loading') {
    return [
      { label: 'A', content: null, winner: false },
      { label: 'B', content: null, winner: false },
    ];
  }
  if (arena.phase === 'ready') {
    return arena.battle.sides.map((s) => ({ label: s.label, content: s.content, winner: false }));
  }
  if (arena.phase === 'revealed') {
    const v = arena.result.vote;
    return arena.result.sides.map((s) => ({
      label: s.label,
      content: s.content,
      modelName: s.modelName,
      modelId: s.modelId,
      winner: (v === 'a' && s.label === 'A') || (v === 'b' && s.label === 'B'),
    }));
  }
  return [];
}

function Suggestion({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityLabel={`Use prompt: ${text}`} onPress={onPress} style={styles.suggestion} haptic="select">
      <Icon name="spark" size={16} color={colors.orange} />
      <T size={14} color={colors.ink2} style={styles.flex}>
        {text}
      </T>
    </PressableScale>
  );
}

function ChatEmpty({ onPick }: { onPick: (s: string) => void }) {
  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.empty}>
      <View style={styles.emptyMark}>
        <LogoMark size={26} />
      </View>
      <T f="serif" size={36} lh={1.08}>
        Ask{' '}
        <Span f="serifItalic" color={colors.sand}>
          anything.
        </Span>
      </T>
      <T size={15} color={colors.ink2}>
        Vigas routes each message to the best model for the job — or pick one yourself. You only pay for the tokens you use.
      </T>
      <View style={styles.suggestions}>
        {SUGGESTIONS.map((s) => (
          <Suggestion key={s} text={s} onPress={() => onPick(s)} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  grow: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  modelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  thread: { paddingTop: 18, paddingHorizontal: 16, paddingBottom: 12, gap: 20 },
  composerWrap: {
    paddingTop: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,234,225,0.06)',
    backgroundColor: colors.bg,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: 28,
    padding: 5,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    maxHeight: 140,
    color: colors.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    paddingTop: 11,
    paddingBottom: 11,
    textAlignVertical: 'center',
  },
  stop: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.strong,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  signedOutHint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingBottom: 8 },
  empty: { flex: 1, justifyContent: 'flex-end', gap: 14, paddingBottom: 8 },
  emptyMark: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestions: { gap: 8, marginTop: 6 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  arenaError: {
    gap: 10,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36 },
  voted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(111,207,115,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(111,207,115,0.3)',
  },
});
