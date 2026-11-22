'use client';

import { useState, type CSSProperties } from 'react';
import type { ModelListItem } from '@vigas/core';
import { API_BASE_URL } from '@/lib/client/supabase-config';
import { CopyButton } from '../copy-button';
import { Icon } from '../ui';

type ToolTab = 'curl' | 'python' | 'node' | 'cursor' | 'cline' | 'claudecode';

const TOOL_TABS: Array<{ id: ToolTab; label: string }> = [
  { id: 'curl', label: 'cURL' },
  { id: 'python', label: 'Python' },
  { id: 'node', label: 'Node / TS' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'cline', label: 'Cline / Roo' },
  { id: 'claudecode', label: 'Claude Code' },
];

export function DashboardConnect({
  models,
  selectedModel,
  onSelectModel,
  apiKeyPreview,
  lang = 'en',
  onGoToKeys,
}: {
  models: ModelListItem[];
  selectedModel: string;
  onSelectModel: (id: string) => void;
  apiKeyPreview?: string | null;
  lang?: 'en' | 'fa';
  onGoToKeys: () => void;
}) {
  const isFa = lang === 'fa';
  const [tab, setTab] = useState<ToolTab>('curl');
  const keyPlaceholder = apiKeyPreview || 'vg_YOUR_API_KEY';
  const model = selectedModel || 'vigas/auto';

  const snippets: Record<ToolTab, { title: string; subtitle: string; code: string }> = {
    curl: {
      title: isFa ? 'درخواست مستقیم HTTP / cURL' : 'Direct HTTP / cURL',
      subtitle: isFa ? 'تست سریع در ترمینال با استاندارد OpenAI Chat Completions' : 'Quick terminal test using the OpenAI-compatible Chat Completions endpoint',
      code: `curl ${API_BASE_URL}/chat/completions \\\n  -H "Authorization: Bearer ${keyPlaceholder}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "model": "${model}",\n    "messages": [\n      {"role": "user", "content": "Hello from Vigas API!"}\n    ]\n  }'`,
    },
    python: {
      title: isFa ? 'پایتون با SDK رسمی OpenAI' : 'Python (OpenAI SDK)',
      subtitle: isFa ? 'بدون نیاز به کتابخانه اختصاصی — فقط base_url را روی ویگاس بگذارید' : 'Drop-in replacement — just point base_url at Vigas',
      code: `from openai import OpenAI\n\nclient = OpenAI(\n    base_url="${API_BASE_URL}",\n    api_key="${keyPlaceholder}",\n)\n\nresp = client.chat.completions.create(\n    model="${model}",\n    messages=[{"role": "user", "content": "Explain how Vigas routing works."}],\n)\nprint(resp.choices[0].message.content)`,
    },
    node: {
      title: isFa ? 'Node.js / TypeScript با SDK رسمی OpenAI' : 'Node.js / TypeScript (OpenAI SDK)',
      subtitle: isFa ? 'مناسب برای Next.js، ربات‌های تلگرام و سرویس‌های بک‌اند' : 'Ideal for Next.js, Telegram bots, and backend microservices',
      code: `import OpenAI from "openai";\n\nconst client = new OpenAI({\n  baseURL: "${API_BASE_URL}",\n  apiKey: process.env.VIGAS_API_KEY || "${keyPlaceholder}",\n});\n\nconst resp = await client.chat.completions.create({\n  model: "${model}",\n  messages: [{ role: "user", content: "Hello from Node.js!" }],\n});\nconsole.log(resp.choices[0]?.message?.content);`,
    },
    cursor: {
      title: isFa ? 'اتصال به Cursor IDE در ۳۰ ثانیه' : 'Connect Cursor IDE in 30 seconds',
      subtitle: isFa ? 'Cursor Settings → Models → OpenAI API Key → Override OpenAI Base URL' : 'Cursor Settings → Models → OpenAI API Key → Override OpenAI Base URL',
      code: `# 1. Open Cursor Settings -> Models\n# 2. Paste your Vigas key in "OpenAI API Key":\n${keyPlaceholder}\n\n# 3. Enable "Override OpenAI Base URL" and paste:\n${API_BASE_URL}\n\n# 4. Add custom model ID:\n${model}`,
    },
    cline: {
      title: isFa ? 'اتصال به Cline / Roo Code (VS Code)' : 'Connect Cline / Roo Code (VS Code)',
      subtitle: isFa ? 'API Provider را روی OpenAI Compatible بگذارید و مقادیر زیر را وارد کنید' : 'Choose "OpenAI Compatible" as API Provider and enter these values',
      code: `{\n  "apiProvider": "openai",\n  "openAiBaseUrl": "${API_BASE_URL}",\n  "openAiApiKey": "${keyPlaceholder}",\n  "openAiModelId": "${model}"\n}`,
    },
    claudecode: {
      title: isFa ? 'اتصال به Claude Code / OpenCode / Aider' : 'Connect Claude Code / OpenCode / Aider',
      subtitle: isFa ? 'متغیرهای محیطی زیر را پیش از اجرای CLI تنظیم کنید' : 'Export these environment variables before starting your coding CLI',
      code: `export OPENAI_BASE_URL="${API_BASE_URL}"\nexport OPENAI_API_KEY="${keyPlaceholder}"\nexport VIGAS_MODEL="${model}"\n\n# Example with Aider:\naider --openai-api-base "$OPENAI_BASE_URL" --openai-api-key "$OPENAI_API_KEY" --model "openai/${model}"`,
    },
  };

  const active = snippets[tab];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section className="card" style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div className="lbl">{isFa ? 'اتصال سریع ابزارها و کدها' : '30-second API integration'}</div>
            <h2 className="sf" style={{ fontSize: isFa ? 22 : 28, margin: '6px 0 0', fontWeight: isFa ? 700 : 400 }}>
              {isFa ? 'اتصال Vigas API به کد، ربات و IDE شما' : 'Plug Vigas API into your apps & IDEs'}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span dir="ltr" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 12px', borderRadius: 10, background: 'var(--vg-bg2)', border: '1px solid var(--vg-line2)' }}>
              <code className="mn" style={{ fontSize: 12.5, color: 'var(--vg-ink)' }}>
                {API_BASE_URL}
              </code>
              <CopyButton text={API_BASE_URL} label={isFa ? 'کپی Base URL' : 'Copy Base URL'} copiedText={isFa ? 'کپی شد' : 'Copied'} style={{ minHeight: 28, padding: '0 8px', fontSize: 11.5, borderRadius: 7 }}>
                {isFa ? 'کپی' : 'Copy'}
              </CopyButton>
            </span>
          </div>
        </div>

        {/* Model selector + key status */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 18 }}>
          <label style={{ flex: '1 1 260px', minWidth: 0 }}>
            <span style={fieldLabel}>{isFa ? 'مدل مورد نظر در کد' : 'Model ID in snippet'}</span>
            <select
              value={model}
              onChange={(e) => onSelectModel(e.target.value)}
              className="input"
              dir="ltr"
              style={{ height: 44, fontFamily: 'var(--vg-font-mono)', fontSize: 13 }}
            >
              <option value="vigas/auto">vigas/auto — Smart Auto Router</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} ({m.name})
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn gh" onClick={onGoToKeys} style={{ minHeight: 44 }}>
              <Icon name="key" size={15} />
              {apiKeyPreview
                ? isFa
                  ? 'کلید جدید در کد قرار گرفت'
                  : 'Using your new key'
                : isFa
                  ? 'ساخت یا مدیریت کلید API'
                  : 'Create / manage API keys'}
            </button>
          </div>
        </div>

        {/* Tool selector tabs */}
        <div role="tablist" aria-label={isFa ? 'زبان یا ابزار' : 'Language or tool'} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {TOOL_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className="chip"
              onClick={() => setTab(t.id)}
              style={
                tab === t.id
                  ? {
                      background: 'var(--vg-orange-soft)',
                      color: 'var(--vg-orange-text)',
                      borderColor: 'var(--vg-orange-edge)',
                    }
                  : undefined
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 10 }}>
          <b style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{active.title}</b>
          <span style={{ fontSize: 13, color: 'var(--vg-ink3)' }}>{active.subtitle}</span>
        </div>

        <div dir="ltr" style={{ position: 'relative' }}>
          <pre
            className="mn"
            style={{
              margin: 0,
              padding: '18px 20px',
              paddingRight: 76,
              borderRadius: 14,
              background: 'var(--vg-code)',
              border: '1px solid var(--vg-line2)',
              color: 'var(--vg-code-ink)',
              fontSize: 13,
              lineHeight: 1.7,
              overflowX: 'auto',
              textAlign: 'left',
            }}
          >
            {active.code}
          </pre>
          <CopyButton
            text={active.code}
            label={isFa ? 'کپی کد' : 'Copy snippet'}
            copiedText={isFa ? 'کپی شد' : 'Copied'}
            style={{ position: 'absolute', top: 10, right: 10 }}
          >
            {isFa ? 'کپی' : 'Copy'}
          </CopyButton>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14, fontSize: 13, color: 'var(--vg-ink2)' }}>
          {(isFa
            ? ['استاندارد ۱۰۰٪ OpenAI Chat Completions', 'پشتیبانی کامل از Streaming و Function Calling', 'Failover خودکار هنگام اختلال ارائه‌دهنده']
            : ['100% OpenAI Chat Completions compatible', 'Full Streaming & Tool / Function Calling', 'Automatic multi-provider failover']
          ).map((item) => (
            <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Icon name="check" size={15} style={{ color: 'var(--vg-green)' }} />
              {item}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

const card: CSSProperties = { minWidth: 0, borderRadius: 22, padding: 24 };
const fieldLabel: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 500, marginBottom: 7, color: 'var(--vg-ink2)' };
