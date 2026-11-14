import {
  formatUsd,
  NEWS_CATEGORIES,
  TOOL_CATEGORIES,
  type FaqItem,
  type LeaderboardCategory,
  type LeaderboardEntry,
  type NewsCategory,
  type ToolCategory,
  type ToolItem,
} from '@vigas/core';

export interface ToolCategorySeo {
  category: ToolCategory;
  slug: string;
  label: string;
  title: string;
  heading: string;
  accent: string;
  description: string;
  intro: string;
  relatedLeaderboard: LeaderboardCategory;
  relatedNewsCategory: NewsCategory;
  faqs: FaqItem[];
}

export const TOOL_CATEGORY_SEO: Record<ToolCategory, ToolCategorySeo> = {
  Agents: {
    category: 'Agents',
    slug: 'agents',
    label: 'AI agent builders & autonomous tools',
    title: 'Best AI Agent Tools & Autonomous Coding Agents (2026)',
    heading: 'Best AI agent tools,',
    accent: 'ranked by builders.',
    description:
      'Compare the best autonomous AI agents, app builders, and workflow orchestrators ranked by builder upvotes and real ratings on Vigas.',
    intro:
      'Autonomous AI agents plan multi-step edits, call external APIs, and verify results before shipping. Tools in this shortlist are ranked by real builder upvotes and verified API compatibility.',
    relatedLeaderboard: 'overall',
    relatedNewsCategory: 'Agents',
    faqs: [
      {
        q: 'Which AI agent tools work with a single Vigas API key?',
        a: 'Tools badged with "Vigas API" route directly through api.vigas.ai/v1 so you can swap underlying frontier models without managing multiple vendor keys.',
      },
      {
        q: 'How does Vigas rank AI agent tools?',
        a: 'Listings combine verified builder upvotes, editor reviews, pricing transparency, and whether the tool supports open multi-model routing.',
      },
    ],
  },
  Coding: {
    category: 'Coding',
    slug: 'coding',
    label: 'AI coding assistants & editors',
    title: 'Best AI Coding Tools, IDEs & Code Generators (2026)',
    heading: 'Best AI coding tools,',
    accent: 'tested in production.',
    description:
      'The top AI code editors, terminal coding agents, and UI generators ranked by developers on Vigas — compare pricing, ratings, and model support.',
    intro:
      'From full AI-first IDEs to UI generators and code-review assistants, these coding tools help teams write, refactor, and ship software faster while controlling token spend.',
    relatedLeaderboard: 'coding',
    relatedNewsCategory: 'Models',
    faqs: [
      {
        q: 'Which coding tools support frontier models via Vigas?',
        a: 'Any editor or CLI compatible with the OpenAI chat completions endpoint can point at https://api.vigas.ai/v1 to switch between Claude, GPT, Gemini, and DeepSeek.',
      },
      {
        q: 'Are there free AI coding tools in this category?',
        a: 'Yes — look for the Free or Freemium pricing pill or filter the free AI tools collection to find zero-cost tiers for personal projects.',
      },
    ],
  },
  Research: {
    category: 'Research',
    slug: 'research',
    label: 'AI research assistants & search engines',
    title: 'Best AI Research Assistants & Cited Answer Engines (2026)',
    heading: 'Best AI research tools,',
    accent: 'with verifiable citations.',
    description:
      'Compare the best AI answer engines, PDF synthesis workspaces, and scientific literature assistants ranked by researchers and builders on Vigas.',
    intro:
      'Research assistants pair live web retrieval or private document indexes with long-context reasoning models so every claim is backed by checkable sources.',
    relatedLeaderboard: 'text',
    relatedNewsCategory: 'Analysis',
    faqs: [
      {
        q: 'What makes a great AI research tool?',
        a: 'Reliable inline citations, faithful extraction from long PDFs and papers, and predictable cost per deep-research run.',
      },
      {
        q: 'Can I build my own cited research assistant with Vigas?',
        a: 'Yes — check the Text and Overall leaderboards alongside 1M+ context models in the gateway to pick the best model for long documents.',
      },
    ],
  },
  Image: {
    category: 'Image',
    slug: 'image',
    label: 'AI image generators & design studios',
    title: 'Best AI Image Generators & Visual Design Tools (2026)',
    heading: 'Best AI image generators,',
    accent: 'ranked by creators.',
    description:
      'Explore top AI image generators, product-shot studios, and typography-faithful art models curated and upvoted by builders on Vigas.',
    intro:
      'Modern image tools balance photorealism, legible text rendering, prompt adherence, and predictable per-render pricing for production design workflows.',
    relatedLeaderboard: 'image-edit',
    relatedNewsCategory: 'Tools',
    faqs: [
      {
        q: 'How are AI image generators ranked on Vigas?',
        a: 'Rankings reflect builder upvotes alongside live quality signals tracked in the Image Edit leaderboard category.',
      },
      {
        q: 'Which image tools offer a free tier?',
        a: 'Tools labeled Free or Freemium let you test generations without upfront payment; see our Free AI Tools collection for a complete shortlist.',
      },
    ],
  },
  Video: {
    category: 'Video',
    slug: 'video',
    label: 'AI video generators & editors',
    title: 'Best AI Video Generators & Film Editing Tools (2026)',
    heading: 'Best AI video tools,',
    accent: 'frame-by-frame control.',
    description:
      'Compare leading AI video generation, storyboarding, and browser-based video editing platforms ranked by creators and builders on Vigas.',
    intro:
      'Video generators turn text prompts, keyframes, and motion paths into consistent shots with lip-sync, camera control, and timeline editing.',
    relatedLeaderboard: 'vision',
    relatedNewsCategory: 'Hardware',
    faqs: [
      {
        q: 'What should teams compare before adopting an AI video tool?',
        a: 'Compare character consistency across cuts, export resolution, generation latency, and per-second credit pricing.',
      },
      {
        q: 'Are any AI video tools free to try?',
        a: 'Most Freemium video platforms provide starter credits for watermarked drafts before requiring a monthly seat or usage top-up.',
      },
    ],
  },
  Audio: {
    category: 'Audio',
    slug: 'audio',
    label: 'AI voice synthesis, music & speech tools',
    title: 'Best AI Voice, Speech & Music Generators (2026)',
    heading: 'Best AI voice & music tools,',
    accent: 'studio-grade sound.',
    description:
      'Discover top AI voice cloning, low-latency conversational speech agents, dubbing studios, and AI music generators ranked on Vigas.',
    intro:
      'Voice and music platforms deliver natural prosody, multilingual dubbing, and sub-300ms conversational speech agents suitable for real-time apps.',
    relatedLeaderboard: 'aligned',
    relatedNewsCategory: 'Tools',
    faqs: [
      {
        q: 'Which AI audio tools support real-time voice agents?',
        a: 'Look for platforms streaming low-latency WebRTC or WebSocket audio alongside turn-taking detection.',
      },
      {
        q: 'Can startups commercialize generated voice and music?',
        a: 'Always verify each tool’s commercial licensing tier—most paid and freemium tiers grant full commercial rights on published outputs.',
      },
    ],
  },
  Productivity: {
    category: 'Productivity',
    slug: 'productivity',
    label: 'AI meeting notes, decks & workflow tools',
    title: 'Best AI Productivity Tools for Teams & Operators (2026)',
    heading: 'Best AI productivity tools,',
    accent: 'without the busywork.',
    description:
      'Compare the best AI tools for meeting notes, presentations, spreadsheets, and everyday knowledge work ranked by builders on Vigas.',
    intro:
      'High-signal productivity tools stay out of your way—capturing context from meetings, turning raw briefs into presentations, and automating routine follow-ups.',
    relatedLeaderboard: 'work',
    relatedNewsCategory: 'Funding',
    faqs: [
      {
        q: 'How are AI productivity tools evaluated on Vigas?',
        a: 'We prioritize tools that integrate cleanly into existing team habits and pair them with our Work leaderboard benchmarks.',
      },
      {
        q: 'How do Vigas API tools differ from standalone SaaS apps?',
        a: 'Tools powered by Vigas let teams choose their preferred underlying model and pay pass-through per-token pricing instead of fixed markups.',
      },
    ],
  },
};

