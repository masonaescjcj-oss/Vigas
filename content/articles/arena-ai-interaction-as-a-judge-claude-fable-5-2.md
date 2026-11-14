---
title: "Arena’s interaction judge tests what agents actually finish"
slug: "arena-ai-interaction-as-a-judge-claude-fable-5-2"
dek: "Arena open-sources ArenaWebdevPreferences and self-repair evals showing 20-point gains as Claude Fable 5.2 holds #1 at 30.48% win share."
category: "Models"
lang: "en"
flag: "Breaking"
authorSlug: "sara-moradi"
status: "published"
publishedAt: "2026-11-14T10:30:00Z"
cover: {"big":"30.5%","caption":"TOP WIN SHARE","color":"#FF6A1A"}
image: "/news/arena-eval.webp"
mentionedModelIds: ["anthropic/claude-fable-5.2","anthropic/claude-opus-5.5","google/gemini-4-carbon"]
pullQuote: {"text":"Evaluating single screenshots misses half the failure modes in AI apps. Real users judge what happens when they actually click around.","cite":"Vigas Benchmark Note, Nov 2026"}
faq: [{"q":"What did Arena AI open-source in its interaction-as-a-judge release?","a":"Arena released ArenaWebdevPreferences (pairwise human preference logs of live app interactions) and ArenaWebdevCorrectness (189 built apps paired with 362 behavioral requirements)."},{"q":"Which model currently leads the Arena and Vigas overall leaderboard?","a":"Anthropic Claude Fable 5.2 ranks #1 overall with a 30.48% win share (1548 rating) and leads WebDev at 1838 across more than 378 million ranked sessions."},{"q":"How much did self-repair interaction testing improve app pass rates?","a":"Giving coding agents browser interaction feedback before final scoring pushed functional requirement pass rates from 55.4% up to 75.5% in Arena benchmarks."}]
---

Static screenshot graders are no longer enough to tell which AI model builds working software. Arena published two open datasets alongside new browser-level evaluation results showing that testing live user interactions pushes agent pass rates up by 20 percentage points — just as **Claude Fable 5.2** cements its #1 lead on [the AI leaderboard](/leaderboard).

For months, web-app benchmarks graded generated interfaces by inspecting DOM snapshots or rendered PNGs. While visually neat, those checks missed broken checkout flows, dead state handlers, and modals that refused to close.

## Inside ArenaWebdevPreferences and Correctness

To close that gap, Arena released **ArenaWebdevPreferences** (recorded side-by-side human interactions inside deployed WebDev battles) and **ArenaWebdevCorrectness**, a benchmark spanning 189 real web apps and 362 explicit behavioral requirements verified by autonomous browser judges.

Key findings from the technical report and live leaderboard telemetry include:

- **Self-repair jumps 20.1 points:** Allowing coding agents to inspect runtime browser failures through interaction feedback boosted requirement pass rates from **55.4% to 75.5%**.
- **RL on live interaction beats offline reward:** Training Qwen-3.5-9B with an interaction-trained reward model added **+50 Elo** compared with standard static preference baselines.
- **Claude Fable 5.2 dominates WebDev and Overall:** On [Vigas Arena rankings](/leaderboard/webdev), `anthropic/claude-fable-5.2` leads Overall at **30.48% win share** and WebDev at **1838 rating**, ahead of Claude Opus 5.5 (19.51% overall) and Gemini 4 Carbon (16.90% overall).

## Why token price and eval fidelity now converge

High leaderboard ratings increasingly depend on multi-turn execution loops — build, click, inspect console errors, patch — rather than one-shot prompt luck. That shifts unit economics directly onto mid-cost models with strong agentic tool use.

At **$1.80 per 1M input tokens** and **$9.00 per 1M output tokens** on [the Vigas model router](/models), Claude Fable 5.2 undercuts flagship Opus 5.5 ($15 / $75) by more than 8× while still beating it on both Overall and Coding win shares. Builders running continuous browser-verification loops can also pair Fable 5.2 with high-speed fallbacks like `google/gemini-4-carbon` without rewriting client code.

## What engineering teams should change now

If your team ships coding agents or generative UI apps from our [AI tools directory](/tools/category/coding), move evaluation earlier into headless Playwright or Chromium smoke runs instead of gating releases purely on LLM text diffs. Capturing click paths, runtime exceptions, and state persistence closes the exact failure gap exposed by Arena’s new open benchmarks.
