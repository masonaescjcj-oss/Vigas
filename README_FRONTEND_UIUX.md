# 🎨 Issac AI — Pure UI/UX Presentation Template & Handover Document

> **Notice for Claude Code / AI Coding Assistants:**
> This repository is a **100% Pure Presentational UI/UX Template** (Dumb Components & Screens). 
> It contains ZERO complex business logic, API calls, or backend dependencies. Every screen renders clean, modern dark-mode layouts using static mock data (`mockData.ts`).
>
> Your role when completing this project is to keep the UI components intact and wrap them with your backend state containers and API calls.

---

## 🎯 Architecture Philosophy: Presentational UI vs. Business Logic

```
┌────────────────────────────────────────────────────────┐
│               PURE UI / PRESENTATION LAYER             │
│  (React Native / Tailwind CSS / Design Tokens / Icons) │
│                                                        │
│  - HomeDashboardScreen.tsx                             │
│  - ProjectListScreen.tsx                               │
│  - AgentChatScreen.tsx                                 │
│  - ToolCallCard.tsx, ChatBubble.tsx, PlanModeCard.tsx  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           │  (Claude Code Todo: Wire Logic)
                           ▼
┌────────────────────────────────────────────────────────┐
│               BUSINESS LOGIC & API LAYER               │
│                                                        │
│  - projectService.ts  --->  POST /functions/v1/projects │
│  - agentService.ts    --->  POST /functions/v1/agent-run│
│  - authStore.ts       --->  Supabase Auth Listener     │
│  - Realtime Channel   --->  agent_tasks live updates   │
└────────────────────────────────────────────────────────┘
```

---

## 🗂️ Component & Screen Sitemap

```
frontend/src/
├── components/          # Pure UI Atoms & Molecules
│   ├── Button.tsx       # Glassmorphic & Brand Primary Buttons
│   ├── ChatBubble.tsx   # User & Agent Chat Bubbles
│   ├── ToolCallCard.tsx # Real-time Agent Execution Cards (Tool Call logs)
│   ├── PlanModeCard.tsx # Interactive Agent Planning Mode Card
│   ├── InputComposer.tsx# Bottom Chat Input Bar
│   ├── FileTreeItem.tsx # Tree view component for file explorer
│   ├── ProjectCard.tsx  # Project list item with badges
│   ├── LoadingSkeleton.tsx # Shimmer skeletons for loading state
│   ├── PermissionModal.tsx # Security approval modal for file/command access
│   ├── UsageChart.tsx   # Token usage & quota progress bars
│   └── Typography.tsx   # Design system typography tokens (h1, h2, caption, etc.)
│
├── screens/             # Pure Presentational Workspaces
│   ├── home/            # HomeDashboardScreen.tsx (Overview, Recent Projects, Tokens)
│   ├── projects/        # ProjectListScreen.tsx (Project Grid & Creation Modal)
│   ├── chat/            # AgentChatScreen.tsx (Chat Workspace & Execution Steps)
│   ├── files/           # FileTreeScreen.tsx (File Tree & Viewer)
│   └── settings/        # ProfileMainScreen.tsx (User Settings)
│
└── services/
    └── mockData.ts      # 🌟 Master UI Preview Mock Repository
```

---

## 🛠️ Step-by-Step Instructions for Claude Code to Connect Backend

1. **Keep UI intact**: Do not rewrite component JSX or Tailwind styles. They are pixel-perfect and styled for high-end dark mode aesthetics.
2. **Inject Live Queries**:
   - In `ProjectListScreen.tsx`: Replace `useState(MOCK_PROJECTS)` with `const { projects } = useProjects()`.
   - In `AgentChatScreen.tsx`: Replace static messages with `const { session, tasks, sendPrompt } = useAgentSession(sessionId)`.
3. **Listen to Supabase Realtime**:
   - Connect `agent_tasks` realtime channel to trigger `queryClient.invalidateQueries` whenever new tool execution steps are logged.

---

## 🚀 Running the UI/UX Preview

To run and preview the pure UI/UX mockup in your browser:
```bash
cd frontend
npm run web
```
Open [http://localhost:8081](http://localhost:8081).