export type ToolCollectionSlug = 'free' | 'vigas-api' | 'new';

export interface ToolCollectionSeo {
  slug: ToolCollectionSlug;
  name: string;
  title: string;
  heading: string;
  accent: string;
  description: string;
  intro: string;
  filter: (t: ToolItem) => boolean;
  faqs: FaqItem[];
}

export const TOOL_COLLECTIONS: Record<ToolCollectionSlug, ToolCollectionSeo> = {
  free: {
    slug: 'free',
    name: 'Free & Freemium AI Tools',
    title: 'Best Free AI Tools That Are Actually Worth Using (2026)',
    heading: 'Free AI tools,',
    accent: 'verified by builders.',
    description:
      'A curated directory of the best free and generous freemium AI tools across coding, research, images, audio, video, and productivity — ranked on Vigas.',
    intro:
      'Every tool in this collection offers either 100% free access or a genuinely usable ongoing free tier with no trial trap, sorted by real builder upvotes.',
    filter: (t) => t.pricing === 'Free' || t.pricing === 'Freemium',
    faqs: [
      {
        q: 'Are all tools in this list completely free?',
        a: 'Tools tagged Free are free without a paid plan. Tools tagged Freemium give ongoing free usage limits suitable for daily testing and small projects.',
      },
      {
        q: 'How can I also access free AI models via API?',
        a: 'Browse the Free filter on our Models & Pricing page to call zero-dollar community and open-weight endpoints through the Vigas gateway.',
      },
    ],
  },
  'vigas-api': {
    slug: 'vigas-api',
    name: 'Tools Powered by Vigas API',
    title: 'Best AI Tools Running on the Vigas API (2026)',
    heading: 'Built on Vigas,',
    accent: 'one key & balance.',
    description:
      'Discover AI agents, coding editors, and apps powered by the Vigas unified API — use your single prepaid balance with honest pass-through pricing.',
    intro:
      'Products in this collection connect directly to your Vigas API key so you share one credit balance across every tool without stacking redundant subscriptions.',
    filter: (t) => t.runsOnVigas,
    faqs: [
      {
        q: 'Do I need separate subscriptions for Vigas API tools?',
        a: 'No. Connect your Vigas API key and pay only for actual underlying token usage drawn from your prepaid Vigas wallet.',
      },
      {
        q: 'Can I list my own app in the Vigas API collection?',
        a: 'Yes — submit your tool via email or build an OpenAI-compatible integration pointing at api.vigas.ai/v1.',
      },
    ],
  },
  new: {
    slug: 'new',
    name: 'New AI Tools',
    title: 'Newest AI Tools & Rising Launches (2026)',
    heading: 'Fresh AI launches,',
    accent: 'worth watching now.',
    description:
      'The newest AI tools, coding agents, and research releases indexed on Vigas — discover what builders are testing and upvoting this week.',
    intro:
      'Newly released and verified tools hand-tested by Vigas editors before hitting mainstream directories.',
    filter: (t) => t.isNew,
    faqs: [
      {
        q: 'How often are new AI tools added to Vigas?',
        a: 'Our editors review builder submissions weekly and flag standout new releases right here and in The Daily Token briefing.',
      },
    ],
  },
};

