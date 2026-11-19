# Retro Code — Frontend

> **Historical note:** this file used to declare the frontend a "100% Pure
> Presentational UI/UX Template" with "ZERO API calls" driven by `mockData.ts`.
> That is no longer true, and `mockData.ts` no longer exists. Every screen
> listed below reads real data; where a backend genuinely does not exist yet,
> the UI says so instead of faking it.

React Native + Expo (TypeScript, NativeWind). Runs on web, Android and iOS from
one codebase.

## What talks to what

```
AgentChatScreen ──► agent-run ──► job_queue ──► queue-worker ──► agent core
      │                                                              │
      │  agent_tasks (Realtime + adaptive polling)  ◄────────────────┘
      │
      ├──► project-files ──► previewBuilder ──► sandboxed iframe (live preview)
      ├──► projects-create/list/delete   (useProjects)
      ├──► usage-check                   (token usage)
      └──► checkpoints table             (history, read-only)
```

## Layout

```
src/
├── components/       Icon (lucide), ToolRunRow (terminal-style tool log),
│                     AgentMessageText + markdown.ts, Typography, Button…
├── screens/
│   ├── auth/         Splash → Onboarding → Welcome → Login/SignUp/Reset
│   ├── chat/         AgentChatScreen — the product; chat, drawer, preview,
│   │                 files, checkpoints, projects, settings
│   ├── projects/     list, detail, settings, new
│   ├── files/        tree + viewer
│   ├── settings/     account, preferences, security, help, about, legal
│   └── subscription/ paywall, manage, token usage
├── services/         agentService, projectService, fileService, previewBuilder,
│                     formatting, notify, functionsClient, supabase
├── hooks/            useProjects, useFileTree, useSubscription, useNetworkStatus
└── stores/           authStore (Supabase session), settingsStore (persisted)
```

## Conventions worth knowing

- **Errors are shown, never swallowed.** Use `notify()` from `services/notify`
  rather than `Alert.alert` — react-native-web drops `Alert.alert` silently, so
  anything reported through it is invisible on web.
- **Icons come from `components/Icon`**, never emoji: emoji ignore the `color`
  prop and render differently per platform.
- **No mock fallbacks.** If a call fails, surface the error. A screen that
  invents plausible data hides outages and misleads the user.
- **Pure logic lives apart from views** (`services/formatting.ts`,
  `components/markdown.ts`) so it can be unit-tested — see `src/**/__tests__`.

## Running it

```bash
npm run web
```

Point the app at a backend with `EXPO_PUBLIC_API_URL` in `.env` (cloud functions
URL, or `http://localhost:54321/functions/v1` with the local gateway running).
See [DEPLOY.md](DEPLOY.md) for deployment and [ROADMAP_FA.md](ROADMAP_FA.md) for
what is built and what is next.
