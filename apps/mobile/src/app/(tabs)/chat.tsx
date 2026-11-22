import { AUTO_MODEL_ID } from '@vigas/core';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyButton } from '@/components/buttons';
import {
  AssistantMessage,
  ModelPicker,
  UserBubble,
  modelSlug,
  type ChatMsg,
} from '@/components/chat';
import { Icon, LogoMark, StopGlyph } from '@/components/icons';
import { WalletPill } from '@/components/menu-drawer';
import { IconButton, PressableScale } from '@/components/pressable';
import { Span, T } from '@/components/text';
import { api, errorMessage, isUnauthorized, studioChatUrl } from '@/lib/api';
import { fallbackModels } from '@/lib/fallback';
import { intl, usdFromDollars } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { consumePendingChat, setPendingChat } from '@/lib/pending-chat';
import { useRemote } from '@/lib/remote';
import { useSession } from '@/lib/session';
import { useKeyboardVisible } from '@/lib/use-keyboard';
import { colors } from '@/theme';

const SUGGESTIONS = [
  'Which model should I use to summarize 10,000 contracts — and what will it cost?',
  'Write an OpenAI SDK client pointing at https://api.vigas.ai/v1.',
  'Draft a launch tweet for a developer API product.',
];

/** Abort streams that produce nothing for this long. */
const FIRST_BYTE_MS = 30_000;

