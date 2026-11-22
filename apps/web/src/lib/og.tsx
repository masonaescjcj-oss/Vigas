import fs from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { LEADERBOARD_CATEGORIES, type LeaderboardCategory } from '@vigas/core';
import { getArticleBySlug, getLeaderboardData, getToolBySlug } from '@/lib/data';

const SIZE = { width: 1200, height: 630 };
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
};

type OgFontOption = NonNullable<ConstructorParameters<typeof ImageResponse>[1]>['fonts'];
let vazirFontsPromise: Promise<OgFontOption | undefined> | null = null;

async function readFontFile(filename: string): Promise<Buffer | null> {
  const cwd = process.cwd();
  const candidates = [
    path.join(/*turbopackIgnore: true*/ cwd, 'src', 'assets', 'fonts', filename),
    path.join(/*turbopackIgnore: true*/ cwd, 'apps', 'web', 'src', 'assets', 'fonts', filename),
    path.resolve(/*turbopackIgnore: true*/ cwd, '..', '..', 'apps', 'web', 'src', 'assets', 'fonts', filename),
  ];
  for (const p of candidates) {
    try {
      return await fs.readFile(/*turbopackIgnore: true*/ p);
    } catch {
      // Try next location
    }
  }
  return null;
}

async function getPersianOgFonts(): Promise<OgFontOption | undefined> {
  if (!vazirFontsPromise) {
    vazirFontsPromise = (async () => {
      const [reg, bold] = await Promise.all([
        readFontFile('Vazirmatn-Regular.ttf'),
        readFontFile('Vazirmatn-Bold.ttf'),
      ]);
      const list: NonNullable<OgFontOption> = [];
      if (reg) list.push({ name: 'Vazirmatn', data: reg, weight: 400, style: 'normal' });
      if (bold) list.push({ name: 'Vazirmatn', data: bold, weight: 700, style: 'normal' });
      return list.length ? list : undefined;
    })();
  }
  return vazirFontsPromise;
}

const ARABIC_FORMS: Record<string, [number, number | null, number | null, number | null]> = {
  '\u0622': [0xfe81, 0xfe82, null, null], // آ
  '\u0623': [0xfe83, 0xfe84, null, null], // أ
  '\u0624': [0xfe85, 0xfe86, null, null], // ؤ
  '\u0625': [0xfe87, 0xfe88, null, null], // إ
  '\u0626': [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c], // ئ
  '\u0627': [0xfe8d, 0xfe8e, null, null], // ا
  '\u0628': [0xfe8f, 0xfe90, 0xfe91, 0xfe92], // ب
  '\u0629': [0xfe93, 0xfe94, null, null], // ة
  '\u067e': [0xfb56, 0xfb57, 0xfb58, 0xfb59], // پ
  '\u062a': [0xfe95, 0xfe96, 0xfe97, 0xfe98], // ت
  '\u062b': [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c], // ث
  '\u062c': [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0], // ج
  '\u0686': [0xfb7a, 0xfb7b, 0xfb7c, 0xfb7d], // چ
  '\u062d': [0xfea1, 0xfea2, 0xfea3, 0xfea4], // ح
  '\u062e': [0xfea5, 0xfea6, 0xfea7, 0xfea8], // خ
  '\u062f': [0xfea9, 0xfeaa, null, null], // د
  '\u0630': [0xfeab, 0xfeac, null, null], // ذ
  '\u0631': [0xfead, 0xfeae, null, null], // ر
  '\u0632': [0xfeaf, 0xfeb0, null, null], // ز
  '\u0698': [0xfb8a, 0xfb8b, null, null], // ژ
  '\u0633': [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4], // س
  '\u0634': [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8], // ش
  '\u0635': [0xfeb9, 0xfeba, 0xfebb, 0xfebc], // ص
  '\u0636': [0xfebd, 0xfebe, 0xfebf, 0xfec0], // ض
  '\u0637': [0xfec1, 0xfec2, 0xfec3, 0xfec4], // ط
  '\u0638': [0xfec5, 0xfec6, 0xfec7, 0xfec8], // ظ
  '\u0639': [0xfec9, 0xfeca, 0xfecb, 0xfecc], // ع
  '\u063a': [0xfecd, 0xfece, 0xfecf, 0xfed0], // غ
  '\u0641': [0xfed1, 0xfed2, 0xfed3, 0xfed4], // ف
  '\u0642': [0xfed5, 0xfed6, 0xfed7, 0xfed8], // ق
  '\u06a9': [0xfb8e, 0xfb8f, 0xfb90, 0xfb91], // ک
  '\u0643': [0xfed9, 0xfeda, 0xfedb, 0xfedc], // ك
  '\u06af': [0xfb92, 0xfb93, 0xfb94, 0xfb95], // گ
  '\u0644': [0xfedd, 0xfede, 0xfedf, 0xfee0], // ل
  '\u0645': [0xfee1, 0xfee2, 0xfee3, 0xfee4], // م
  '\u0646': [0xfee5, 0xfee6, 0xfee7, 0xfee8], // ن
  '\u0648': [0xfeed, 0xfeee, null, null], // و
  '\u0647': [0xfee9, 0xfeea, 0xfeeb, 0xfeec], // ه
  '\u06cc': [0xfbfc, 0xfbfd, 0xfbfe, 0xfbff], // ی
  '\u064a': [0xfef1, 0xfef2, 0xfef3, 0xfef4], // ي
  '\u0649': [0xfeef, 0xfef0, null, null], // ى
};

