import Link from 'next/link';
import { Checkpoints } from '@/components/checkpoints';
import { SiteHeader } from '@/components/site-header';
import { Breadcrumb, Icon, JsonLd, type IconName } from '@/components/ui';
import { RETROBUILD_URL } from '@/lib/env';
import { breadcrumbLd, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'RetroBuild — describe an app, the agent builds it',
  description:
    'RetroBuild is a mobile-first app builder agent that runs on your Vigas key: every step is a checkpoint you can preview, diff and restore, billed per token to your Vigas credits.',
  path: '/retrobuild',
});

const STEPS: Array<['d' | 'r' | 't', string, string]> = [
  ['d', 'Created schema & SQLite store', '+120'],
  ['d', 'Built habit list UI', '+214'],
  ['d', 'Streak counter hook', '+88'],
  ['r', 'Generating WeeklyHeatmap.tsx…', '12s'],
  ['t', 'Run unit tests & snapshot', ''],
];

const DIFF: Array<[' ' | '+' | '-', string]> = [
  [' ', 'import { View, Pressable } from "react-native";'],
  [' ', 'import { useStreak } from "./useStreak";'],
  [' ', ''],
  ['-', 'export function WeeklyHeatmap() {'],
  ['+', 'export function WeeklyHeatmap({ weeks = 7 }) {'],
  [' ', '  const { days } = useStreak();'],
  ['+', '  const cells = days.slice(-weeks * 7);'],
  ['+', '  const level = (n) => Math.min(4, n);'],
  [' ', '  return ('],
  ['-', '    <View style={styles.row} />'],
  ['+', '    <View style={styles.grid}>'],
  ['+', '      {cells.map((d) => ('],
  ['+', '        <Pressable key={d.date}'],
  ['+', '          style={[styles.cell, tone[level(d.count)]]}'],
  ['+', '          accessibilityLabel={d.label} />'],
  ['+', '      ))}'],
  ['+', '    </View>'],
  [' ', '  );'],
  [' ', '}'],
];

const PH = ['#262B31', '#1F4D33', '#2E7A4C', '#46A86A', '#7EE0A1'];
function phoneHeat(): string[] {
  let a = 7 * 9301 + 49297;
  const rnd = () => {
    a = (a * 9301 + 49297) % 233280;
    return a / 233280;
  };
  return Array.from({ length: 49 }, () => PH[Math.floor(rnd() * 5)]!);
}

const FLOW: Array<{ t: string; d: string; icon: IconName; bd: string; ibg: string; ic: string }> = [
  { t: 'Your Vigas key', d: 'One key and one balance — the same one you use for the API and Chat.', icon: 'key', bd: 'var(--vg-line)', ibg: 'rgba(154,157,250,.15)', ic: 'var(--vg-indigo)' },
  { t: 'Any model', d: 'Pick Claude, GPT, Gemini or open weights for each step — or let vigas/auto choose.', icon: 'spark', bd: 'var(--vg-line)', ibg: 'rgba(227,182,92,.15)', ic: 'var(--vg-sand)' },
  { t: 'RetroBuild agent', d: 'Plans, writes and tests the code, saving a checkpoint after every step.', icon: 'cube', bd: 'rgba(255,106,26,.4)', ibg: 'rgba(255,106,26,.15)', ic: 'var(--vg-orange)' },
  { t: 'Your app', d: 'Preview it live on a phone frame, then take the code with you.', icon: 'phone', bd: 'var(--vg-line)', ibg: 'rgba(111,207,115,.15)', ic: 'var(--vg-green)' },
];

const FEATURES = [
  { t: 'Any model, per step', d: 'Plan with a frontier model, write boilerplate with a cheap one. You choose — or auto-route.', c: 'var(--vg-orange)' },
  { t: 'Checkpoints, not chaos', d: 'Every agent step is versioned. Diff it, restore it or fork a new direction in one tap.', c: 'var(--vg-sand)' },
  { t: 'Live phone preview', d: 'Watch the app run on a device frame while the agent writes it.', c: 'var(--vg-indigo)' },
  { t: 'Costs you can see', d: 'Each step shows its token cost before it runs, billed to your Vigas credits.', c: 'var(--vg-green)' },
];

