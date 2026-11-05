import type { ReactNode } from 'react';
import { SiteHeader } from './site-header';
import { Breadcrumb, Icon } from './ui';

/** Shared layout for the sign-in and sign-up pages. */
export function AuthPage({ title, intro, crumb, children }: { title: ReactNode; intro: string; crumb: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader ticker={false} />
      <main id="main" className="wrap" style={{ paddingBottom: 96 }}>
        <Breadcrumb items={[{ name: 'Home', href: '/' }, { name: crumb }]} style={{ paddingTop: 28 }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 56, alignItems: 'center', paddingTop: 40 }}>
          <div style={{ flex: '1 1 420px', minWidth: 0 }}>
            <div className="lbl" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span className="led" />
              One account · one balance
            </div>
            <h1 className="sf" style={{ fontSize: 'clamp(44px,5.4vw,76px)', lineHeight: 0.98, letterSpacing: '-.03em', margin: '16px 0' }}>
              {title}
            </h1>
            <p style={{ fontSize: 18, color: 'var(--vg-ink2)', maxWidth: 520, margin: 0 }}>{intro}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '28px 0 0', display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--vg-ink2)' }}>
              {[
                'One OpenAI-compatible key for every model',
                'Vigas Chat and Arena with any model',
                'Zero markup on your first $5 of credits',
                'The same balance in RetroBuild and the Android app',
              ].map((t) => (
                <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="check" size={16} style={{ color: 'var(--vg-green)' }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="card" style={{ flex: '1 1 380px', minWidth: 0, maxWidth: 480, borderRadius: 22, padding: 'clamp(20px,3vw,32px)' }}>
            {children}
          </div>
        </div>
      </main>
    </>
  );
}
