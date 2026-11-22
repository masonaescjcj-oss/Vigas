import { pulseDraftSchema, type PulsePostKind } from '@vigas/core';
import { seedModels } from '@vigas/core/seed';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CodeWell, FlutedRule, Tag } from '@/components/boxes';
import { KeyButton } from '@/components/buttons';
import { Icon } from '@/components/icons';
import { OrgMonogram } from '@/components/monogram';
import { IconButton, PressableScale } from '@/components/pressable';
import { Segmented } from '@/components/segmented';
import { Sheet } from '@/components/sheet';
import { Heading, Label, Span, T } from '@/components/text';
import { haptics } from '@/lib/haptics';
import { modelLabel, publishPost } from '@/lib/pulse';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';
import { colors, GUTTER, radius } from '@/theme';

const KINDS: { id: PulsePostKind; label: string }[] = [
  { id: 'prompt', label: 'Prompt' },
  { id: 'battle', label: 'A/B Battle' },
  { id: 'design', label: 'UI Design' },
];

const PICKABLE = seedModels.slice(0, 14);

export default function ComposeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind?: string; prompt?: string; model?: string }>();
  const { user } = useSession();

  const initialKind: PulsePostKind = params.kind === 'battle' || params.kind === 'design' ? params.kind : 'prompt';
  const [kind, setKind] = useState<PulsePostKind>(initialKind);
  const [body, setBody] = useState('');
  const [prompt, setPrompt] = useState(params.prompt ?? '');
  const [modelId, setModelId] = useState(params.model || 'anthropic/claude-fable-5.2');
  const [modelA, setModelA] = useState('anthropic/claude-fable-5.2');
  const [modelB, setModelB] = useState('deepseek/v4.1-flash');
  const [excerptA, setExcerptA] = useState('');
  const [excerptB, setExcerptB] = useState('');
  const [tagsRaw, setTagsRaw] = useState(initialKind === 'design' ? 'design, ui' : 'coding');
  const [picking, setPicking] = useState<'single' | 'a' | 'b' | null>(null);
  const [busy, setBusy] = useState(false);

  const pickModel = (id: string) => {
    haptics.select();
    if (picking === 'single') setModelId(id);
    else if (picking === 'a') setModelA(id);
    else if (picking === 'b') setModelB(id);
    setPicking(null);
  };

  const submit = async () => {
    const tags = tagsRaw
      .split(/[,\s#]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 4);
    const draft =
      kind === 'prompt'
        ? { kind, body, prompt, modelId, tags }
        : {
            kind,
            body,
            prompt,
            modelId: modelA,
            tags,
            sides: [
              { modelId: modelA, excerpt: excerptA.trim() || `Generated with ${modelLabel(modelA)}` },
              { modelId: modelB, excerpt: excerptB.trim() || `Generated with ${modelLabel(modelB)}` },
            ],
          };

    const parsed = pulseDraftSchema.safeParse(draft);
    if (!parsed.success) {
      haptics.error();
      toast(parsed.error.issues[0]?.message ?? 'Check your post fields.', 'error');
      return;
    }

    setBusy(true);
    try {
      const handle = user?.email ? user.email.split('@')[0]!.replace(/[^a-z0-9._]/gi, '').slice(0, 18) : 'builder';
      const where = await publishPost(draft, {
        id: user?.id ?? 'local_user',
        name: user?.name || handle || 'Vigas builder',
        handle: handle || 'builder',
      });
      haptics.success();
      toast(where === 'server' ? 'Published to Pulse' : 'Posted to your Pulse feed', 'success');
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <IconButton icon="close" accessibilityLabel="Close composer" onPress={() => router.back()} color={colors.ink2} />
        <Heading size={24} style={styles.flex}>
          New Pulse
        </Heading>
        <KeyButton label="Publish" height={38} radius={11} fontSize={14} loading={busy} onPress={() => void submit()} />
      </View>

      <FlutedRule style={styles.rule} />

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 20) + 18 }]} keyboardShouldPersistTaps="handled">
        <Segmented options={KINDS} value={kind} onChange={setKind} height={42} fontSize={14} />

        <View style={styles.field}>
          <Label>Takeaway / Caption</Label>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="What surprised you about quality, speed or cost?"
            placeholderTextColor={colors.ink3}
            multiline
            maxLength={280}
            selectionColor={colors.orange}
            cursorColor={colors.orange}
            style={styles.captionInput}
          />
        </View>

        <View style={styles.field}>
          <Label>Prompt (runs in Chat & API snippet)</Label>
          <CodeWell caption="prompt.txt" meta={<Tag text="REQUIRED" color={colors.orange} />}>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Paste the exact prompt other builders can run or remix…"
              placeholderTextColor={colors.ink3}
              multiline
              maxLength={4000}
              selectionColor={colors.orange}
              cursorColor={colors.orange}
              style={styles.promptInput}
            />
          </CodeWell>
        </View>

        {kind === 'prompt' ? (
          <View style={styles.field}>
            <Label>Best model for this prompt</Label>
            <ModelRowButton label="Model" modelId={modelId} onPress={() => setPicking('single')} />
          </View>
        ) : (
          <View style={styles.field}>
            <Label>{kind === 'battle' ? 'Models to compare (blind A vs B)' : 'Design contenders (A vs B)'}</Label>
            <View style={styles.sides}>
              <View style={styles.sideBox}>
                <ModelRowButton label="Side A" modelId={modelA} onPress={() => setPicking('a')} />
                <TextInput
                  value={excerptA}
                  onChangeText={setExcerptA}
                  placeholder={kind === 'design' ? 'Describe A’s layout, palette & feel…' : 'Short excerpt of A’s answer…'}
                  placeholderTextColor={colors.ink3}
                  multiline
                  maxLength={600}
                  selectionColor={colors.orange}
                  style={styles.excerptInput}
                />
              </View>
              <View style={styles.sideBox}>
                <ModelRowButton label="Side B" modelId={modelB} onPress={() => setPicking('b')} />
                <TextInput
                  value={excerptB}
                  onChangeText={setExcerptB}
                  placeholder={kind === 'design' ? 'Describe B’s layout, palette & feel…' : 'Short excerpt of B’s answer…'}
                  placeholderTextColor={colors.ink3}
                  multiline
                  maxLength={600}
                  selectionColor={colors.orange}
                  style={styles.excerptInput}
                />
              </View>
            </View>
          </View>
        )}

        <View style={styles.field}>
          <Label>Tags (comma separated, max 4)</Label>
          <TextInput
            value={tagsRaw}
            onChangeText={setTagsRaw}
            placeholder="coding, persian, ui"
            placeholderTextColor={colors.ink3}
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={colors.orange}
            style={styles.tagInput}
          />
        </View>

        <T f="mono" size={11.5} color={colors.ink3}>
          Every Pulse post includes 1-tap <Span color={colors.sand}>Run in Chat</Span> and an OpenAI-compatible{' '}
          <Span color={colors.orangeText}>api.vigas.ai/v1</Span> snippet.
        </T>
      </ScrollView>

      <Sheet visible={picking !== null} onClose={() => setPicking(null)} title="Pick a model">
        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetList}>
          {PICKABLE.map((m) => (
            <Pressable key={m.id} accessibilityRole="button" onPress={() => pickModel(m.id)} style={styles.pickRow}>
              <OrgMonogram org={m.org} size={34} radius={10} />
              <View style={styles.flex}>
                <T f="sansSemi" size={14.5}>
                  {m.name}
                </T>
                <T f="mono" size={11.5} color={colors.ink3}>
                  {m.id}
                </T>
              </View>
              <Icon name="chevronRight" size={16} color={colors.ink3} />
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

function ModelRowButton({ label, modelId, onPress }: { label: string; modelId: string; onPress: () => void }) {
  const m = seedModels.find((x) => x.id === modelId);
  return (
    <PressableScale accessibilityLabel={`Pick ${label}`} onPress={onPress} style={styles.modelBtn}>
      <OrgMonogram org={m?.org ?? 'Vigas'} size={28} radius={8} />
      <View style={styles.flex}>
        <T f="mono" size={10.5} color={colors.ink3}>
          {label.toUpperCase()}
        </T>
        <T f="sansSemi" size={14} numberOfLines={1}>
          {modelLabel(modelId)}
        </T>
      </View>
      <Icon name="chevronDown" size={18} color={colors.ink2} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10, paddingRight: GUTTER, paddingBottom: 10 },
  rule: { marginHorizontal: GUTTER, opacity: 0.45 },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 16, gap: 18 },
  field: { gap: 8 },
  captionInput: {
    minHeight: 72,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
    color: colors.ink,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  promptInput: {
    minHeight: 112,
    color: colors.bodySoft,
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12.5,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  sides: { gap: 10 },
  sideBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
    gap: 8,
  },
  modelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  excerptInput: {
    minHeight: 60,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.code,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.ink,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  tagInput: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
    color: colors.ink,
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
  },
  sheetScroll: { maxHeight: 420 },
  sheetList: { paddingHorizontal: GUTTER, paddingBottom: 16 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