const LAM_ALEF: Record<string, [number, number]> = {
  '\u0622': [0xfef5, 0xfef6],
  '\u0623': [0xfef7, 0xfef8],
  '\u0625': [0xfef9, 0xfefa],
  '\u0627': [0xfefb, 0xfefc],
};

const BIDI_MIRROR: Record<string, string> = { '(': ')', ')': '(', '[': ']', ']': '[', '«': '»', '»': '«' };

function shapeRtlToken(token: string): string {
  const chars = [...token.normalize('NFC')];
  const chunks: Array<{ type: 'rtl' | 'ltr'; val: string[] }> = [];
  let cur: { type: 'rtl' | 'ltr'; val: string[] } = { type: 'rtl', val: [] };
  const push = (type: 'rtl' | 'ltr', str: string) => {
    if (cur.type !== type) {
      if (cur.val.length) chunks.push(cur);
      cur = { type, val: [str] };
    } else {
      cur.val.push(str);
    }
  };

  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    if (ch === '\u200c') {
      i += 1;
      continue;
    }
    if (/[0-9\u06f0-\u06f9\u0660-\u0669.,:%$+\-–—/A-Za-z]/.test(ch)) {
      push('ltr', ch);
      i += 1;
      continue;
    }
    const form = ARABIC_FORMS[ch];
    if (!form) {
      push('rtl', BIDI_MIRROR[ch] ?? ch);
      i += 1;
      continue;
    }
    const prev = i > 0 ? chars[i - 1]! : null;
    const prevConn = Boolean(prev && ARABIC_FORMS[prev] && ARABIC_FORMS[prev][2] !== null);
    if (ch === '\u0644' && i + 1 < chars.length && LAM_ALEF[chars[i + 1]!]) {
      const lig = LAM_ALEF[chars[i + 1]!]!;
      push('rtl', String.fromCodePoint(prevConn ? lig[1] : lig[0]));
      i += 2;
      continue;
    }
    const next = i + 1 < chars.length ? chars[i + 1]! : null;
    const nextConn = Boolean(next && ARABIC_FORMS[next] && ARABIC_FORMS[next][1] !== null);
    const canRight = form[1] !== null && prevConn;
    const canLeft = form[2] !== null && nextConn;
    const cp = canRight && canLeft ? form[3]! : canRight ? form[1]! : canLeft ? form[2]! : form[0];
    push('rtl', String.fromCodePoint(cp));
    i += 1;
  }
  if (cur.val.length) chunks.push(cur);
  return chunks
    .reverse()
    .map((c) => (c.type === 'rtl' ? c.val.reverse().join('') : c.val.join('')))
    .join('');
}