export interface NewsCategorySeo {
  category: NewsCategory;
  slug: string;
  title: string;
  heading: string;
  description: string;
  intro: string;
  relatedToolCategory: ToolCategory;
  relatedLeaderboard: LeaderboardCategory;
  faqs: FaqItem[];
}

export const NEWS_CATEGORY_SEO: Record<NewsCategory, NewsCategorySeo> = {
  Models: {
    category: 'Models',
    slug: 'models',
    title: 'AI Model Releases, Benchmarks & Pricing News',
    heading: 'Frontier releases, open-weight drops & token pricing.',
    description:
      'Coverage of major AI model launches, context window upgrades, benchmark jumps, and API pricing moves — backed by live Vigas router data.',
    intro:
      'Every model story in this section links directly to live Vigas leaderboard win share and real per-million-token pricing.',
    relatedToolCategory: 'Coding',
    relatedLeaderboard: 'overall',
    faqs: [
      {
        q: 'How does Vigas verify AI model launch claims?',
        a: 'We cross-reference provider announcements against live gateway latency, per-token pass-through pricing, and blind Arena pairwise votes.',
      },
    ],
  },
  Agents: {
    category: 'Agents',
    slug: 'agents',
    title: 'AI Agents & Computer-Use News',
    heading: 'Autonomous coding agents, tool use & multi-step workflows.',
    description:
      'News and technical reporting on autonomous AI agents, browser automation, CLI coding harnesses, and production reliability.',
    intro:
      'Tracking how frontier and open-weight models perform when given terminal, file-system, and browser tools on multi-hour tasks.',
    relatedToolCategory: 'Agents',
    relatedLeaderboard: 'coding',
    faqs: [
      {
        q: 'Where can I compare agent model performance live?',
        a: 'Visit the Vigas Coding and Overall leaderboards to track real session completion win shares and cost per agent task.',
      },
    ],
  },
  Analysis: {
    category: 'Analysis',
    slug: 'analysis',
    title: 'AI Industry Analysis & Router Data Essays',
    heading: 'Deep dives, cost curves & long-horizon strategy.',
    description:
      'Data-backed analysis essays examining AI inference economics, datacenter power constraints, model routing trends, and developer adoption.',
    intro:
      'Original essays grounded in anonymized marketplace price changes, latency telemetry, and multi-model Arena preferences.',
    relatedToolCategory: 'Research',
    relatedLeaderboard: 'overall',
    faqs: [
      {
        q: 'What datasets inform Vigas Newsroom analysis?',
        a: 'Our essays cite real router pricing snapshots, Bradley-Terry Arena win shares, and anonymized task cost distributions across Vigas.',
      },
    ],
  },
  Policy: {
    category: 'Policy',
    slug: 'policy',
    title: 'AI Policy, Regulation & Safety News',
    heading: 'AI governance, compliance & global standards.',
    description:
      'Reporting on AI regulation, transparency mandates, copyright rulings, and enterprise model safety frameworks worldwide.',
    intro:
      'Clear tracking of regulatory timelines, compliance rules for general-purpose models, and what policy shifts mean for engineering teams.',
    relatedToolCategory: 'Productivity',
    relatedLeaderboard: 'aligned',
    faqs: [
      {
        q: 'Which leaderboard tracks safety and helpfulness?',
        a: 'Check the Aligned category on the Vigas leaderboard to see how models rank on safe, policy-compliant behavior in real sessions.',
      },
    ],
  },
  Hardware: {
    category: 'Hardware',
    slug: 'hardware',
    title: 'AI Chips, GPUs & Compute Infrastructure News',
    heading: 'Silicon roadmaps, HBM packaging & inference clusters.',
    description:
      'Reporting on AI accelerators, 2nm foundry capacity, custom inference chips, and datacenter power builds shaping model availability.',
    intro:
      'Follow the hardware bottlenecks—from memory bandwidth to grid interconnects—that dictate real inference speeds and API costs.',
    relatedToolCategory: 'Video',
    relatedLeaderboard: 'overall',
    faqs: [
      {
        q: 'How does chip supply affect API token prices?',
        a: 'New inference silicon and quantization improvements translate directly into 24-hour price drops tracked on the Vigas Models page.',
      },
    ],
  },
  Funding: {
    category: 'Funding',
    slug: 'funding',
    title: 'AI Startups, Venture Funding & Acquisitions',
    heading: 'Capital flows, foundation labs & breakout agent startups.',
    description:
      'Coverage of major AI funding rounds, M&A activity, enterprise revenue milestones, and capital efficiency across agent companies.',
    intro:
      'Tracking where venture capital and cloud compute commitments are concentrating across foundational labs and vertical applications.',
    relatedToolCategory: 'Productivity',
    relatedLeaderboard: 'work',
    faqs: [
      {
        q: 'Where do funded startups ship first on Vigas?',
        a: 'Explore newly launched tools built by funded teams in the Tools directory and New AI Tools collection.',
      },
    ],
  },
  Tools: {
    category: 'Tools',
    slug: 'tools',
    title: 'AI Developer Tools & Product Releases',
    heading: 'New creator workflows, editors & SDK updates.',
    description:
      'Product spotlights, builder roundups, and hands-on tests covering the AI coding editors, media studios, and apps gaining real traction.',
    intro:
      'Hands-on dispatches highlighting the apps builders actually keep open after week one.',
    relatedToolCategory: 'Image',
    relatedLeaderboard: 'webdev',
    faqs: [
      {
        q: 'Can builders upvote tools covered in these stories?',
        a: 'Yes — open any tool in the Vigas Tools directory to read full reviews, compare alternatives, and cast an upvote.',
      },
    ],
  },
};

