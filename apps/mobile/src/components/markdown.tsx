import { Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { Span, T } from './text';

/**
 * Minimal Markdown for news bodies and chat replies: paragraphs, `##`/`###` headings, `-`/`1.` lists,
 * `>` quotes, and inline **bold**, *italic* and `code`. Anything else renders as plain text.
 */

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h'; level: 2 | 3; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; text: string };

export function parseBlocks(src: string): Block[] {
  const out: Block[] = [];
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: 'p', text: para.join('\n').trim() });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```')) code.push(lines[i++] ?? '');
      out.push({ kind: 'code', text: code.join('\n') });
      continue;
    }
    if (!trimmed) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      flush();
      out.push({ kind: 'h', level: h[1]!.length >= 3 ? 3 : 2, text: h[2] ?? '' });
      continue;
    }
    const li = /^([-*•]|\d+[.)])\s+(.*)$/.exec(trimmed);
    if (li) {
      flush();
      const kind = /\d/.test(li[1]!) ? 'ol' : 'ul';
      const last = out[out.length - 1];
      if (last && last.kind === kind) last.items.push(li[2] ?? '');
      else out.push({ kind, items: [li[2] ?? ''] });
      continue;
    }
    if (trimmed.startsWith('>')) {
      flush();
      out.push({ kind: 'quote', text: trimmed.replace(/^>\s?/, '') });
      continue;
    }
    para.push(line);
  }
  flush();
  return out;
}

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

export function Inline({ text, serif = false }: { text: string; serif?: boolean }): ReactNode {
  const parts = text.split(INLINE).filter(Boolean);
  return parts.map((part, i) => {
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return (
        <Span key={i} f={serif ? 'serif' : 'sansSemi'} color={colors.ink} style={serif ? styles.serifBold : undefined}>
          {part.slice(2, -2)}
        </Span>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Span key={i} f="mono" color={colors.sand} style={styles.code}>
          {part.slice(1, -1)}
        </Span>
      );
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return (
        <Span key={i} f={serif ? 'serifItalic' : 'sans'} style={serif ? undefined : styles.italic}>
          {part.slice(1, -1)}
        </Span>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export interface MarkdownProps {
  text: string;
  /** `article`: Instrument Serif reading type. `chat`: Inter UI type. */
  variant?: 'article' | 'chat';
  /** Orange drop cap on the first paragraph (article). */
  dropCap?: boolean;
  /** Extra nodes inserted after the block at that index (charts, pull quotes). */
  inserts?: Record<number, ReactNode>;
  color?: string;
}

export function Markdown({ text, variant = 'chat', dropCap = false, inserts, color }: MarkdownProps) {
  const article = variant === 'article';
  const blocks = parseBlocks(text);
  const body = {
    f: article ? ('serif' as const) : ('sans' as const),
    size: article ? 20 : 15,
    lh: article ? 1.62 : 1.55,
    color: color ?? (article ? colors.body : colors.ink),
  };
  let usedDropCap = false;

  return (
    <View style={article ? styles.articleGap : styles.chatGap}>
      {blocks.map((b, i) => {
        let node: ReactNode;
        switch (b.kind) {
          case 'h':
            node = article ? (
              <T f="serif" size={b.level === 2 ? 28 : 23} lh={1.15} accessibilityRole="header" style={styles.articleH}>
                <Inline text={b.text} serif />
              </T>
            ) : (
              <T f="sansSemi" size={b.level === 2 ? 17 : 15.5} lh={1.35} accessibilityRole="header">
                <Inline text={b.text} />
              </T>
            );
            break;
          case 'ul':
          case 'ol':
            node = (
              <View style={styles.list}>
                {b.items.map((item, k) => (
                  <View key={k} style={styles.li}>
                    <T {...body} style={styles.bullet} color={colors.ink3}>
                      {b.kind === 'ol' ? `${k + 1}.` : '•'}
                    </T>
                    <T {...body} style={styles.liText}>
                      <Inline text={item} serif={article} />
                    </T>
                  </View>
                ))}
              </View>
            );
            break;
          case 'quote':
            node = article ? (
              <T f="serifItalic" size={25} lh={1.28} color={colors.sand}>
                <Inline text={b.text} serif />
              </T>
            ) : (
              <View style={styles.chatQuote}>
                <T {...body} color={colors.ink2}>
                  <Inline text={b.text} />
                </T>
              </View>
            );
            break;
          case 'code':
            node = (
              <View style={styles.codeBlock}>
                <T f="mono" size={13} lh={1.5} color={colors.ink}>
                  {b.text}
                </T>
              </View>
            );
            break;
          default: {
            const cap = dropCap && article && !usedDropCap && b.text.length > 1;
            if (cap) usedDropCap = true;
            node = cap ? (
              <T {...body}>
                <Span f="serif" color={colors.orange} style={styles.dropCap}>
                  {b.text.slice(0, 1)}
                </Span>
                <Inline text={b.text.slice(1)} serif />
              </T>
            ) : (
              <T {...body}>
                <Inline text={b.text} serif={article} />
              </T>
            );
          }
        }
        return (
          <Fragment key={i}>
            {node}
            {inserts?.[i] ?? null}
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  articleGap: { gap: 20 },
  chatGap: { gap: 10 },
  articleH: { marginTop: 6 },
  serifBold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  code: { fontSize: 13, backgroundColor: colors.raised },
  dropCap: { fontSize: 44 },
  list: { gap: 6 },
  li: { flexDirection: 'row', gap: 8 },
  bullet: { minWidth: 14 },
  liText: { flex: 1 },
  chatQuote: { borderLeftWidth: 2, borderLeftColor: colors.line3, paddingLeft: 12 },
  codeBlock: { backgroundColor: colors.code, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 12 },
});
