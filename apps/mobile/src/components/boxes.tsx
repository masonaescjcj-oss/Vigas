import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, GUTTER, radius } from '@/theme';

import { DotGrid } from './news-cover';
import { Label, Span, T } from './text';

/**
 * The signature boxes of vigas.app, rebuilt natively: live LEDs, `§` section heads with an italic
 * accent, bento cards, LCD code wells and fluted share bars. Every screen composes these so the app
 * reads as the same instrument as the website.
 */

/** Live status LED with a slow breathing glow (`.led` on the website). */
export function Led({ color = colors.green, size = 7, still = false }: { color?: string; size?: number; still?: boolean }) {
  const glow = useSharedValue(0.35);
  useEffect(() => {
    if (still) return;
    glow.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [glow, still]);
  const halo = useAnimatedStyle(() => ({ opacity: glow.get() * 0.45, transform: [{ scale: 1 + glow.get() * 0.9 }] }));
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: color }, halo]} />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

/** `§ 02 — Live market` + serif title with an italic sand accent. */
export function SectionHead({
  index,
  label,
  title,
  accent,
  right,
  style,
  size = 28,
}: {
  index?: string;
  label: string;
  title?: string;
  accent?: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
  size?: number;
}) {
  return (
    <View style={[styles.sectionHead, style]}>
      <View style={styles.flex}>
        <Label>{index ? `§ ${index} — ${label}` : label}</Label>
        {title ? (
          <T f="serif" size={size} lh={1.06} ls={-0.016} accessibilityRole="header" style={styles.sectionTitle}>
            {title}
            {accent ? (
              <Span f="serifItalic" color={colors.sand}>
                {' '}
                {accent}
              </Span>
            ) : null}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** Bento card: surface panel with an hairline border and a numbered mono label. */
export function Bento({ children, style, tone = 'surface' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'surface' | 'cover' }) {
  return (
    <View style={[styles.bento, tone === 'cover' && styles.bentoCover, style]}>
      {tone === 'cover' ? <DotGrid spacing={14} opacity={0.11} /> : null}
      {children}
    </View>
  );
}

/** Small mono tag pill (`.pill`). */
export function Tag({ text, color = colors.sand, bg, style }: { text: string; color?: string; bg?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg ?? `${color}22` }, style]}>
      <T f="monoSemi" size={10.5} ls={0.06} color={color} numberOfLines={1}>
        {text.toUpperCase()}
      </T>
    </View>
  );
}

/**
 * LCD code well: near-black inset with a "device" title bar (three pillar-colored dots and a mono
 * caption) — the dark wells from the API console and `/chat` hardware theme.
 */
export function CodeWell({
  caption,
  meta,
  children,
  style,
}: {
  caption?: string;
  meta?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.well, style]}>
      {caption || meta ? (
        <View style={styles.wellBar}>
          <View style={styles.dots}>
            <View style={[styles.dot, { backgroundColor: colors.orange }]} />
            <View style={[styles.dot, { backgroundColor: colors.sand }]} />
            <View style={[styles.dot, { backgroundColor: colors.pillar }]} />
          </View>
          {caption ? (
            <T f="mono" size={11} color={colors.ink3} numberOfLines={1} style={styles.flex}>
              {caption}
            </T>
          ) : (
            <View style={styles.flex} />
          )}
          {meta}
        </View>
      ) : null}
      <View style={styles.wellBody}>{children}</View>
    </View>
  );
}

/**
 * Horizontal fluted bar (a colonnade lying on its side): fill width animates to `pct`, with 1px
 * grooves every 6px like the website's `repeating-linear-gradient` pillars.
 */
export function FlutedBar({
  pct,
  fill = colors.orange,
  groove = colors.orangeDeep,
  height = 10,
  delay = 0,
}: {
  pct: number;
  fill?: string;
  groove?: string;
  height?: number;
  delay?: number;
}) {
  const w = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => w.set(withTiming(Math.max(0, Math.min(100, pct)), { duration: 650, easing: Easing.out(Easing.cubic) })), delay);
    return () => clearTimeout(t);
  }, [pct, delay, w]);
  const bar = useAnimatedStyle(() => ({ width: `${w.get()}%` }));
  const flutes = 28;
  return (
    <View style={[styles.track, { height, borderRadius: height / 3 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.fill, { backgroundColor: groove, borderRadius: height / 3 }, bar]}>
        {Array.from({ length: flutes }, (_, i) => (
          <View key={i} style={[styles.flute, { backgroundColor: fill }]} />
        ))}
      </Animated.View>
    </View>
  );
}

/** Thin fluted rule used as a decorative divider / capital under headers. */
export function FlutedRule({ color = colors.pillar, style }: { color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.rule, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 48 }, (_, i) => (
        <View key={i} style={[styles.ruleFlute, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

/** Mono spec strip: `98ms · 1M ctx · $0.07/1M` separated by hairlines. */
export function SpecStrip({ items, style }: { items: { label: string; value: string; color?: string }[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.spec, style]}>
      {items.map((it, i) => (
        <View key={it.label} style={[styles.specCell, i > 0 && styles.specSep]}>
          <T f="mono" size={10} ls={0.08} color={colors.ink3} numberOfLines={1}>
            {it.label.toUpperCase()}
          </T>
          <T f="monoSemi" size={13} color={it.color ?? colors.ink} numberOfLines={1}>
            {it.value}
          </T>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: GUTTER, marginBottom: 14 },
  sectionTitle: { marginTop: 6 },
  bento: {
    marginHorizontal: GUTTER,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    overflow: 'hidden',
    gap: 12,
  },
  bentoCover: { backgroundColor: colors.cover },
  tag: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  well: { backgroundColor: colors.code, borderRadius: 14, borderWidth: 1, borderColor: colors.line2, overflow: 'hidden' },
  wellBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  wellBody: { paddingHorizontal: 14, paddingVertical: 12 },
  track: { width: '100%', backgroundColor: colors.raised, overflow: 'hidden' },
  fill: { height: '100%', flexDirection: 'row', gap: 1, overflow: 'hidden' },
  flute: { flex: 1 },
  rule: { flexDirection: 'row', gap: 2, height: 6, overflow: 'hidden' },
  ruleFlute: { flex: 1, borderRadius: 1 },
  spec: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.bg2 },
  specCell: { flex: 1, minWidth: 0, paddingVertical: 9, paddingHorizontal: 10, gap: 2 },
  specSep: { borderLeftWidth: 1, borderLeftColor: colors.line },
});