function tokenizeRtlText(text: string): string[] {
  const rawWords = text.trim().split(/\s+/).filter(Boolean);
  const tokens: string[] = [];
  let latinBuf: string[] = [];
  const flushLatin = () => {
    if (latinBuf.length) {
      tokens.push(latinBuf.join(' '));
      latinBuf = [];
    }
  };
  for (const w of rawWords) {
    const m = /^([«»("'،؛؟:.]*)(.*?)([«»)"'،؛؟:.!]*)$/.exec(w);
    const lead = m?.[1] ?? '';
    const core = m?.[2] ?? w;
    const trail = m?.[3] ?? '';
    const hasLatin = /[A-Za-z]/.test(core);
    const hasArabic = /[\u0621-\u064a\u067e\u0686\u0698\u06a9\u06af\u06cc\u06c0]/.test(core);
    if (!hasArabic && hasLatin) {
      if (lead) {
        flushLatin();
        tokens.push(shapeRtlToken(lead));
      }
      latinBuf.push(core);
      if (trail) {
        flushLatin();
        tokens.push(shapeRtlToken(trail));
      }
    } else if (!hasArabic && latinBuf.length && /^[0-9.,:%$+\-–—/]+$/.test(core)) {
      latinBuf.push(core);
      if (trail) {
        flushLatin();
        tokens.push(shapeRtlToken(trail));
      }
    } else {
      flushLatin();
      tokens.push(shapeRtlToken(w));
    }
  }
  flushLatin();
  return tokens;
}

function RtlOgText({ text, gap = 12, rowGap = 6 }: { text: string; gap?: number; rowGap?: number }) {
  const tokens = tokenizeRtlText(text);
  return (
    <div style={{ display: 'flex', flexDirection: 'row-reverse', flexWrap: 'wrap', columnGap: gap, rowGap, width: '100%' }}>
      {tokens.map((tok, i) => (
        <span key={i} style={{ display: 'flex' }}>
          {tok}
        </span>
      ))}
    </div>
  );
}

function shortName(name: string): string {
  return name.replace(/ \(.*\)$/, '');
}

function pngResponse(element: React.ReactElement, fonts?: OgFontOption): ImageResponse {
  return new ImageResponse(element, { ...SIZE, ...(fonts ? { fonts } : {}), headers: CACHE_HEADERS });
}

function OgBrandBadge({ size = 40 }: { size?: number }) {
  const svgW = Math.round(size * 0.76);
  const svgH = Math.round(svgW * (50 / 90));
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.25),
        background: '#171614',
        border: '1px solid rgba(239,234,225,0.18)',
      }}
    >
      <svg viewBox="5 26 90 50" width={svgW} height={svgH} fill="none">
        <circle cx="29" cy="50" r="17" stroke="#EFEAE1" strokeWidth="6.5" />
        <circle cx="71" cy="50" r="17" stroke="#EFEAE1" strokeWidth="6.5" />
        <line x1="29" y1="67" x2="71" y2="67" stroke="#EFEAE1" strokeWidth="6.5" strokeLinecap="round" />
        <circle cx="29" cy="50" r="6.2" fill="#FF6A1A" />
        <circle cx="71" cy="50" r="3.4" fill="#EFEAE1" />
      </svg>
    </div>
  );
}

