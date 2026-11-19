> ⚠️ **OUTDATED — DO NOT USE (Aug 2026):** این سند معماری‌ای را توصیف می‌کند که با کد فعلی مطابقت ندارد (پورت 8000، Skills.sh CLI، جدول `chat_sessions` — هیچ‌کدام وجود ندارند). مرجع معتبر معماری: [README.md](README.md) و [ROADMAP_FA.md](ROADMAP_FA.md). سرور محلی واقعی روی پورت **54321** است (`local-api-server.ts`).

# 🚀 RETRO CODE — COMPLETE BACKEND INTEGRATION & ARCHITECTURE HANDBOOK
> **Developer Handoff Document & Technical Blueprint**  
> *Target Platform:* Cross-Platform Mobile (Android Expo APK & Web)  
> *Frontend Stack:* React Native + Expo (TypeScript, Native Wind / Tailwind)  
> *Backend Engine:* Deno Runtime (TypeScript, REST APIs, WebSockets / SSE Streams)  
> *Flagship Ecosystem:* **Skills.sh Open AI Agent Skills Architecture**  

---

## 📋 Table of Contents
1. [Project Overview & Architecture](#1-project-overview--architecture)
2. [Skills.sh Ecosystem Integration Blueprint](#2-skillssh-ecosystem-integration-blueprint)
3. [Complete API Endpoints Directory](#3-complete-api-endpoints-directory)
4. [Frontend to Backend Integration Points](#4-frontend-to-backend-integration-points)
5. [Database Schema (Supabase / PostgreSQL)](#5-database-schema-supabase--postgresql)
6. [Step-by-Step Developer Launch Checklist](#6-step-by-step-developer-launch-checklist)
7. [Building the Android Application (.apk)](#7-building-the-android-application-apk)

---

## 1. Project Overview & Architecture

**Retro Code** is a state-of-the-art AI Agent Coding IDE & Chat Workspace built with **React Native + Expo**, engineered specifically for seamless cross-platform performance (Android APK & Web).

```
                      ┌──────────────────────────────────────┐
                      │    RETRO CODE FRONTEND INTERFACE     │
                      │  (React Native / Expo Web & Mobile)  │
                      └──────────────────┬───────────────────┘
                                         │
                         HTTP REST / SSE Stream (Port 8000)
                                         │
                      ┌──────────────────▼───────────────────┐
                      │          DENO LOCAL API SERVER       │
                      │       (local-api-server.ts)          │
                      └──────┬───────────────────┬───────────┘
                             │                   │
             ┌───────────────▼──────┐     ┌──────▼────────────────┐
             │  DENO QUEUE WORKER   │     │  SKILLS.SH ECOSYSTEM  │
             │ (run-local-worker.ts)│     │  (npx skills add CLI) │
             └──────────────────────┘     └───────────────────────┘
```

---

## 2. Skills.sh Ecosystem Integration Blueprint

The **Skills.sh Open Ecosystem** is integrated as Connector **#1 (Flagship Ecosystem)** at the top of the Connectors Directory and Drawer Dashboard.

### How Skills.sh Works in Retro Code:
1. **Frontend Trigger (`AgentChatScreen.tsx`):**  
   When a user clicks **"Install Skills.sh Ecosystem"** or toggles a skill, the frontend issues a request to `POST /api/connectors/skillsh/toggle`.
2. **Backend CLI Execution (`local-api-server.ts`):**  
   The Deno backend executes `npx skills add <repository-name>` in the workspace root directory.
3. **Skill Instruction Reading (`SKILL.md`):**  
   The backend scans `.skills/` or `skills/` for `SKILL.md` files containing procedural instructions, UI design rules, or vector icon guidelines.
4. **LLM System Prompt Injection:**  
   When the user sends a prompt, the Deno server injects the active `SKILL.md` content directly into the System Prompt sent to Claude 3.5 Sonnet / GPT-5.6 / Gemini 3.1.

---

## 3. Complete API Endpoints Directory

All backend endpoints run on `http://localhost:8000`.

### 1. Chat & Streaming (`POST /api/chat/messages`)
* **Description:** Receives user prompts, attaches active model/project/incognito mode, and returns SSE stream of execution steps.
* **Request Payload:**
```json
{
  "prompt": "Fix the login redirect issue in src/auth/",
  "modelId": "claude-sonnet-5",
  "isIncognito": false,
  "projectName": "Landing Page SaaS",
  "isThinkingEnabled": true
}
```
* **Response Stream (Server-Sent Events):**
```json
event: step
data: {"type": "command", "cmd": "git log --oneline -8 src/auth/", "status": "completed"}

event: step
data: {"type": "file_edit", "file": "util.ts", "ext": "TS", "additions": 48, "deletions": 12}

event: text
data: "I have updated the redirect utility to preserve the returnUrl parameter."
```

### 2. Connectors & Skills Directory (`GET /api/connectors` & `POST /api/connectors/:id/toggle`)
* **Description:** Fetches all available connectors and installs/disconnects Skills.sh modules.
* **Toggle Response:**
```json
{
  "id": "skillsh",
  "name": "Skills.sh Open Ecosystem",
  "connected": true,
  "installedSkills": ["ui-mastery", "react-native-optimizer", "jest-testing"]
}
```

### 3. AI Models Directory (`GET /api/models`)
* **Description:** Provides capability metadata for models (Claude, Gemini, GPT-5, Grok).
```json
[
  { "id": "auto", "name": "Auto", "supportsThinking": true },
  { "id": "claude-sonnet-5", "name": "Claude Sonnet 5", "supportsThinking": true }
]
```

### 4. Git Checkpoints & Rollbacks (`GET /api/checkpoints` & `POST /api/checkpoints/rollback`)
* **Description:** Manages Git version timeline and restores project code to previous checkpoint hashes.
```json
{
  "checkpointHash": "e5509a3",
  "status": "restored",
  "restoredFiles": ["src/auth/util.ts"]
}
```

---

## 4. Frontend to Backend Integration Points

In `frontend/src/screens/chat/AgentChatScreen.tsx`, every handler contains explicit backend integration comments:

```typescript
// 1. SEND MESSAGE HANDLER
const handleSend = async () => {
  // BACKEND API INTEGRATION POINT:
  // const res = await fetch("http://localhost:8000/api/chat/messages", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ prompt: inputText, model: selectedModelId, isIncognito })
  // });
};

// 2. TOGGLE CONNECTOR / SKILL HANDLER
const handleToggleConnectorConnection = async (connId: string) => {
  // BACKEND API INTEGRATION POINT:
  // await fetch(`http://localhost:8000/api/connectors/${connId}/toggle`, { method: "POST" });
};
```

---

## 5. Database Schema (Supabase / PostgreSQL)

```sql
-- 1. USERS & PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  call_name TEXT,
  ai_preferences TEXT,
  plan_tier TEXT DEFAULT 'free',
  credits_remaining INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PROJECTS TABLE
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. SESSIONS & CHAT MESSAGES TABLE
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_incognito BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 6. Step-by-Step Developer Launch Checklist

1. **Start Deno API Server:**
   ```bash
   npx deno run --allow-all --env local-api-server.ts
   ```
2. **Start Deno Worker:**
   ```bash
   npx deno run --env --allow-all run-local-worker.ts
   ```
3. **Start Expo Frontend:**
   ```bash
   cd frontend
   npx expo start --web
   ```

---

## 7. Building the Android Application (.apk)

Retro Code is built on **React Native + Expo**, making Android compilation straightforward:

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```
2. Configure Build Project:
   ```bash
   cd frontend
   eas build:configure
   ```
3. Build Android APK:
   ```bash
   eas build -p android --profile preview
   ```

---
*Handbook created for Retro Code project handoff.*