export interface LeaderboardCategorySeo {
  intro: string;
  relatedToolCategory: ToolCategory;
  relatedToolLabel: string;
  relatedNewsCategory: NewsCategory;
}

export const LEADERBOARD_CATEGORY_SEO: Record<LeaderboardCategory, LeaderboardCategorySeo> = {
  overall: {
    intro: 'Composite leaderboard weighting real multi-turn task completions alongside blind Arena pairwise comparisons across every domain.',
    relatedToolCategory: 'Agents',
    relatedToolLabel: 'AI agent tools',
    relatedNewsCategory: 'Models',
  },
  coding: {
    intro: 'Focused on repository navigation, debugging, refactoring, test generation, and terminal command execution in live software workflows.',
    relatedToolCategory: 'Coding',
    relatedToolLabel: 'AI coding tools',
    relatedNewsCategory: 'Agents',
  },
  webdev: {
    intro: 'Evaluates full-stack web UI quality, responsive CSS layout fidelity, accessibility, and interactive component architecture.',
    relatedToolCategory: 'Coding',
    relatedToolLabel: 'Web & UI builders',
    relatedNewsCategory: 'Tools',
  },
  text: {
    intro: 'Captures long-form prose clarity, structured reasoning, factual synthesis, summarization, and multi-language instruction following.',
    relatedToolCategory: 'Research',
    relatedToolLabel: 'AI research assistants',
    relatedNewsCategory: 'Analysis',
  },
  vision: {
    intro: 'Measures multimodal accuracy across UI screenshots, charts, scanned documents, diagrams, and camera image reasoning.',
    relatedToolCategory: 'Video',
    relatedToolLabel: 'Vision & video tools',
    relatedNewsCategory: 'Models',
  },
  'image-edit': {
    intro: 'Compares spatial prompt adherence, typography consistency, object removal, and style-preserving image edits.',
    relatedToolCategory: 'Image',
    relatedToolLabel: 'AI image generators',
    relatedNewsCategory: 'Tools',
  },
  aligned: {
    intro: 'Evaluates nuanced safety, refusal calibration, honest uncertainty handling, and helpfulness under ambiguous instructions.',
    relatedToolCategory: 'Audio',
    relatedToolLabel: 'Voice & conversational tools',
    relatedNewsCategory: 'Policy',
  },
  work: {
    intro: 'Tracks everyday business tasks including contract review, structured data extraction, emails, spreadsheets, and planning docs.',
    relatedToolCategory: 'Productivity',
    relatedToolLabel: 'AI productivity tools',
    relatedNewsCategory: 'Funding',
  },
};

