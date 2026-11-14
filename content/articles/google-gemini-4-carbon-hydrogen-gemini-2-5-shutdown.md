---
title: "Google cuts Gemini 4 Carbon prices before Gemini 2.5 sunset"
slug: "google-gemini-4-carbon-hydrogen-gemini-2-5-shutdown"
dek: "Gemini 4 Carbon hits #3 overall at $2/$10 intro pricing and Gemini 4 Hydrogen goes GA as Google retires Gemini 2.5 Pro and Flash on Dec 1."
category: "Models"
lang: "en"
flag: null
authorSlug: "kian-rahimi"
status: "published"
publishedAt: "2026-11-14T07:30:00Z"
cover: {"big":"-20%","caption":"CARBON INTRO PRICE","color":"#5DB7B0"}
mentionedModelIds: ["google/gemini-4-carbon","google/gemini-4-hydrogen","google/gemini-4-argon"]
pullQuote: {"text":"Retiring last year’s workhorse models forces every migration team to measure latency and dollar-per-task together, not separately.","cite":"Vigas Infrastructure Brief"}
faq: [{"q":"When do Gemini 2.5 Pro and Gemini 2.5 Flash shut down?","a":"Google officially sunsets legacy Gemini 2.5 Pro and Gemini 2.5 Flash endpoints on December 1, 2026, prompting developers to upgrade to Gemini 4 Carbon, Hydrogen, or Argon."},{"q":"How much does Gemini 4 Carbon cost right now?","a":"Introductory API pricing through November 30, 2026 is $2.00 per 1M input tokens and $10.00 per 1M output tokens, moving to standard $4/$20 tiers afterward."},{"q":"Where do Gemini 4 Carbon and Hydrogen rank on Vigas Arena?","a":"Gemini 4 Carbon holds #3 Overall (16.90% win share) and #1 in pure Text, while Gemini 4 Hydrogen ranks #5 Overall at 14.80% win share."}]
---

Google is tightening its developer migration timeline with aggressive pricing ahead of next month’s legacy endpoint cutoff: **Gemini 4 Carbon** now sits #3 on [the overall leaderboard](/leaderboard) while promotional **$2 / $10** API rates remain locked through November 30 — one day before `gemini-2.5-pro` and `gemini-2.5-flash` shut down permanently on December 1.

At the same time, **Gemini 4 Hydrogen** (`google/gemini-4-hydrogen`) reached general availability on November 12 at **$0.50 input / $2.50 output per million tokens**, giving enterprise teams a clear 1M-context replacement ladder alongside ultra-fast `google/gemini-4-argon`.

## Where the Gemini 4 lineup lands on quality and cost

Across more than 378 million evaluated sessions on Arena and [Vigas model benchmarks](/models), Google’s fourth-generation family splits neatly by workload:

- **Gemini 4 Carbon (High):** Ranks **#3 Overall** at **16.90% win share** ($1.42 estimated cost per completed task) and claims **#1 in Text** ahead of competing proprietary and open-weight releases.
- **Gemini 4 Hydrogen (High):** Debuts directly at **#5 Overall** (**14.80% win share**, $0.92 per task), combining strong reasoning accuracy with 4× lower token pricing than standard Carbon rates.
- **Gemini 4 Argon:** Sits cleanly at **$0.30 / $2.50 per 1M tokens** with 1M context for high-volume multimodal extraction and Flash-era legacy replacements.

## Avoiding breaking migrations before December 1

Teams still hitting `gemini-2.5-pro` or `gemini-2.5-flash` in production face a strict **December 1 shutdown deadline** across Vertex AI and Gemini API keys. Promotional pricing on Carbon doubles from **$2/$10** back to **$4/$20** after November 30, making early cutovers twice as valuable: run staging evals during the discount window before standard billing resumes.

Engineers upgrading apps via [the Vigas gateway](/models) or compatible [research and coding tools](/tools/category/research) should audit three areas during switchover: structured JSON output schemas, thinking-budget latency caps, and automatic fallback chains (`gemini-4-hydrogen` -> `gemini-4-argon`) so a single provider deprecation never breaks production API traffic again.
