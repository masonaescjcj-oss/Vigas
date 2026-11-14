import Link from 'next/link';
import { formatPricePerMillion, type ModelListItem } from '@vigas/core';
import { Icon, OrgMark } from './ui';

interface ShowcaseSpec {
  id: string;
  enTag: string;
  faTag: string;
  speedEn: string;
  speedFa: string;
}

const SHOWCASE: ShowcaseSpec[] = [
  { id: 'deepseek/v4.1-flash', enTag: 'Lowest cost', faTag: 'ارزان‌ترین', speedEn: '98ms TTFT', speedFa: '98ms' },
  { id: 'google/gemini-4-argon', enTag: 'Fastest edge', faTag: 'فوق‌سریع', speedEn: '105ms TTFT', speedFa: '105ms' },
  { id: 'google/gemini-4-hydrogen', enTag: '1M ctx value', faTag: 'کانتکست 1M', speedEn: '124ms TTFT', speedFa: '124ms' },
  { id: 'openai/gpt-6.1-terra', enTag: 'Reasoning -12%', faTag: 'استدلال 12%-', speedEn: '140ms TTFT', speedFa: '140ms' },
  { id: 'anthropic/claude-fable-5.2', enTag: '#1 Arena', faTag: 'رتبه ۱ Arena', speedEn: '175ms TTFT', speedFa: '175ms' },
  { id: 'nvidia/nemotron-3.5-super', enTag: 'Free tier', faTag: 'رایگان', speedEn: '160ms TTFT', speedFa: '160ms' },
];

export function HeroApiPanel({
  models,
  lang = 'en',
}: {
  models: ModelListItem[];
  lang?: 'en' | 'fa';
}) {
  const isFa = lang === 'fa';
  const byId = new Map(models.map((m) => [m.id, m]));
  const rows = SHOWCASE.map((spec) => ({ spec, model: byId.get(spec.id) })).filter(
    (entry): entry is { spec: ShowcaseSpec; model: ModelListItem } => Boolean(entry.model),
  );

  return (
    <div className="hero-api-panel card" style={{ overflow: 'hidden', borderRadius: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '13px 16px',
          borderBottom: '1px solid var(--vg-line)',
          background: 'var(--vg-bg2)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className="led" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--vg-ink)' }}>
            {isFa ? 'تعرفه مستقیم API · کمترین قیمت و بالاترین سرعت' : 'Live API rates · Lowest cost & lowest latency'}
          </span>
        </div>
        <span className="pill" style={{ color: 'var(--vg-green)', background: 'rgba(111,207,115,0.12)' }}>
          {isFa ? 'بدون کارمزد تا ۵ دلار اول' : '$0 markup on first $5'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map(({ spec, model }, i) => {
          const isFree = model.inputPerMillionMicros === 0 && model.outputPerMillionMicros === 0;
          const shortName = model.name.replace(/ \(.*\)$/, '');
          return (
            <Link
              key={model.id}
              href={`/models?q=${encodeURIComponent(model.id)}`}
              className="hero-api-row hov"
              style={{
                borderTop: i === 0 ? 0 : '1px solid var(--vg-line)',
              }}
            >
              <OrgMark org={model.org} size={32} />
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--vg-ink)' }}>{shortName}</span>
                  <span
                    className="pill"
                    style={{
                      fontSize: 11,
                      padding: '2px 7px',
                      color: isFree ? 'var(--vg-green)' : 'var(--vg-sand)',
                      background: isFree ? 'rgba(111,207,115,0.12)' : 'rgba(227,182,92,0.1)',
                    }}
                  >
                    {isFa ? spec.faTag : spec.enTag}
                  </span>
                </div>
                <div className="mn" dir="ltr" style={{ fontSize: 11, color: 'var(--vg-ink3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {model.id} · {isFa ? spec.speedFa : spec.speedEn}
                </div>
              </div>
              <div dir="ltr" style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="mn" style={{ fontSize: 13, fontWeight: 600, color: isFree ? 'var(--vg-green)' : 'var(--vg-ink)' }}>
                  {isFree ? 'FREE' : `${formatPricePerMillion(model.inputPerMillionMicros)} / ${formatPricePerMillion(model.outputPerMillionMicros)}`}
                </div>
                <div className="mn" style={{ fontSize: 10.5, color: 'var(--vg-ink3)' }}>
                  {isFree ? 'zero per 1M' : 'in / out per 1M'}
                </div>
              </div>
              <Icon
                name="chevRight"
                size={15}
                style={{ color: 'var(--vg-ink3)', flexShrink: 0, transform: isFa ? 'scaleX(-1)' : undefined }}
              />
            </Link>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
          padding: '12px 16px',
          borderTop: '1px solid var(--vg-line)',
          background: 'var(--vg-bg2)',
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link href="/models" className="tag" style={{ minHeight: 30, fontSize: 12 }}>
            {isFa ? 'همه ۲۵+ مدل' : 'All 25+ models'}
          </Link>
          <Link href="/models?tag=free" className="tag" style={{ minHeight: 30, fontSize: 12 }}>
            {isFa ? 'مدل‌های رایگان' : 'Free tier'}
          </Link>
          <Link href="/models#quickstart" className="tag" style={{ minHeight: 30, fontSize: 12 }}>
            {isFa ? 'مستندات API' : 'Quickstart'}
          </Link>
          <Link href="/leaderboard/coding" className="tag" style={{ minHeight: 30, fontSize: 12 }}>
            {isFa ? 'برترین کدنویسی' : 'Coding #1'}
          </Link>
        </div>
        <Link href="/models" className="link-arrow" style={{ fontSize: 13 }}>
          {isFa ? 'مشاهده کامل مدل‌ها و قیمت‌ها' : 'Models & live prices'}
          <Icon name="arrow" size={14} style={isFa ? { transform: 'scaleX(-1)' } : undefined} />
        </Link>
      </div>
    </div>
  );
}