export function parseToolCategorySlug(raw: string): ToolCategory | null {
  const normalized = raw.trim().toLowerCase();
  return TOOL_CATEGORIES.find((c) => c.toLowerCase() === normalized) ?? null;
}

export function parseToolCollectionSlug(raw: string): ToolCollectionSlug | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'free' || normalized === 'vigas-api' || normalized === 'new') return normalized;
  return null;
}

export function parseNewsCategorySlug(raw: string): NewsCategory | null {
  const normalized = raw.trim().toLowerCase();
  return NEWS_CATEGORIES.find((c) => c.toLowerCase() === normalized) ?? null;
}

export function shortModelName(name: string): string {
  return name.replace(/ \(.*\)$/, '');
}

export function getLeaderboardFaq(category: LeaderboardCategory, label: string, entries: LeaderboardEntry[]): FaqItem[] {
  const leader = entries[0];
  const runnerUp = entries[1];
  const valuePick = [...entries]
    .filter((e) => e.costPerTaskMicros > 0 && e.rank <= 10)
    .sort((a, b) => a.costPerTaskMicros - b.costPerTaskMicros)[0];

  const items: FaqItem[] = [];
  if (leader) {
    items.push({
      q: `What is the #1 AI model on the ${label} leaderboard right now?`,
      a: `${shortModelName(leader.name)} (${leader.org}) leads ${label.toLowerCase()} with a ${leader.winRate.toFixed(2)}% real-work win share and a Bradley-Terry score of ${Math.round(leader.rating)}${runnerUp ? `, ahead of #2 ${shortModelName(runnerUp.name)} (${runnerUp.winRate.toFixed(2)}%)` : ''}.`,
    });
  }
  if (valuePick) {
    items.push({
      q: `Which top-10 model offers the lowest cost per task for ${label.toLowerCase()}?`,
      a: `${shortModelName(valuePick.name)} balances #${valuePick.rank} performance (score ${Math.round(valuePick.rating)}) at ${formatUsd(valuePick.costPerTaskMicros)} per completed task on Vigas.`,
    });
  }
  items.push(
    {
      q: 'How are Vigas leaderboard scores and win shares calculated?',
      a: `Vigas combines real session outcomes across Chat, API, and RetroBuild with blind pairwise Arena votes using a Bradley-Terry statistical model with 95% confidence intervals.`,
    },
    {
      q: `Can I call the top ${label.toLowerCase()} models through one API?`,
      a: 'Yes. Point any OpenAI-compatible client at https://api.vigas.ai/v1 with your Vigas API key or set model to vigas/auto to route across providers automatically.',
    },
  );
  return items;
}