export async function renderLeaderboardOg(category: LeaderboardCategory): Promise<Response> {
  const board = await getLeaderboardData(category);
  const label = LEADERBOARD_CATEGORIES.find((c) => c.id === category)?.label ?? 'Overall';
  const top5 = board.entries.slice(0, 5);
  const maxRate = Math.max(...top5.map((e) => e.winRate), 1);

  return pngResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#12110F',
        color: '#EFEAE1',
        padding: '54px 64px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <OgBrandBadge size={40} />
          <div style={{ display: 'flex', fontSize: 30, color: '#EFEAE1' }}>Vigas Model Leaderboard</div>
        </div>
        <div
          style={{
            display: 'flex',
            padding: '8px 18px',
            borderRadius: 10,
            background: '#1C1B18',
            border: '1px solid rgba(255,106,26,0.45)',
            color: '#FF6A1A',
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          {label.toUpperCase()}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 48, width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 500 }}>
          <div style={{ display: 'flex', fontSize: 64, lineHeight: 1.02, letterSpacing: -2 }}>
            {`Best ${category === 'overall' ? 'AI' : label} models`}
          </div>
          <div style={{ display: 'flex', fontSize: 32, lineHeight: 1.25, color: '#E3B65C', marginTop: 14 }}>
            Ranked by real sessions & blind votes.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 28 }}>
            {top5.slice(0, 3).map((e) => (
              <div key={e.modelId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 22 }}>
                <div style={{ display: 'flex', color: e.rank === 1 ? '#FF6A1A' : '#EFEAE1' }}>
                  {`#${e.rank} ${shortName(e.name)}`}
                </div>
                <div style={{ display: 'flex', color: '#6FCF73' }}>{`${e.winRate.toFixed(2)}%`}</div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 18,
            height: 310,
            flex: 1,
            padding: '24px 28px 0',
            borderRadius: 22,
            background: '#1C1B18',
            border: '1px solid rgba(239,234,225,0.12)',
          }}
        >
          {top5.map((e, i) => {
            const barH = Math.max(40, Math.round((e.winRate / maxRate) * 200));
            const fill = i === 0 ? '#FF6A1A' : i < 3 ? '#E3B65C' : '#3A3631';
            return (
              <div key={e.modelId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', fontSize: 18, color: i === 0 ? '#FF6A1A' : '#A9A298', marginBottom: 8 }}>
                  {`${e.winRate.toFixed(1)}%`}
                </div>
                <div
                  style={{
                    display: 'flex',
                    width: 62,
                    height: barH,
                    borderRadius: '8px 8px 0 0',
                    background: fill,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(239,234,225,0.12)',
          paddingTop: 18,
          fontSize: 22,
          color: '#958E84',
        }}
      >
        <div style={{ display: 'flex' }}>{`${board.totalSessions.toLocaleString('en-US')} sessions ranked`}</div>
        <div style={{ display: 'flex', color: '#EFEAE1' }}>
          {`vigas.app${category === 'overall' ? '/leaderboard' : `/leaderboard/${category}`}`}
        </div>
      </div>
    </div>,
  );
}

export async function renderToolOg(slug: string): Promise<Response> {
  const tool = await getToolBySlug(slug);
  if (!tool) return new Response('Tool not found', { status: 404 });

  const desc = tool.description.length > 140 ? `${tool.description.slice(0, 137)}...` : tool.description;
  const accent = tool.color || '#FF6A1A';

  return pngResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#12110F',
        color: '#EFEAE1',
        padding: '56px 64px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <OgBrandBadge size={40} />
          <div style={{ display: 'flex', fontSize: 28, color: '#A9A298' }}>Vigas AI Tools Directory</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              padding: '6px 16px',
              borderRadius: 8,
              background: '#1C1B18',
              border: '1px solid rgba(239,234,225,0.16)',
              color: '#EFEAE1',
              fontSize: 20,
            }}
          >
            {tool.category}
          </div>
          <div
            style={{
              display: 'flex',
              padding: '6px 16px',
              borderRadius: 8,
              background: tool.pricing === 'Free' ? 'rgba(111,207,115,0.18)' : '#1C1B18',
              color: tool.pricing === 'Free' ? '#6FCF73' : '#E3B65C',
              fontSize: 20,
            }}
          >
            {tool.pricing}
          </div>
          {tool.runsOnVigas && (
            <div
              style={{
                display: 'flex',
                padding: '6px 16px',
                borderRadius: 8,
                background: '#FF6A1A',
                color: '#12110F',
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              Vigas API
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 24,
                background: '#1C1B18',
                border: `2px solid ${accent}`,
                color: accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 52,
              }}
            >
              {tool.letter}
            </div>
            <div style={{ display: 'flex', fontSize: 72, lineHeight: 1, letterSpacing: -2 }}>{tool.name}</div>
          </div>
          <div style={{ display: 'flex', fontSize: 34, lineHeight: 1.25, color: '#E3B65C', marginTop: 26 }}>{tool.tagline}</div>
          <div style={{ display: 'flex', fontSize: 23, lineHeight: 1.4, color: '#A9A298', marginTop: 14 }}>{desc}</div>
        </div>

        <div
          style={{
            width: 260,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            padding: 28,
            borderRadius: 22,
            background: '#1C1B18',
            border: '1px solid rgba(239,234,225,0.14)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', fontSize: 18, color: '#958E84' }}>BUILDER RATING</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 48, lineHeight: 1, color: '#E3B65C' }}>
              <svg viewBox="0 0 24 24" width="38" height="38" fill="#E3B65C">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>{tool.rating.toFixed(1)}</span>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(239,234,225,0.1)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', fontSize: 18, color: '#958E84' }}>UPVOTES</div>
            <div style={{ display: 'flex', fontSize: 36, lineHeight: 1, color: '#EFEAE1' }}>{`▲ ${tool.votes.toLocaleString('en-US')}`}</div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(239,234,225,0.12)',
          paddingTop: 18,
          fontSize: 22,
          color: '#958E84',
        }}
      >
        <div style={{ display: 'flex' }}>Ranked on Vigas Tools</div>
        <div style={{ display: 'flex', color: '#FF6A1A' }}>{`vigas.app/tools/${tool.slug}`}</div>
      </div>
    </div>,
  );
}

