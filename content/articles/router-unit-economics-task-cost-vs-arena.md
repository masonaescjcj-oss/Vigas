---
title: "Cost per task vs. Arena win share: 2026 router data"
slug: "router-unit-economics-task-cost-vs-arena"
dek: "Live Vigas router telemetry compares cost per completed agent task against Arena win share across Claude Fable 5.2, Gemini 4 Carbon, and DeepSeek Flash."
category: "Analysis"
lang: "en"
flag: "Analysis"
authorSlug: "leila-karimi"
status: "published"
publishedAt: "2026-11-18T11:00:00Z"
cover: {"big":"15×","caption":"TASK COST SPREAD","color":"#E3B65C"}
image: "/news/token-economics.webp"
mentionedModelIds: ["anthropic/claude-fable-5.2","google/gemini-4-carbon","deepseek/v4.1-flash"]
pullQuote: {"text":"Published per-million token rates hide the real bill: verbose reasoning loops change cost per finished PR by an order of magnitude.","cite":"Vigas Data Desk"}
faq: [{"q":"Why does cost per completed task differ from raw token pricing?","a":"Reasoning depth, retry counts, and verbose diffs change total generated output tokens. Measuring cost per completed task captures how many tokens a model actually spends before tests pass."},{"q":"Which top models lead the cost-to-quality curve on Vigas?","a":"Gemini 4 Carbon holds #3 Overall at 16.90% win share for $1.42 per task, while GPT-6.1 Terra ($0.89/task) and DeepSeek V4.1 Flash ($0.12/task) dominate high-volume triage steps."},{"q":"How does dual-model routing lower monthly API spend?","a":"Sending codebase search, formatting, and lint checks to Flash-class tiers while reserving Claude Fable 5.2 or Opus 5.5 for final architectural edits routinely cuts spend by 60–75%."}]
---

Staring solely at headline input rates per million tokens no longer tells engineering teams what an AI agent costs in production. Across **378.7 million evaluated sessions** tracked on [the Vigas AI leaderboard](/leaderboard), the gap in **average cost per completed task** spans more than **65×** between budget routing workhorses and frontier reasoning tiers — even when token prices appear close on paper.

For teams wiring editors or backend workflows into [our unified API pricing matrix](/models), the decisive KPI is **task cost divided by Arena win share**: how much money it takes to finish a bug fix or research synthesis reliably on the first pass.

## What live router telemetry shows

Comparing top Overall and Coding models side by side reveals three clear operating bands:

- **Frontier architectural precision:** `anthropic/claude-fable-5.2` leads both Overall (**30.48% win share**, Bradley-Terry score **1548**) and Coding (**31.45% win share**) at **$1.80 input / $9.00 output** per million tokens, averaging **$8.02 per completed deep task** due to thorough multi-file exploration.
- **High-efficiency mid-frontier sweet spot:** `google/gemini-4-carbon` scores **16.90% Overall win share (#3)** at **$1.42 per completed task** thanks to its **$2.00 / $10.00** rate (down 20% in the past 24 hours), while `openai/gpt-6.1-terra` reaches **11.96% win share** at **$0.89 per task**.
- **High-volume discovery & retry floor:** `deepseek/v4.1-flash` lists at **$0.07 input / $0.28 output** per million tokens (down 22% over 24 hours) and averages just **$0.12 per completed task** — delivering nearly 67 completed triage runs for the price of a single frontier session.

## Why two-tier routing beats single-model lock-in

Most autonomous coding sessions spend over two-thirds of context tokens reading files, parsing stack traces, and running static checks rather than writing final patches. Locking an entire pipeline to one expensive flagship inflates latency and token spend without lifting merge quality on routine steps.

With a single OpenAI-compatible key from [your Vigas account](/signup), engineering teams can inspect [Coding leaderboard win shares](/leaderboard/coding) and pair `vigas/auto` or explicit tier rules: keep `deepseek/v4.1-flash` or `google/gemini-4-argon` on repo discovery, escalate tricky state bugs to `google/gemini-4-carbon` or `anthropic/claude-fable-5.2`, and audit every cent in real time without changing SDK code.
