import { ImageResponse } from 'next/og';
import { LEADERBOARD_CATEGORIES, type LeaderboardCategory } from '@vigas/core';
import { getArticleBySlug, getLeaderboardData, getToolBySlug } from '@/lib/data';

const SIZE = { width: 1200, height: 630 };
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
};

function shortName(name: string): string {
  return name.replace(/ \(.*\)$/, '');
}

function pngResponse(element: React.ReactElement): ImageResponse {
  return new ImageResponse(element, { ...SIZE, headers: CACHE_HEADERS });
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
          <div style={{ display: 'flex', width: 38, height: 38, borderRadius: 10, background: '#FF6A1A' }} />
          <div style={{ display: 'flex', fontSize: 30, color: '#EFEAE1' }}>Vigas Arena Leaderboard</div>
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
          {`vigas.ai${category === 'overall' ? '/leaderboard' : `/leaderboard/${category}`}`}
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
          <div style={{ display: 'flex', width: 38, height: 38, borderRadius: 10, background: '#FF6A1A' }} />
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
            <div style={{ display: 'flex', fontSize: 48, lineHeight: 1, color: '#E3B65C' }}>{`★ ${tool.rating.toFixed(1)}`}</div>
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
        <div style={{ display: 'flex', color: '#FF6A1A' }}>{`vigas.ai/tools/${tool.slug}`}</div>
      </div>
    </div>,
  );
}

export async function renderArticleOg(slug: string): Promise<Response> {
  const article = await getArticleBySlug(slug);
  if (!article) return new Response('Article not found', { status: 404 });

  const title = article.title.length > 96 ? `${article.title.slice(0, 93)}...` : article.title;
  const dek = article.dek.length > 136 ? `${article.dek.slice(0, 133)}...` : article.dek;

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
          <div style={{ display: 'flex', width: 38, height: 38, borderRadius: 10, background: '#FF6A1A' }} />
          <div style={{ display: 'flex', fontSize: 30, color: '#EFEAE1' }}>Vigas Newsroom</div>
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

      <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 36, width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: 54, lineHeight: 1.06, letterSpacing: -1.5, color: '#EFEAE1' }}>{title}</div>
          <div style={{ display: 'flex', fontSize: 24, lineHeight: 1.38, color: '#A9A298', marginTop: 22 }}>{dek}</div>
        </div>

        <div
          style={{
            width: 310,
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
          <div style={{ display: 'flex', fontSize: 18, color: '#958E84', textTransform: 'uppercase', letterSpacing: 1.5 }}>
            {article.cover.caption}
          </div>
          <div style={{ display: 'flex', fontSize: 82, lineHeight: 1, color: article.cover.color || '#FF6A1A' }}>
            {article.cover.big}
          </div>
        </div>
      </div>

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
        <div style={{ display: 'flex', color: '#E3B65C' }}>{`${article.readingMinutes} min read · vigas.ai`}</div>
      </div>
    </div>,
  );
}
