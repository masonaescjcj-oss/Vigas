import { formatContext, formatPricePerMillion, MODEL_TAGS, type ModelListItem, type ModelTag } from '@vigas/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';

import { api } from '@/lib/api';
import { fallbackModels } from '@/lib/fallback';
import { haptics } from '@/lib/haptics';
import { intl, navStamp } from '@/lib/format';
import { useRemote } from '@/lib/remote';
import { colors, GUTTER, orgMark, radius } from '@/theme';

import { CodeWell, Led, SpecStrip, Tag } from './boxes';
import { KeyButton } from './buttons';
import { ChipRow } from './chips';
import { CostCalculator } from './cost-calculator';
import { Icon } from './icons';
import { Monogram } from './monogram';
import { IconButton, PressableScale } from './pressable';
import { EmptyState } from './states';
import { Label, Span, T } from './text';

type ConnectClient = 'cursor' | 'cline' | 'claude' | 'n8n';

const MODEL_CHIPS: { id: 'All' | ModelTag; label: string }[] = [
  { id: 'All', label: 'All' },
  ...MODEL_TAGS.map((t) => ({ id: t, label: t[0]!.toUpperCase() + t.slice(1) })),
];

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

/** Searchable 26-model catalogue with live per-1M pricing inside the API Console tab. */
export function ModelsCatalogue() {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<'All' | ModelTag>('All');
  const models = useRemote('models', () => api.models(), { fallback: fallbackModels });

  const all = models.data?.items ?? [];
  const q = query.trim().toLowerCase();
  const rows = all.filter(
    (m) => (tag === 'All' || m.tags.includes(tag)) && (!q || `${m.name} ${m.id} ${m.org}`.toLowerCase().includes(q)),
  );

  return (
    <View style={styles.section}>
      <View style={styles.pad}>
        <SpecStrip
          items={[
            { label: 'Gateway', value: 'api.vigas.ai', color: colors.orangeText },
            { label: 'Fee', value: '0% first $5', color: colors.green },
            { label: 'Routing', value: 'Auto-failover' },
          ]}
        />
        <View style={styles.search}>
          <Icon name="search" size={19} color={colors.ink3} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={all.length ? `Search ${intl(all.length)} models & API prices` : 'Search models'}
            placeholderTextColor={colors.ink3}
            accessibilityLabel="Search models"
            returnKeyType="search"
            autoCorrect={false}
            selectionColor={colors.orange}
            cursorColor={colors.orange}
            style={styles.input}
          />
          {query ? (
            <IconButton icon="close" accessibilityLabel="Clear search" size={38} iconSize={17} color={colors.ink2} onPress={() => setQuery('')} />
          ) : null}
        </View>
      </View>

      <ChipRow options={MODEL_CHIPS} value={tag} onChange={setTag} accessibilityLabel="Model capability" style={styles.chips} height={36} />

      <View style={styles.pad}>
        <Label style={styles.countLbl}>{`${rows.length} models · tap any model to test in Chat`}</Label>
        {rows.length ? (
          rows.map((m) => <ModelRow key={m.id} model={m} />)
        ) : (
          <EmptyState title="No matching models" body={`Nothing matched “${query.trim()}”.`} />
        )}
      </View>
    </View>
  );
}

function ModelRow({ model }: { model: ModelListItem }) {
  const chg = model.priceChange24h;
  const badgeColor = chg < 0 ? colors.green : chg > 0 ? colors.red : colors.ink3;
  const badgeText = chg < 0 ? `▼ ${Math.abs(chg)}%` : chg > 0 ? `▲ ${chg}%` : '—';
  const mark = orgMark(model.org);
  return (
    <PressableScale
      accessibilityLabel={`${model.name} by ${model.org}. Open in Chat`}
      onPress={() => {
        haptics.select();
        router.navigate({ pathname: '/chat', params: { model: model.id, t: navStamp() } });
      }}
      scaleTo={0.985}
      style={styles.modelRow}
    >
      <Monogram letter={mark.letter} color={mark.color} size={44} radius={12} />
      <View style={styles.flex}>
        <View style={styles.modelHead}>
          <T f="sansSemi" numberOfLines={1} style={styles.flex}>
            {model.name}
          </T>
          <T f="monoSemi" size={11} color={badgeColor}>
            {badgeText}
          </T>
        </View>
        <T f="mono" size={11.5} color={colors.ink3} numberOfLines={1}>
          {model.id}
        </T>
        <T f="mono" size={11.5} color={colors.ink2}>
          {formatContext(model.contextLength)} · IN {formatPricePerMillion(model.inputPerMillionMicros)} · OUT{' '}
          {formatPricePerMillion(model.outputPerMillionMicros)}
        </T>
      </View>
      <Icon name="chevronRight" size={17} color={colors.ink3} />
    </PressableScale>
  );
}

/** 30-second IDE Connect LCD box + full Cost Estimator inside the API Console tab. */
export function ConnectIdePanel({ onOpenConsole }: { onOpenConsole: () => void }) {
  const [tab, setTab] = useState<ConnectClient>('cursor');
  const active = CONNECT_TABS.find((c) => c.id === tab) ?? CONNECT_TABS[0]!;

  return (
    <View style={[styles.section, styles.pad, styles.connectStack]}>
      <View style={styles.connectBox}>
        <View style={styles.connectHead}>
          <View style={styles.flex}>
            <Label color={colors.sand}>§ Connect in 30 seconds</Label>
            <T f="serif" size={26} lh={1.08} style={styles.connectTitle}>
              Use your Vigas key in <Span f="serifItalic" color={colors.sand}>any IDE.</Span>
            </T>
          </View>
          <Led color={colors.green} size={7} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.connectPills}>
          {CONNECT_TABS.map((item) => {
            const on = item.id === tab;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => {
                  haptics.select();
                  setTab(item.id);
                }}
                style={[styles.connectPill, on && styles.connectPillOn]}
              >
                <T f="monoMedium" size={12} color={on ? colors.onOrange : colors.ink2}>
                  {item.label}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>
        <CodeWell caption={active.note} meta={<Tag text="OPENAI V1" color={colors.green} />}>
          <T f="mono" size={11.5} lh={1.55} color={colors.bodySoft} selectable>
            {active.snippet}
          </T>
        </CodeWell>
        <View style={styles.connectActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void Share.share({ message: active.snippet }).catch(() => undefined)}
            style={styles.connectGhost}
          >
            <Icon name="share" size={15} color={colors.ink} />
            <T f="monoMedium" size={12} color={colors.ink}>
              Share config
            </T>
          </Pressable>
          <KeyButton
            label="Manage API keys"
            height={38}
            radius={11}
            fontSize={13}
            icon={<Icon name="key" size={14} color={colors.onOrange} />}
            onPress={onOpenConsole}
          />
        </View>
      </View>

      <CostCalculator />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pad: { paddingHorizontal: GUTTER },
  section: { marginTop: 18 },
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
  chips: { marginTop: 12 },
  countLbl: { marginTop: 16, marginBottom: 8 },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,234,225,0.06)',
  },
  modelHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connectStack: { gap: 18 },
  connectBox: {
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
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line2,
  },
});
