import { formatUsd } from '@vigas/core';
import { seedModels } from '@vigas/core/seed';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { navStamp } from '@/lib/format';
import { colors, radius } from '@/theme';

import { CodeWell, FlutedBar, Led, Tag } from './boxes';
import { KeyButton } from './buttons';
import { Icon } from './icons';
import { OrgMonogram } from './monogram';
import { PressableScale } from './pressable';
import { Label, Span, T } from './text';

interface Preset {
  id: string;
  label: string;
  sub: string;
  inM: number;
  outM: number;
}

const PRESETS: Preset[] = [
  { id: 'dev', label: 'Cursor / IDE', sub: '12M in · 3M out / mo', inM: 12, outM: 3 },
  { id: 'chat', label: 'SaaS Chat', sub: '4M in · 2M out / mo', inM: 4, outM: 2 },
  { id: 'bot', label: 'Invoice / Bot', sub: '2M in · 0.5M out / mo', inM: 2, outM: 0.5 },
  { id: 'agents', label: 'Agent Fleet', sub: '40M in · 10M out / mo', inM: 40, outM: 10 },
];

const COMPARE_IDS = [
  'deepseek/v4.1-flash',
  'google/gemini-4-carbon',
  'openai/gpt-6.1-terra',
  'anthropic/claude-fable-5.2',
] as const;

const BASELINE_ID = 'anthropic/claude-opus-5.5';

const byId = new Map(seedModels.map((m) => [m.id, m]));

function monthlyMicros(modelId: string, inM: number, outM: number): number {
  const m = byId.get(modelId);
  if (!m) return 0;
  return Math.round(m.inputPerMillionMicros * inM + m.outputPerMillionMicros * outM);
}

/**
 * Zero-token-cost interactive API Cost & Savings Estimator.
 * Lets developers and visitors compare monthly spend across frontier labs on `api.vigas.ai/v1`.
 */
export function CostCalculator({ compact = false }: { compact?: boolean }) {
  const [presetId, setPresetId] = useState<string>('dev');
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]!;

  const rows = COMPARE_IDS.map((id) => {
    const m = byId.get(id);
    if (!m) return null;
    const cost = monthlyMicros(id, preset.inM, preset.outM);
    return { model: m, cost };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  const baseline = Math.max(monthlyMicros(BASELINE_ID, preset.inM, preset.outM), 1);
  const maxCost = Math.max(...rows.map((r) => r.cost), 1);
  const cheapest = rows[0];
  const savingsPct = cheapest ? Math.max(0, Math.round((1 - cheapest.cost / baseline) * 100)) : 0;

  const snippet = [
    'curl https://api.vigas.ai/v1/chat/completions \\',
    '  -H "Authorization: Bearer $VIGAS_API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    `  -d '{"model":"${cheapest?.model.id ?? 'deepseek/v4.1-flash'}","messages":[{"role":"user","content":"Hello"}]}'`,
  ].join('\n');

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Label color={colors.sand}>§ API Cost Estimator</Label>
          <T f="serif" size={compact ? 25 : 28} lh={1.08} style={styles.title}>
            Pay wholesale, <Span f="serifItalic" color={colors.sand}>save up to {savingsPct}%.</Span>
          </T>
        </View>
        <Tag text="0% first $5" color={colors.green} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
        {PRESETS.map((p) => {
          const on = p.id === preset.id;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                haptics.select();
                setPresetId(p.id);
              }}
              style={[styles.preset, on && styles.presetOn]}
            >
              <T f="monoMedium" size={12} color={on ? colors.onOrange : colors.ink}>
                {p.label}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.subRow}>
        <Led color={colors.green} size={6} still />
        <T f="mono" size={11.5} color={colors.ink3}>
          {preset.sub} · vs Opus ({formatUsd(baseline)}/mo)
        </T>
      </View>

      <View style={styles.rows}>
        {rows.slice(0, compact ? 3 : 4).map(({ model, cost }, idx) => {
          const pct = Math.max(6, Math.round((cost / maxCost) * 100));
          const isBest = idx === 0;
          return (
            <PressableScale
              key={model.id}
              accessibilityLabel={`${model.name}: ${formatUsd(cost)} per month. Open in Chat.`}
              onPress={() => router.navigate({ pathname: '/chat', params: { model: model.id, t: navStamp() } })}
              scaleTo={0.985}
              style={styles.row}
            >
              <OrgMonogram org={model.org} size={30} radius={9} />
              <View style={styles.flex}>
                <View style={styles.rowTop}>
                  <T f="sansSemi" size={13.5} numberOfLines={1} style={styles.shrink}>
                    {model.name}
                  </T>
                  {isBest ? <Tag text="LOWEST" color={colors.green} /> : null}
                  <T f="monoSemi" size={13} color={isBest ? colors.green : colors.ink} style={styles.price}>
                    {formatUsd(cost)}/mo
                  </T>
                </View>
                <FlutedBar
                  pct={pct}
                  fill={isBest ? colors.green : idx === 1 ? colors.sand : colors.pillar}
                  groove={isBest ? '#3E8E42' : idx === 1 ? colors.sandDeep : colors.grooveDark}
                  height={7}
                  delay={idx * 40}
                />
              </View>
            </PressableScale>
          );
        })}
      </View>

      {!compact ? (
        <CodeWell caption="Drop-in OpenAI SDK endpoint" meta={<Led color={colors.green} size={6} />}>
          <T f="mono" size={11} lh={1.5} color={colors.bodySoft} selectable>
            {snippet}
          </T>
        </CodeWell>
      ) : null}

      <View style={styles.foot}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void Share.share({ message: snippet }).catch(() => undefined)}
          style={styles.ghost}
        >
          <Icon name="code" size={15} color={colors.ink} />
          <T f="monoMedium" size={12} color={colors.ink}>
            Share cURL
          </T>
        </Pressable>
        <KeyButton
          label={compact ? 'Full API Console' : 'Connect IDE'}
          height={38}
          radius={11}
          fontSize={13}
          onPress={() =>
            compact
              ? router.navigate('/wallet')
              : router.navigate({ pathname: '/explore', params: { seg: 'tools', t: navStamp() } })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
    padding: 16,
    gap: 12,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { marginTop: 4 },
  presets: { gap: 7 },
  preset: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  presetOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rows: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  price: { marginLeft: 'auto' },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 4 },
  ghost: {
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
