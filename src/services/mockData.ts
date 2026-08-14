/**
 * frontend/src/services/mockData.ts
 * ============================================================================
 * UI/UX Mock Data Repository for Claude Code & Frontend Developers
 * ============================================================================
 * This file provides rich, realistic mock data for previewing all UI states 
 * (Dashboard, Projects, AI Agent Chat, Tool Calls, File Tree, Profile & Usage).
 *
 * WHEN CONNECTING TO REAL BACKEND:
 * Replace imports of mock data in your components with calls from `projectService`,
 * `agentService`, and `supabase` auth.
 * ============================================================================
 */

import { Project } from "./projectService";
import { AgentSessionData, AgentTaskData } from "./agentService";

/** Mock User Profile */
export const MOCK_USER_PROFILE = {
  id: "usr_mock_12345",
  email: "developer@issac.ai",
  display_name: "البرز محمدی",
  avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
  subscription_tier: "free" as const, // 'free' | 'pro' | 'team'
  tokens_used: 18500,
  plan_limit_tokens: 100000,
};

/** Mock Projects List */
export const MOCK_PROJECTS: Project[] = [
  {
    id: "proj_01_landing",
    name: "Landing Page SaaS",
    description: "Next.js + Tailwind CSS modern landing page for AI builder",
    sandbox_path: "users/usr_mock_12345/projects/proj_01_landing",
    last_opened_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
  },
  {
    id: "proj_02_dashboard",
    name: "Analytics Admin Dashboard",
    description: "React dashboard with Chart.js and Supabase database",
    sandbox_path: "users/usr_mock_12345/projects/proj_02_dashboard",
    last_opened_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: "proj_03_mobile",
    name: "E-Commerce Expo App",
    description: "React Native mobile app with Stripe checkout integration",
    sandbox_path: "users/usr_mock_12345/projects/proj_03_mobile",
    last_opened_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
  },
];

/** Mock Active Chat Session */
export const MOCK_AGENT_SESSION: AgentSessionData = {
  id: "sess_mock_7788",
  project_id: "proj_01_landing",
  status: "active",
  model_provider: "Claude 3.5 Sonnet",
  token_usage_total: 1850,
  created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  updated_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
  transcript: [
    {
      id: "msg_1",
      role: "user",
      content: "یک سیستم تِم دارک (Dark Theme) با دکمه‌های Glassmorphic پیاده‌سازی کن.",
      createdAt: Date.now() - 1000 * 60 * 10,
    },
    {
      id: "msg_2",
      role: "assistant",
      content: "من متغیرهای استایل کلیدها و پالت رنگی را در `src/index.css` قرار دادم و کامپوننت دکمه اصلی را به کدهای پروژه اضافه کردم.",
      createdAt: Date.now() - 1000 * 60 * 8,
    },
    {
      id: "msg_3",
      role: "user",
      content: "حالا یک فرم لاگین با انیمیشن ورود درست کن.",
      createdAt: Date.now() - 1000 * 60 * 3,
    },
  ],
};

/** Mock Executed Tool Steps (ToolCallCards) */
export const MOCK_AGENT_TASKS: AgentTaskData[] = [
  {
    id: "task_01",
    session_id: "sess_mock_7788",
    tool_name: "enter_plan_mode",
    tool_input: { reason: "در حال بررسی کدهای پروژه و ساخت لایه‌های CSS" },
    status: "success",
    duration_ms: 320,
    created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
  {
    id: "task_02",
    session_id: "sess_mock_7788",
    tool_name: "write_to_file",
    tool_input: { path: "src/components/LoginForm.tsx" },
    tool_output: { success: true, bytesWritten: 1240 },
    status: "success",
    duration_ms: 850,
    created_at: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
  },
  {
    id: "task_03",
    session_id: "sess_mock_7788",
    tool_name: "run_command",
    tool_input: { command: "npm test -- --watchAll=false" },
    tool_output: { status: "running", output: "Executing unit tests..." },
    status: "running",
    duration_ms: 1400,
    created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
  },
  {
    id: "task_04",
    session_id: "sess_mock_7788",
    tool_name: "exit_plan_mode",
    tool_input: { plan: "تمام تغییرات با موفقیت کمپایل شدند." },
    status: "pending",
    created_at: new Date().toISOString(),
  },
];

/** Mock Project File Tree */
export const MOCK_FILE_TREE = [
  {
    name: "src",
    type: "folder",
    path: "src",
    children: [
      {
        name: "components",
        type: "folder",
        path: "src/components",
        children: [
          { name: "Button.tsx", type: "file", path: "src/components/Button.tsx", size: "1.8 KB" },
          { name: "LoginForm.tsx", type: "file", path: "src/components/LoginForm.tsx", size: "3.2 KB" },
          { name: "Header.tsx", type: "file", path: "src/components/Header.tsx", size: "2.1 KB" },
        ],
      },
      { name: "App.tsx", type: "file", path: "src/App.tsx", size: "4.5 KB" },
      { name: "index.css", type: "file", path: "src/index.css", size: "850 B" },
    ],
  },
  { name: "package.json", type: "file", path: "package.json", size: "1.2 KB" },
  { name: "README.md", type: "file", path: "README.md", size: "540 B" },
];
