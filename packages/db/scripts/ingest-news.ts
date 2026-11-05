/**
 * News pipeline run. Schedule it (e.g. every 30 minutes):
 *   pnpm --filter @vigas/db ingest-news
 *
 * Env:
 *   NEWS_FEEDS                 optional "Name|https://feed,Name|https://feed" — added to news_sources
 *   GATEWAY_URL                Vigas gateway (default http://localhost:8787)
 *   INTERNAL_SERVICE_TOKEN     same secret as the gateway
 *   NEWS_DRAFT_ACCOUNT_ID      account that pays for drafting; drafting is skipped when unset
 *   NEWS_DRAFT_MODEL           default "vigas/auto"
 *   NEWS_DRAFT_LIMIT           drafts per run, default 5
 */
import { adminSaveAuthor } from '../src/admin';
import { createDb } from '../src/client';
import { addNewsSource, draftArticleFromItem, listNewItems, listNewsSources, parseFeed, storeFeedItems, type DraftModel } from '../src/news-ingest';

const { db, close } = createDb(process.env.DATABASE_URL ?? 'postgres://vigas:vigas@localhost:5433/vigas', { max: 2 });

for (const pair of (process.env.NEWS_FEEDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
  const [name, url] = pair.includes('|') ? pair.split('|') : [new URL(pair).hostname, pair];
  await addNewsSource(db, name!.trim(), url!.trim());
}

const sources = await listNewsSources(db);
if (sources.length === 0) console.log('No news sources yet. Add some with NEWS_FEEDS="Name|https://example.com/feed.xml".');
for (const s of sources) {
  try {
    const res = await fetch(s.feedUrl, { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'VigasNewsBot/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parseFeed(await res.text());
    const added = await storeFeedItems(db, s.id, items);
    console.log(`${s.name}: ${items.length} items, ${added} new`);
  } catch (err) {
    console.error(`${s.name}: fetch failed — ${err instanceof Error ? err.message : err}`);
  }
}

const accountId = process.env.NEWS_DRAFT_ACCOUNT_ID;
const token = process.env.INTERNAL_SERVICE_TOKEN;
if (!accountId || !token) {
  console.log('Drafting skipped: set NEWS_DRAFT_ACCOUNT_ID and INTERNAL_SERVICE_TOKEN to write drafts.');
} else {
  const gateway = (process.env.GATEWAY_URL ?? 'http://localhost:8787').replace(/\/+$/, '');
  const modelId = process.env.NEWS_DRAFT_MODEL ?? 'vigas/auto';
  const model: DraftModel = async (system, user) => {
    const res = await fetch(`${gateway}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Vigas-Account': accountId, 'X-Vigas-Source': 'chat' },
      body: JSON.stringify({ model: modelId, max_tokens: 1200, temperature: 0.4, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      signal: AbortSignal.timeout(120_000),
    });
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message ?? `Gateway HTTP ${res.status}`);
    return json.choices?.[0]?.message?.content ?? '';
  };
  await adminSaveAuthor(db, { slug: 'vigas-newsroom', name: 'Vigas Newsroom', role: 'Newsroom (AI-assisted, editor reviewed)', color: '#FF6A1A' });
  for (const { item } of await listNewItems(db, Number(process.env.NEWS_DRAFT_LIMIT ?? 5))) {
    const r = await draftArticleFromItem(db, item.id, model, { authorSlug: 'vigas-newsroom' });
    console.log('slug' in r ? `Drafted: ${r.slug}` : `Draft failed for "${item.title}": ${r.error}`);
  }
}
await close();
