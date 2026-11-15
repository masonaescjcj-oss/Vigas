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
  { id: 'deepseek/v4.1-flash', enTag: 'Lowest cost', faTag: 'ارزان‌ترین', speedEn: '98ms', speedFa: '98ms' },
  { id: 'google/gemini-4-argon', enTag: 'Fastest', faTag: 'فوق‌سریع', speedEn: '105ms', speedFa: '105ms' },
  { id: 'openai/gpt-6.1-terra', enTag: 'Reasoning -12%', faTag: 'استدلال 12%-', speedEn: '140ms', speedFa: '140ms' },
  { id: 'anthropic/claude-fable-5.2', enTag: '#1 Arena', faTag: 'رتبه ۱ Arena', speedEn: '175ms', speedFa: '175ms' },
];

const toFaDigits = (n: number) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);

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
    <div className="hero-rates">
      <div className="hero-rates-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className="led" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--vg-ink)', whiteSpace: 'nowrap' }}>
            {isFa ? 'تعرفه‌های زنده API' : 'Live API rates'}
          </span>
        </div>
        <span className="pill" style={{ color: 'var(--vg-green)', background: 'rgba(111,207,115,0.12)', fontSize: 11.5 }}>
          {isFa ? '۰٪ کارمزد تا ۵ دلار' : '$0 fee · first $5'}
        </span>
      </div>

      <div>
        {rows.map(({ spec, model }, i) => {
          const isFree = model.inputPerMillionMicros === 0 && model.outputPerMillionMicros === 0;
          const shortName = model.name.replace(/ \(.*\)$/, '');
          const speed = isFa ? spec.speedFa : spec.speedEn;
          const isSub120 = parseInt(speed, 10) <= 120;
          return (
            <Link
              key={model.id}
              href={`/models?q=${encodeURIComponent(model.id)}`}
              className={i === 0 ? 'hero-rate-row' : 'hero-rate-row hero-rate-sep'}
            >
              <OrgMark org={model.org} size={32} />
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--vg-ink)', whiteSpace: 'nowrap' }}>{shortName}</span>
                  <span
                    className="pill hero-rate-tag"
                    style={{
                      fontSize: 10.5,
                      padding: '1px 6px',
                      color: isFree ? 'var(--vg-green)' : 'var(--vg-sand)',
                      background: isFree ? 'rgba(111,207,115,0.12)' : 'rgba(227,182,92,0.1)',
                    }}
                  >
                    {isFa ? spec.faTag : spec.enTag}
                  </span>
                </div>
                <div className="mn" dir="ltr" style={{ fontSize: 11, color: 'var(--vg-ink3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: isSub120 ? 'var(--vg-green)' : 'var(--vg-ink2)' }}>{speed}</span>
                  {' · '}
                  {model.id}
                </div>
              </div>
              <div dir="ltr" style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="mn" style={{ fontSize: 13, fontWeight: 600, color: isFree ? 'var(--vg-green)' : 'var(--vg-ink)' }}>
                  {isFree ? 'FREE' : `${formatPricePerMillion(model.inputPerMillionMicros)} / ${formatPricePerMillion(model.outputPerMillionMicros)}`}
                </div>
                <div className="mn" style={{ fontSize: 10, color: 'var(--vg-ink3)' }}>
                  {isFree ? 'per 1M' : 'in / out · 1M'}
                </div>
              </div>
              <Icon
                name="chevRight"
                size={14}
                className="hero-rate-chev"
                style={isFa ? { transform: 'scaleX(-1)' } : undefined}
              />
            </Link>
          );
        })}
      </div>

      <div className="hero-rates-foot">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link href="/models?tag=free" className="tag" style={{ minHeight: 28, fontSize: 12, padding: '0 10px' }}>
            {isFa ? 'مدل‌های رایگان' : 'Free models'}
          </Link>
          <Link href="/models#quickstart" className="tag hero-rate-chip-alt" style={{ minHeight: 28, fontSize: 12, padding: '0 10px' }}>
            {isFa ? 'مستندات API' : 'Quickstart'}
          </Link>
        </div>
        <Link href="/models" className="link-arrow" style={{ fontSize: 13 }}>
          {isFa ? `همه ${toFaDigits(models.length)} مدل و قیمت‌ها` : `All ${models.length} models & prices`}
          <Icon name="arrow" size={14} style={isFa ? { transform: 'scaleX(-1)' } : undefined} />
        </Link>
      </div>
    </div>
  );
}