let seq = 0;
const uid = () => `${Date.now().toString(36)}-${(++seq).toString(36)}`;

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  const { token, expire } = useSession();
  const params = useLocalSearchParams<{ prompt?: string; model?: string; t?: string }>();

  const [model, setModel] = useState<string>(params.model || AUTO_MODEL_ID);
  const [draft, setDraft] = useState(params.prompt ?? '');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState({ tokens: 0, cost: 0 });
  const [picker, setPicker] = useState(false);

  // Links from Home, Ranks and Hub (prompt / model) apply each time they're followed.
  const [lastNav, setLastNav] = useState(params.t);
  if (params.t !== lastNav) {
    setLastNav(params.t);
    if (params.model) setModel(params.model);
    if (params.prompt) setDraft(params.prompt);
  }

  const inputRef = useRef<TextInputInstance>(null);
  const listRef = useRef<FlatList<ChatMsg>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const atBottom = useRef(true);

  useEffect(() => {
    if (!params.t) return;
    const id = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(id);
  }, [params.t]);

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

  const updateMsg = (id: string, patch: Partial<ChatMsg> | ((m: ChatMsg) => Partial<ChatMsg>)) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m)));

  const stream = async (assistantId: string, history: ChatMsg[], targetModel = model) => {
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
        { model: targetModel, messages: history.map((m) => ({ role: m.role, content: m.content })) },
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

  const sendChat = (text: string, overrideModel?: string) => {
    const targetModel = overrideModel ?? model;
    const user: ChatMsg = { id: uid(), role: 'user', content: text, status: 'done' };
    const assistant: ChatMsg = { id: uid(), role: 'assistant', content: '', status: 'streaming', requested: targetModel };
    const history = [...messages.filter((m) => m.role === 'user' || (m.status === 'done' && m.content)), user];
    atBottom.current = true;
    setMessages((prev) => [...prev, user, assistant]);
    void stream(assistant.id, history, targetModel);
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
    const fresh: ChatMsg = { id: uid(), role: 'assistant', content: '', status: 'streaming', requested: model };
    haptics.tap();
    setMessages((prev) => [...prev.slice(0, idx), fresh]);
    void stream(fresh.id, history, model);
  };

  // Automatically answer the saved guest prompt right after Sign up / Sign in completes.
  useEffect(() => {
    if (!token) return;
    const pending = consumePendingChat();
    if (!pending) return;
    const id = setTimeout(() => {
      if (pending.model) setModel(pending.model);
      setDraft('');
      sendChat(pending.prompt, pending.model);
    }, 60);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const send = () => {
    const text = draft.trim();
    if (!text || streaming) return;
    if (!token) {
      haptics.tap();
      setPendingChat({ prompt: text, model });
      router.push({ pathname: '/sign-in', params: { mode: 'signup' } });
      return;
    }
    haptics.tap();
    setDraft('');
    sendChat(text);
  };

  const stop = () => {
    haptics.tap();
    abortRef.current?.abort();
  };

  const newConversation = () => {
    if (streaming) abortRef.current?.abort();
    haptics.select();
    setMessages([]);
    setUsage({ tokens: 0, cost: 0 });
  };

  const modelLabel = modelSlug(model);
  const meta =
    usage.tokens > 0
      ? `${intl(usage.tokens)} tokens · ${usdFromDollars(usage.cost)}`
      : modelInfo
        ? `${modelInfo.name} · pay per token`
        : 'Auto-routed · pay per token';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton icon="back" accessibilityLabel="Back" onPress={goBack} />
        <View style={styles.flex}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Model ${modelLabel}. Change model`}
            onPress={() => setPicker(true)}
            hitSlop={8}
            style={styles.modelBtn}
          >
            <View style={styles.liveDot} />
            <T f="monoMedium" size={14} numberOfLines={1} style={styles.shrink}>
              {modelLabel}
            </T>
            <Icon name="chevronDown" size={15} />
          </Pressable>
          <T f="mono" size={12} color={colors.ink3} numberOfLines={1}>
            {meta}
          </T>
        </View>
        <WalletPill />
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          style={styles.flex}
          contentContainerStyle={[styles.thread, messages.length === 0 && styles.grow]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onLayout={() => {
            if (atBottom.current) listRef.current?.scrollToEnd({ animated: false });
          }}
          onScroll={(e) => {
            const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
            atBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
          }}
          scrollEventThrottle={64}
          onContentSizeChange={() => {
            if (atBottom.current) listRef.current?.scrollToEnd({ animated: !streaming });
          }}
          ListEmptyComponent={
            <ChatEmpty
              onPick={(s) => setDraft(s)}
              onOpenStudio={() =>
                void WebBrowser.openBrowserAsync(studioChatUrl(model), {
                  toolbarColor: colors.bg,
                  controlsColor: colors.orange,
                })
              }
            />
          }
          renderItem={({ item }) =>
            item.role === 'user' ? (
              <UserBubble text={item.content} />
            ) : (
              <AssistantMessage
                msg={item}
                canAct={!streaming}
                costLabel={item.costUsd !== null && item.costUsd !== undefined ? usdFromDollars(item.costUsd) : null}
                onShare={() => void Share.share({ message: item.content }).catch(() => undefined)}
                onRegenerate={() => regenerate(item.id)}
                onSwitchModel={() => setPicker(true)}
              />
            )
          }
        />

        <View style={[styles.composerWrap, { paddingBottom: keyboard ? 8 : insets.bottom + 10 }]}>
          <View style={styles.composer}>
            <IconButton icon="plus" accessibilityLabel="New chat" color={colors.ink2} onPress={newConversation} />
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder="Message Vigas…"
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
                accessibilityLabel="Send"
                icon={<Icon name="arrowUp" size={20} color={colors.onOrange} />}
                disabled={!draft.trim() || streaming}
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

function ChatEmpty({ onPick, onOpenStudio }: { onPick: (s: string) => void; onOpenStudio: () => void }) {
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
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel="Open RetroCode web Studio on vigas.app/chat"
        onPress={onOpenStudio}
        style={styles.studioPill}
        haptic="tap"
      >
        <Icon name="spark" size={14} color={colors.indigo} />
        <T f="mono" size={12} color={colors.indigo} style={styles.flex}>
          Open full web Studio · vigas.app/chat ↗
        </T>
      </PressableScale>
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
    gap: 6,
    paddingVertical: 10,
    paddingLeft: 8,
    paddingRight: 16,
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
  studioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(139,144,240,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139,144,240,0.28)',
  },
});
