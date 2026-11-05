'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { CopyButton } from './copy-button';
import { Icon } from './ui';

const K = ({ children }: { children: ReactNode }) => <span style={{ color: '#FF8A4C' }}>{children}</span>;
const S = ({ children }: { children: ReactNode }) => <span style={{ color: '#A6D49F' }}>{children}</span>;
const F = ({ children }: { children: ReactNode }) => <span style={{ color: '#A5A8FF' }}>{children}</span>;
const C = ({ children }: { children: ReactNode }) => <span style={{ color: '#7E776E' }}>{children}</span>;

export function QuickstartTabs({ baseUrl, exampleModel }: { baseUrl: string; exampleModel: string }) {
  const id = useId();
  const [tab, setTab] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const snippets: Array<{ label: string; text: string; code: ReactNode }> = [
    {
      label: 'Python',
      text: `from openai import OpenAI\n\nclient = OpenAI(\n    base_url="${baseUrl}",\n    api_key="sk-vg-v1-…",\n)\nresp = client.chat.completions.create(\n    model="${exampleModel}",  # or "vigas/auto"\n    messages=[{"role": "user", "content": "Hello"}],\n)`,
      code: (
        <>
          <K>from</K> openai <K>import</K> OpenAI{'\n\n'}client = <F>OpenAI</F>({'\n    '}base_url=<S>&quot;{baseUrl}&quot;</S>,{'\n    '}api_key=<S>&quot;sk-vg-v1-…&quot;</S>,{'\n'}){'\n'}resp = client.chat.completions.<F>create</F>({'\n    '}model=<S>&quot;{exampleModel}&quot;</S>,{'  '}
          <C># or &quot;vigas/auto&quot;</C>
          {'\n    '}messages=[{'{'}
          <S>&quot;role&quot;</S>: <S>&quot;user&quot;</S>, <S>&quot;content&quot;</S>: <S>&quot;Hello&quot;</S>
          {'}'}],{'\n'})
        </>
      ),
    },
    {
      label: 'TypeScript',
      text: `import OpenAI from "openai";\n\nconst client = new OpenAI({\n  baseURL: "${baseUrl}",\n  apiKey: process.env.VIGAS_API_KEY,\n});\nconst resp = await client.chat.completions.create({\n  model: "vigas/auto",\n  messages: [{ role: "user", content: "Hello" }],\n});`,
      code: (
        <>
          <K>import</K> OpenAI <K>from</K> <S>&quot;openai&quot;</S>;{'\n\n'}
          <K>const</K> client = <K>new</K> <F>OpenAI</F>({'{'}
          {'\n  '}baseURL: <S>&quot;{baseUrl}&quot;</S>,{'\n  '}apiKey: process.env.VIGAS_API_KEY,{'\n'}
          {'}'});{'\n'}
          <K>const</K> resp = <K>await</K> client.chat.completions.<F>create</F>({'{'}
          {'\n  '}model: <S>&quot;vigas/auto&quot;</S>,{'\n  '}messages: [{'{'} role: <S>&quot;user&quot;</S>, content: <S>&quot;Hello&quot;</S> {'}'}],{'\n'}
          {'}'});
        </>
      ),
    },
    {
      label: 'cURL',
      text: `curl ${baseUrl}/chat/completions \\\n  -H "Authorization: Bearer $VIGAS_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "vigas/auto", "messages": [{"role": "user", "content": "Hello"}]}'`,
      code: (
        <>
          <F>curl</F> {baseUrl}/chat/completions \{'\n  '}-H <S>&quot;Authorization: Bearer $VIGAS_API_KEY&quot;</S> \{'\n  '}-H{' '}
          <S>&quot;Content-Type: application/json&quot;</S> \{'\n  '}-d{' '}
          <S>&apos;{'{'}&quot;model&quot;: &quot;vigas/auto&quot;, &quot;messages&quot;: [{'{'}&quot;role&quot;: &quot;user&quot;, &quot;content&quot;: &quot;Hello&quot;{'}'}]{'}'}&apos;</S>
        </>
      ),
    },
  ];

  const focusTab = (i: number) => {
    const n = (i + snippets.length) % snippets.length;
    setTab(n);
    refs.current[n]?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="lbl">§ Quickstart</div>
          <h2 id="quickstart-title" className="sf" style={{ fontSize: 34, margin: '6px 0 0', letterSpacing: '-.015em', lineHeight: 1.05 }}>
            Live in <em className="hi">30 seconds.</em>
          </h2>
        </div>
        <div role="tablist" aria-label="Language" className="seg">
          {snippets.map((s, i) => (
            <button
              key={s.label}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${i}`}
              aria-selected={tab === i}
              aria-controls={`${id}-panel`}
              tabIndex={tab === i ? 0 : -1}
              onClick={() => setTab(i)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') focusTab(i + 1);
                if (e.key === 'ArrowLeft') focusTab(i - 1);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`} style={{ position: 'relative' }}>
        <pre
          className="mn"
          tabIndex={0}
          style={{
            margin: 0,
            background: 'var(--vg-code)',
            border: '1px solid var(--vg-line)',
            borderRadius: 14,
            padding: '20px 22px',
            paddingRight: 56,
            fontSize: 13.5,
            lineHeight: 1.75,
            color: '#D9D3C7',
            overflowX: 'auto',
          }}
        >
          {snippets[tab]!.code}
        </pre>
        <CopyButton text={snippets[tab]!.text} label={`Copy ${snippets[tab]!.label} example`} style={{ position: 'absolute', top: 10, right: 10 }} />
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14, color: 'var(--vg-ink2)' }}>
        {['Works with the OpenAI SDKs', 'Streaming & tool calls', 'Same key in Chat & RetroBuild'].map((t) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name="check" size={16} style={{ color: 'var(--vg-green)' }} />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