export default function RetroBuildPage() {
  const line = '1px solid var(--vg-line)';
  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: 'Home', path: '/' },
            { name: 'RetroBuild', path: '/retrobuild' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'RetroBuild',
            applicationCategory: 'DeveloperApplication',
            operatingSystem: 'Web',
            url: RETROBUILD_URL,
            description: 'An app-building agent that writes, previews and checkpoints your app — billed to your Vigas credits.',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          },
        ]}
      />
      <SiteHeader active="retrobuild" />
      <main id="main">
        <section style={{ position: 'relative', overflow: 'hidden' }}>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'linear-gradient(rgba(239,234,225,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(239,234,225,.05) 1px,transparent 1px)',
              backgroundSize: '48px 48px',
              WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%,#000 20%,transparent 75%)',
              maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%,#000 20%,transparent 75%)',
            }}
          />
          <div style={{ position: 'relative', maxWidth: 1000, margin: '0 auto', padding: '28px var(--vg-gutter) 40px', textAlign: 'center' }}>
            <Breadcrumb center items={[{ name: 'Home', href: '/' }, { name: 'RetroBuild' }]} style={{ marginBottom: 44 }} />
            <div className="lbl" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--vg-orange-text)' }}>
              <span className="led orange" />
              RetroBuild · by Vigas
            </div>
            <h1 className="sf" style={{ fontSize: 'clamp(52px,7.4vw,108px)', lineHeight: 0.94, letterSpacing: '-.034em', margin: '18px 0 20px' }}>
              Describe it.
              <br />
              <em className="hi">The agent builds it.</em>
            </h1>
            <p style={{ fontSize: 19, color: 'var(--vg-ink2)', maxWidth: 620, margin: '0 auto' }}>
              A mobile-first app builder that runs on your Vigas key. Every step the agent takes is a checkpoint you can preview, diff and restore.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 30 }}>
              <a href={RETROBUILD_URL} className="btn key" style={{ minHeight: 52, padding: '0 26px', fontSize: 15 }} target="_blank" rel="noopener">
                Open RetroBuild
                <Icon name="external" size={16} />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              <Link href="/dashboard#keys" className="btn gh" style={{ minHeight: 52, padding: '0 26px', fontSize: 15 }}>
                Connect your Vigas key
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="studio" className="wrap" style={{ paddingBottom: 24 }}>
          <h2 id="studio" className="sr-only">
            RetroBuild studio preview
          </h2>
          <figure style={{ margin: 0, background: 'var(--vg-bg2)', border: '1px solid var(--vg-line2)', borderRadius: 24, overflow: 'hidden', boxShadow: '0 50px 100px -50px rgba(0,0,0,.9)' }}>
            <figcaption className="sr-only">Example session: the agent building a habit tracker, step by step.</figcaption>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderBottom: line, background: 'var(--vg-surface)' }}>
              <span aria-hidden="true" style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--vg-strong)' }} />
                ))}
              </span>
              <span className="mn" style={{ fontSize: 13, color: 'var(--vg-ink2)' }}>
                habit-tracker <span style={{ color: 'var(--vg-ink3)' }}>/</span> main
              </span>
              <span className="pill" style={{ color: 'var(--vg-sand)' }}>
                claude-sonnet-5.5 · via Vigas
              </span>
              <span className="mn" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--vg-ink3)' }}>
                $0.42 spent
              </span>
              <span className="pill" style={{ background: 'var(--vg-orange-soft)', color: 'var(--vg-orange-text)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <span className="led orange" style={{ width: 6, height: 6 }} />
                Building v7
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px', minWidth: 0, padding: 18, borderRight: line, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ alignSelf: 'flex-end', maxWidth: '92%', background: 'var(--vg-raised)', border: line, padding: '10px 14px', borderRadius: '14px 14px 4px 14px', fontSize: 14 }}>
                  Build a habit tracker with streaks and a weekly heatmap. Dark theme, big touch targets.
                </div>
                <div style={{ fontSize: 14, color: 'var(--vg-ink2)' }}>On it. I’ll set up storage first, then the streak logic, then the heatmap.</div>
                <ol style={{ listStyle: 'none', margin: 0, border: line, borderRadius: 14, background: 'var(--vg-bg)', padding: '4px 14px' }}>
                  {STEPS.map(([k, t, meta], i) => (
                    <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '9px 0', borderTop: i ? '1px dashed rgba(239,234,225,.08)' : undefined }}>
                      {k === 'd' && (
                        <span style={{ width: 18, height: 18, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(111,207,115,.18)', color: 'var(--vg-green)', flexShrink: 0 }}>
                          <Icon name="check" size={12} label="Done" />
                        </span>
                      )}
                      {k === 'r' && <span className="spin" role="img" aria-label="Running" style={{ width: 18, height: 18, borderColor: 'var(--vg-orange)', borderTopColor: 'transparent' }} />}
                      {k === 't' && <span role="img" aria-label="Pending" style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px dashed var(--vg-ink3)', flexShrink: 0 }} />}
                      <span style={{ color: k === 't' ? 'var(--vg-ink3)' : 'var(--vg-ink)' }}>{t}</span>
                      <span className="mn" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--vg-ink3)' }}>
                        {meta}
                      </span>
                    </li>
                  ))}
                </ol>
                <div aria-hidden="true" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 14px', borderRadius: 14, background: 'var(--vg-surface)', border: '1px solid var(--vg-line2)' }}>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--vg-ink3)', fontSize: 14 }}>Ask for a change…</span>
                  <span className="btn key" style={{ minHeight: 36, width: 36, padding: 0, borderRadius: 10 }}>
                    <Icon name="send" size={16} />
                  </span>
                </div>
              </div>

              <div style={{ flex: '1.3 1 380px', minWidth: 0, borderRight: line, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: 2, padding: '8px 10px', borderBottom: line }}>
                  <span className="mn" style={{ fontSize: 12, padding: '6px 10px', borderRadius: 7, background: 'var(--vg-raised)' }}>
                    WeeklyHeatmap.tsx
                  </span>
                  <span className="mn" style={{ fontSize: 12, padding: '6px 10px', color: 'var(--vg-ink3)' }}>
                    useStreak.ts
                  </span>
                  <span className="mn" style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 4px', color: 'var(--vg-green)' }}>
                    +42 <span style={{ color: 'var(--vg-red)' }}>−6</span>
                  </span>
                </div>
                <pre className="mn" style={{ flex: 1, margin: 0, background: 'var(--vg-code)', fontSize: 12.5, lineHeight: 1.85, padding: '10px 0', overflowX: 'auto' }}>
                  {DIFF.map(([m, t], i) => (
                    <div
                      key={i}
                      style={{ display: 'flex', whiteSpace: 'pre', background: m === '+' ? 'rgba(111,207,115,.08)' : m === '-' ? 'rgba(240,122,114,.09)' : 'transparent' }}
                    >
                      <span aria-hidden="true" style={{ width: 40, flexShrink: 0, textAlign: 'right', paddingRight: 12, color: '#5A544C' }}>
                        {i + 12}
                      </span>
                      <span style={{ width: 16, flexShrink: 0, color: m === '+' ? 'var(--vg-green)' : 'var(--vg-red)' }}>{m === ' ' ? '' : m}</span>
                      <span style={{ color: m === '-' ? '#B8857F' : '#D9D3C7' }}>{t}</span>
                    </div>
                  ))}
                </pre>
              </div>

              <div style={{ flex: '1 1 300px', minWidth: 0, padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: 'var(--vg-bg)' }}>
                <span className="lbl">Live preview · Android</span>
                <div
                  aria-hidden="true"
                  style={{
                    width: 250,
                    maxWidth: '100%',
                    height: 500,
                    borderRadius: 36,
                    border: '8px solid #0B0B0A',
                    boxShadow: '0 0 0 1px #3a3631,0 30px 60px -30px rgba(0,0,0,.8)',
                    background: '#14171A',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '26px 14px 14px',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <b style={{ fontSize: 20, fontWeight: 600, color: '#F2F2F2' }}>Habits</b>
                    <span style={{ fontSize: 11, color: '#9AA3AD' }}>Week 45</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ borderRadius: 14, background: '#1E2328', padding: 10 }}>
                      <div style={{ fontSize: 11, color: '#9AA3AD' }}>Current streak</div>
                      <div style={{ fontSize: 24, fontWeight: 600, color: '#7EE0A1' }}>12 days</div>
                    </div>
                    <div style={{ borderRadius: 14, background: '#1E2328', padding: 10 }}>
                      <div style={{ fontSize: 11, color: '#9AA3AD' }}>Best</div>
                      <div style={{ fontSize: 24, fontWeight: 600, color: '#F2F2F2' }}>31</div>
                    </div>
                  </div>
                  <div style={{ borderRadius: 14, background: '#1E2328', padding: 10 }}>
                    <div style={{ fontSize: 11, color: '#9AA3AD', marginBottom: 8 }}>Last 7 weeks</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 4 }}>
                      {phoneHeat().map((c, i) => (
                        <span key={i} style={{ aspectRatio: '1', borderRadius: 3, background: c }} />
                      ))}
                    </div>
                  </div>
                  {[
                    ['Read 20 pages', '12 days', true],
                    ['Walk 8,000 steps', '5 days', true],
                    ['No phone after 11pm', '2 days', false],
                  ].map(([t, s, on]) => (
                    <div key={String(t)} style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 14, background: '#1E2328', padding: '10px 12px', minHeight: 44 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${on ? '#7EE0A1' : '#4A525B'}`, background: on ? '#7EE0A1' : 'transparent' }} />
                      <span style={{ fontSize: 13, color: '#F2F2F2', flex: 1 }}>{t}</span>
                      <span style={{ fontSize: 11, color: '#9AA3AD' }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </figure>
          <Checkpoints />
        </section>

        <section aria-labelledby="how" className="wrap" style={{ paddingTop: 72, paddingBottom: 72 }}>
          <div className="lbl">§ How it connects</div>
          <h2 id="how" className="sf" style={{ fontSize: 'clamp(36px,4vw,56px)', lineHeight: 1.02, letterSpacing: '-.022em', margin: '12px 0 30px' }}>
            One key runs <em className="hi">the whole studio.</em>
          </h2>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 10 }}>
            {FLOW.map((f, i) => (
              <li key={f.t} style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0, background: 'var(--vg-surface)', border: `1px solid ${f.bd}`, borderRadius: 18, padding: 20, height: '100%' }}>
                  <span style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: f.ibg, color: f.ic }}>
                    <Icon name={f.icon} size={20} />
                  </span>
                  <h3 className="sf" style={{ fontSize: 24, margin: '14px 0 4px', fontWeight: 400 }}>
                    {f.t}
                  </h3>
                  <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 14 }}>{f.d}</p>
                </div>
                {i < FLOW.length - 1 && <Icon name="arrow" size={22} style={{ color: 'var(--vg-orange)' }} />}
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Features" className="wrap" style={{ paddingBottom: 72, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(260px,100%),1fr))', gap: 16 }}>
          {FEATURES.map((f) => (
            <div key={f.t} style={{ borderTop: `2px solid ${f.c}`, paddingTop: 18 }}>
              <h3 className="sf" style={{ fontSize: 26, margin: '0 0 6px', fontWeight: 400 }}>
                {f.t}
              </h3>
              <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>{f.d}</p>
            </div>
          ))}
        </section>

        <section className="wrap" style={{ paddingBottom: 96 }} aria-labelledby="credits">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 24,
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'clamp(24px,3.6vw,48px)',
              borderRadius: 26,
              background: 'var(--vg-surface)',
              border: '1px solid rgba(255,106,26,.32)',
            }}
          >
            <div style={{ flex: '1 1 420px' }}>
              <h2 id="credits" className="sf" style={{ fontSize: 'clamp(34px,3.8vw,52px)', margin: 0, lineHeight: 1.02, letterSpacing: '-.02em' }}>
                No new subscription. <em className="hi">Just your credits.</em>
              </h2>
              <p style={{ margin: '12px 0 0', color: 'var(--vg-ink2)', maxWidth: 560 }}>
                RetroBuild bills per token from your Vigas balance, and shows the cost of every step before it runs.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href={RETROBUILD_URL} className="btn key" style={{ minHeight: 52, padding: '0 24px' }} target="_blank" rel="noopener">
                Start building
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              <Link href="/models" className="btn gh" style={{ minHeight: 52, padding: '0 24px' }}>
                See model prices
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