export function getToolsDirectoryFaq(tools: ToolItem[]): FaqItem[] {
  const freeCount = tools.filter((t) => t.pricing !== 'Paid').length;
  const vigasCount = tools.filter((t) => t.runsOnVigas).length;
  const top = tools[0];
  return [
    {
      q: 'How are AI tools ranked in the Vigas directory?',
      a: `Tools are sorted by verified builder upvotes, editor quality ratings, and real integration value.${top ? ` ${top.name} currently leads the directory with ${top.votes.toLocaleString('en-US')} upvotes.` : ''}`,
    },
    {
      q: 'How many free or freemium AI tools are listed on Vigas?',
      a: `There are currently ${freeCount} free and freemium AI tools listed out of ${tools.length} total tools—browse them in one place under the Free AI tools collection.`,
    },
    {
      q: 'What does the "Vigas API" badge mean on a tool card?',
      a: `${vigasCount} listed tools support routing directly through your Vigas API key so every prompt bills transparently against your single Vigas prepaid balance.`,
    },
  ];
}

export function getToolDetailFaq(tool: ToolItem, all: ToolItem[], rank: number, categoryRank: number): FaqItem[] {
  const inCat = all.filter((t) => t.category === tool.category);
  const topAlt = inCat.find((t) => t.slug !== tool.slug);
  return [
    {
      q: `How much does ${tool.name} cost?`,
      a:
        tool.pricing === 'Free'
          ? `${tool.name} is free to use without a required subscription.`
          : tool.pricing === 'Freemium'
            ? `${tool.name} uses a freemium pricing model, letting you start free before upgrading for higher limits or team controls.`
            : `${tool.name} is a paid AI tool focused on production workflows and pro-tier usage.`,
    },
    {
      q: `Where does ${tool.name} rank among ${tool.category} AI tools?`,
      a: `${tool.name} currently ranks #${categoryRank} of ${inCat.length} tools in ${tool.category} and #${rank} of ${all.length} overall on Vigas, holding a ${tool.rating.toFixed(1)}/5 rating across ${tool.votes.toLocaleString('en-US')} builder upvotes.`,
    },
    {
      q: `Does ${tool.name} work with the Vigas API?`,
      a: tool.runsOnVigas
        ? `Yes. ${tool.name} supports the Vigas unified endpoint, allowing you to use your prepaid Vigas balance across frontier models.`
        : `${tool.name} operates as an independent application (${tool.pricing}). You can compare its performance or build comparable workflows via the Vigas API.`,
    },
    ...(topAlt
      ? [
          {
            q: `What is the closest alternative to ${tool.name}?`,
            a: `${topAlt.name} is a top alternative in the ${tool.category} category (★ ${topAlt.rating.toFixed(1)}/5, ${topAlt.pricing} pricing) with ${topAlt.votes.toLocaleString('en-US')} upvotes on Vigas.`,
          },
        ]
      : []),
  ];
}