export async function renderArticleOg(slug: string): Promise<Response> {
  const article = await getArticleBySlug(slug);
  if (!article) return new Response('Article not found', { status: 404 });

  const isFa = article.lang === 'fa';
  const fonts = isFa ? await getPersianOgFonts() : undefined;
  const maxTitle = isFa ? 105 : 96;
  const maxDek = isFa ? 148 : 136;
  const title = article.title.length > maxTitle ? `${article.title.slice(0, maxTitle - 3)}...` : article.title;
  const dek = article.dek.length > maxDek ? `${article.dek.slice(0, maxDek - 3)}...` : article.dek;

  const coverHasFa = /[\u0600-\u06ff]/.test(article.cover.caption);
  const coverBox = (
    <div
      style={{
        width: isFa ? 280 : 310,
        minHeight: 270,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 28,
        borderRadius: 22,
        background: '#1C1B18',
        border: `2px solid ${article.cover.color || '#FF6A1A'}`,
      }}
    >
      <div style={{ display: 'flex', fontSize: 18, color: '#958E84', textTransform: 'uppercase', letterSpacing: coverHasFa ? 0 : 1.5 }}>
        {coverHasFa ? <RtlOgText text={article.cover.caption} gap={6} rowGap={2} /> : article.cover.caption}
      </div>
      <div style={{ display: 'flex', fontSize: 78, lineHeight: 1, fontWeight: 700, color: article.cover.color || '#FF6A1A' }}>
        {/[\u0600-\u06ff]/.test(article.cover.big) ? <RtlOgText text={article.cover.big} gap={6} rowGap={2} /> : article.cover.big}
      </div>
    </div>
  );

  return pngResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#12110F',
        color: '#EFEAE1',
        padding: '54px 62px',
        ...(isFa && fonts ? { fontFamily: 'Vazirmatn' } : {}),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <OgBrandBadge size={40} />
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: '#EFEAE1' }}>Vigas Newsroom</div>
          {isFa && (
            <div
              style={{
                display: 'flex',
                padding: '4px 12px',
                borderRadius: 8,
                background: 'rgba(227,182,92,0.16)',
                border: '1px solid rgba(227,182,92,0.45)',
                color: '#E3B65C',
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              {shapeRtlToken('فارسی')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {article.flag && (
            <div
              style={{
                display: 'flex',
                padding: '6px 14px',
                borderRadius: 8,
                background: article.flag === 'Analysis' ? '#E3B65C' : '#FF6A1A',
                color: '#12110F',
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {article.flag.toUpperCase()}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              padding: '6px 16px',
              borderRadius: 8,
              background: '#1C1B18',
              border: '1px solid rgba(239,234,225,0.16)',
              color: '#FF6A1A',
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {article.category.toUpperCase()}
          </div>
        </div>
      </div>

      {isFa ? (
        <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 38, width: '100%' }}>
          {coverBox}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
            <div style={{ display: 'flex', fontSize: 42, lineHeight: 1.35, fontWeight: 700, color: '#EFEAE1' }}>
              <RtlOgText text={title} gap={12} rowGap={6} />
            </div>
            <div style={{ display: 'flex', fontSize: 21, lineHeight: 1.45, fontWeight: 400, color: '#A9A298', marginTop: 22 }}>
              <RtlOgText text={dek} gap={8} rowGap={4} />
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 36, width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
            <div style={{ display: 'flex', fontSize: 54, lineHeight: 1.06, letterSpacing: -1.5, color: '#EFEAE1' }}>{title}</div>
            <div style={{ display: 'flex', fontSize: 24, lineHeight: 1.38, color: '#A9A298', marginTop: 22 }}>{dek}</div>
          </div>
          {coverBox}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(239,234,225,0.12)',
          paddingTop: 20,
          fontSize: 22,
          color: '#958E84',
        }}
      >
        <div style={{ display: 'flex', color: '#EFEAE1' }}>{`${article.author.name} · ${article.author.role}`}</div>
        <div style={{ display: 'flex', color: '#E3B65C' }}>{`${article.readingMinutes} min read · vigas.app`}</div>
      </div>
    </div>,
    fonts,
  );
}
