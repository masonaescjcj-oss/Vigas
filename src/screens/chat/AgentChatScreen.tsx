/**
 * frontend/src/screens/chat/AgentChatScreen.tsx
 * ============================================================================
 * PURE OBSIDIAN BLACK THEME (#000000) AGENT WORKSPACE & AI CODING IDE
 * APPLICATION BRAND: RETRO CODE
 * SEAMLESS BORDERLESS MODERN DESIGN SYSTEM (CLEAN SLEEK MINIMALISM)
 * ============================================================================
 * 
 * NOTE FOR BACKEND AI INTEGRATION:
 * This component is fully structured and annotated with explicit BACKEND INTEGRATION POINTS.
 * All state handlers, streaming message updates, connector toggles, project management,
 * and checkpoint rollbacks have clear placeholders pointing to your Deno/Express API endpoints.
 * 
 * Featured Agent Ecosystem:
 *   - Skills.sh (#1 Flagship Connector): Open ecosystem for AI Agent Skills, UI/UX Design Systems,
 *     Lucide Icons, Automated Testing, and React Native Performance Optimization.
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from "react";
import { View, ScrollView, TouchableOpacity, TextInput, SafeAreaView, Modal, Switch, Platform, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { useTheme } from "../../theme/ThemeProvider";
import { useThemeStore } from "../../theme/store";
import { MOCK_FILE_TREE } from "../../services/mockData";
import { type ProjectNavigationProp } from "../../navigation/types";
import { useProjects } from "../../hooks/useProjects";
import { agentService, type AgentTaskData } from "../../services/agentService";
import { getProjectFiles } from "../../services/fileService";
import { buildPreviewHtml } from "../../services/previewBuilder";

/** On web, render the preview document in a sandboxed iframe. Native gets the
 * WebView-based preview with the store build (Phase 4). */
const WebPreviewFrame = ({ html }: { html: string }) => {
  if (Platform.OS !== "web") return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { unstable_createElement } = require("react-native-web");
  return unstable_createElement("iframe", {
    srcDoc: html,
    sandbox: "allow-scripts allow-modals",
    style: { flex: 1, width: "100%", height: "100%", border: "0", borderRadius: 16, backgroundColor: "#0f1115" },
  });
};

// ============================================================================
// ROCK-SOLID CRASH-PROOF VECTOR ICON SYSTEM (SVG / HD VECTOR GLYPHS)
// Works 100% flawlessly on Expo Web, Android APK, and iOS without font loading errors
// ============================================================================

const VectorIcon = ({ name, size = 16, color = "#A1A1AA", style }: { name: string; size?: number; color?: string; style?: any }) => {
  const iconMap: Record<string, string> = {
    user: "👤",
    search: "🔍",
    code: "⚙️",
    ghost: "👻",
    plus: "+",
    "arrow-up": "↑",
    "arrow-right": "➔",
    "arrow-left": "←",
    camera: "📷",
    image: "🖼️",
    "file-text": "📄",
    globe: "🌐",
    puzzle: "🧩",
    folder: "📁",
    trash: "🗑️",
    eye: "👁️",
    "rotate-ccw": "↺",
    terminal: ">_",
    tool: "🔧",
    zap: "⚡",
    sparkles: "✨",
    cpu: "💻",
    layers: "📚",
    check: "✓",
    x: "✕",
    "chevron-down": "˅",
    "chevron-right": "➔",
    cloud: "☁️",
    edit: "📝",
    info: "ⓘ",
    settings: "⚙️",
    shield: "🛡️",
    card: "💳",
    moon: "🌙",
    type: "Aa",
    mobile: "📱",
    pin: "📍",
    calendar: "📅",
    chart: "📈",
    video: "🎬",
    mic: "🎙️",
    box: "📦",
    drive: "📐",
    mail: "✉️",
    briefcase: "💼",
    inbox: "📥",
    github: "🐙",
  };

  const symbol = iconMap[name] || "•";

  return (
    <Text 
      style={[
        { 
          fontSize: size, 
          color: color, 
          lineHeight: size + 2, 
          textAlign: "center", 
          fontWeight: "600",
          fontFamily: "monospace"
        }, 
        style
      ]}
    >
      {symbol}
    </Text>
  );
};

// ============================================================================
// 1. DATA MODELS & INITIAL STATE SCHEMAS
// ============================================================================

/**
 * AI Models Directory
 * BACKEND INTEGRATION: Replace with `GET /api/models` to fetch dynamic model capability metadata.
 */
/**
 * Real model lineup. NOTE: model selection is not yet forwarded to the backend
 * (the worker's model comes from server env: OPENAI_MODEL / ANTHROPIC_MODEL);
 * plumbing the per-request model choice is a Phase 3 roadmap item.
 */
const AI_MODELS_DATA = [
  { id: "auto", name: "Auto", icon: "zap", color: "#F59E0B", category: "Best", description: "Automatically selects the best model for your prompt", supportsThinking: true },
  { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", icon: "zap", color: "#22C55E", badge: "default", category: "Best", description: "Fast general coding model (current default)" },
  { id: "deepseek-chat", name: "DeepSeek V3", icon: "code", color: "#38BDF8", category: "Best", description: "Fast, economical coding model" },
  { id: "deepseek-reasoner", name: "DeepSeek R1", icon: "sparkles", color: "#6366F1", category: "Best", description: "Deep reasoning for complex tasks", supportsThinking: true },
  { id: "claude-sonnet-5", name: "Claude Sonnet 5", icon: "cpu", color: "#F97316", badge: "pro", category: "Best", description: "Anthropic's premium coding model", supportsThinking: true },
];

/** Starter templates — must mirror supabase/functions/shared/templates.ts */
const PROJECT_TEMPLATE_CHOICES = [
  { id: "landing", label: "🚀 Landing" },
  { id: "todo", label: "✅ Todo" },
  { id: "gallery", label: "🖼️ Gallery" },
  { id: "blog", label: "📝 Blog" },
  { id: "quiz", label: "🧠 Quiz" },
  { id: "blank", label: "⬜ Blank" },
];

/**
 * Connectors Dataset & Deep Info Structure
 * #1 FLAGSHIP CONNECTOR: Skills.sh AI Agent Skills Repository
 * BACKEND INTEGRATION: Fetch from `GET /api/connectors` and sync OAuth/CLI skill installations.
 */
const INITIAL_CONNECTORS_DATA = [
  { 
    id: "skillsh", 
    name: "Skills.sh Open Ecosystem", 
    icon: "puzzle", 
    color: "#C084FC",
    description: "Install procedural AI skills, UI/UX design rules, vector icons & testing workflows", 
    category: "Popular", 
    connected: true,
    developer: "Skills.sh Open Community",
    overviewBullets: [
      "Access 1,000+ open-source AI Agent Skills (SKILL.md standard repository)",
      "UI & Vector Icon Mastery: Auto-generate Lucide, Heroicons, and sleek glassmorphism UI",
      "React Native & Expo Optimizer: Deep performance tuning, state management & bundle reduction",
      "Automated Testing & Refactoring: Auto-generate Jest & Playwright suites with zero setup",
      "Direct CLI integration: Install custom workspace skills via 'npx skills add <repo>'"
    ]
  },
  { 
    id: "gdrive", 
    name: "Google Drive", 
    icon: "drive", 
    color: "#38BDF8",
    description: "Get in-depth answers from your Google Drive content", 
    category: "Popular", 
    connected: true,
    developer: "Google LLC",
    overviewBullets: [
      "Search across your Google Drive documents, sheets, and presentations",
      "Read document text and attachments to ground answers in your personal files",
      "Access team shared drives and organization knowledge base",
      "Surface relevant document context during chat & coding sessions"
    ]
  },
  { 
    id: "gmail", 
    name: "Gmail with Calendar", 
    icon: "mail", 
    color: "#EF4444",
    description: "Search, create, and manage your emails and calendar events", 
    category: "Popular", 
    connected: true,
    developer: "Google LLC",
    overviewBullets: [
      "Search across your Gmail inbox, sent items, and custom labels",
      "Read email threads and attachments to ground responses in communications",
      "Create draft emails and schedule calendar meetings automatically",
      "Surface event context and relevant past email correspondence"
    ]
  },
  { 
    id: "onedrive", 
    name: "OneDrive", 
    icon: "cloud", 
    color: "#0284C7",
    description: "Get in-depth answers from your OneDrive content", 
    category: "Popular", 
    connected: false,
    developer: "Microsoft Corporation",
    overviewBullets: [
      "Search files stored in your Microsoft OneDrive cloud storage",
      "Extract text from Word, Excel, PowerPoint, and PDF files",
      "Seamless synchronization with Microsoft 365 cloud files"
    ]
  },
  { 
    id: "sharepoint", 
    name: "Sharepoint", 
    icon: "briefcase", 
    color: "#0D9488",
    description: "Get in-depth answers from your Sharepoint content", 
    category: "Popular", 
    connected: false,
    developer: "Microsoft Corporation",
    overviewBullets: [
      "Search enterprise intranet sites and document libraries",
      "Access team workspace documents and company policies",
      "Enforce enterprise role-based permissions automatically"
    ]
  },
  { 
    id: "dropbox", 
    name: "Dropbox", 
    icon: "box", 
    color: "#3B82F6",
    description: "Get in-depth answers from your Dropbox content", 
    category: "Popular", 
    connected: false,
    developer: "Dropbox Inc.",
    overviewBullets: [
      "Search files across all your connected Dropbox folders",
      "Extract content from shared project folders and team spaces"
    ]
  },
  { 
    id: "box", 
    name: "Box", 
    icon: "inbox", 
    color: "#2563EB",
    description: "Access secure cloud content management files", 
    category: "Popular", 
    connected: false,
    developer: "Box Inc.",
    overviewBullets: [
      "Access secure cloud content management files",
      "Search governance-controlled enterprise documents"
    ]
  },
  { 
    id: "notion", 
    name: "Notion", 
    icon: "file-text", 
    color: "#F4F4F5",
    description: "Search and create content on your Notion pages", 
    category: "Popular", 
    connected: false,
    developer: "Notion Labs Inc.",
    overviewBullets: [
      "Search workspace wiki pages, databases, and meeting notes",
      "Create and edit Notion pages directly through agent tools",
      "Query structured database tables and task boards"
    ]
  },
  { 
    id: "outlook", 
    name: "Outlook", 
    icon: "mail", 
    color: "#2563EB",
    description: "Search your emails and calendar events", 
    category: "Popular", 
    connected: false,
    developer: "Microsoft Corporation",
    overviewBullets: [
      "Search across your Outlook inbox, sent items, and folders",
      "Read messages, threads, and attachments to ground answers in your communications",
      "Search calendar events, meetings, and invitations",
      "Surface scheduling context and surface relevant past correspondence"
    ]
  },
  { 
    id: "github", 
    name: "GitHub", 
    icon: "github", 
    color: "#E4E4E7",
    description: "Search and manage your GitHub repositories", 
    category: "Popular", 
    connected: true,
    developer: "GitHub Inc.",
    overviewBullets: [
      "Search code, issues, and pull requests across your repositories",
      "Review commits, diffs, and pull request review comments",
      "Manage repository issues and trigger CI workflow runs"
    ]
  },
];

/**
 * Pinned & Recent Agent Sessions History
 * BACKEND INTEGRATION: Fetch from `GET /api/sessions/history`
 */
const PINNED_SESSIONS = [
  {
    id: "pin-1",
    title: "Fix the login flow redirect issue",
    time: "2 hr ago",
    prBadge: "1 merged",
    badgeType: "purple",
    extraBadge: "+3",
  },
  {
    id: "pin-2",
    title: "Kiro mobile app story book demo",
    time: "4 hr ago",
    prBadge: "2 open",
    badgeType: "blue",
    extraBadge: "+n"
  }
];

const RECENT_SESSIONS = [
  {
    id: "rec-1",
    title: "Can you refactor this component to use hooks?",
    time: "15min ago",
    prBadge: "2 open",
    badgeType: "blue"
  },
  {
    id: "rec-2",
    title: "Write unit tests for the notification module",
    time: "45hr ago",
    prBadge: "3 merged",
    badgeType: "purple"
  },
  {
    id: "rec-3",
    title: "Implement drag and drop for the kanban board",
    time: "1hr ago",
    prBadge: "3 merged",
    badgeType: "purple"
  },
  {
    id: "rec-4",
    title: "Update the onboarding carousel copy",
    time: "2hr ago",
    prBadge: "2 open",
    badgeType: "blue"
  },
  {
    id: "rec-5",
    title: "Add dark mode support to the settings page a",
    time: "3hr ago",
    prBadge: "1 unknown",
    badgeType: "amber"
  },
  {
    id: "rec-6",
    title: "Debug memory leak in websocket connection",
    time: "6hr ago",
    prBadge: "1 closed",
    badgeType: "gray"
  },
  {
    id: "rec-7",
    title: "Set up CI pipeline for the new monorepo",
    time: "1d 6hr ago",
    prBadge: "1 closed",
    badgeType: "gray"
  }
];

// ============================================================================
// 2. MAIN SCREEN COMPONENT
// ============================================================================

export const AgentChatScreen = () => {
  const { colors } = useTheme();
  const { mode, setMode } = useThemeStore();
  const navigation = useNavigation<ProjectNavigationProp>();
  const scrollViewRef = useRef<ScrollView>(null);

  const isLight = mode === "light";
  const bgCanvas = isLight ? "#FFFFFF" : "#000000";      // Pure 100% Crisp White (#FFFFFF)
  const bgCard = isLight ? "#FFFFFF" : "#141414";        // Pure White card (#FFFFFF)
  const bgPill = isLight ? "#F1F5F9" : "#242424";        // Clean soft white/gray pill (#F1F5F9)
  const bgBanner = isLight ? "#F8FAFC" : "#1C1C1E";      // Pure light banner (#F8FAFC)
  const textPrimary = isLight ? "#0F172A" : "#FFFFFF";   // Dark Slate Charcoal text (#0F172A)
  const textSecondary = isLight ? "#475569" : "#A1A1AA"; // Muted Slate text (#475569)
  const textMuted = isLight ? "#94A3B8" : "#71717A";     // Placeholder text (#94A3B8)
  const brandPrimary = isLight ? "#6D42C7" : "#C084FC";  // Purple accent (#6D42C7)
  const accentSky = "#38BDF8";                           // Sky Blue accent

  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------
  
  // Active Workspace Mode: 'chat' (General Q&A) vs 'build' (AI Agent IDE Workspace)
  const [activeMode, setActiveMode] = useState<"chat" | "build">("build");
  
  // Anonymous / Incognito Mode: When true, sessions are not logged or saved to database
  const [isIncognito, setIsIncognito] = useState(false);
  
  // Selected Model & Thinking Reasoning Toggle State
  const [selectedModelId, setSelectedModelId] = useState<string>("auto");
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(true);
  
  // Chat Stream Messages & Execution State
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [threadTitle, setThreadTitle] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);

  // Live agent session wiring (agent-run → job_queue → queue-worker → agent_tasks)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const runStartedAtRef = useRef<string | null>(null);
  const { projects, createProject } = useProjects();

  // On-device live preview state (Phase 2 killer feature)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Template picked in the New Project dialog
  const [newProjectTemplate, setNewProjectTemplate] = useState<string>("landing");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  
  // Modal Visibility Controllers
  const [showDrawerModal, setShowDrawerModal] = useState(false);        // Drawer Dashboard
  const [showAddToChatModal, setShowAddToChatModal] = useState(false);  // '+' Add to Chat Sheet
  const [showConnectorsModal, setShowConnectorsModal] = useState(false);  // Connectors Sheet
  const [showProjectsModal, setShowProjectsModal] = useState(false);    // Projects List Sheet
  const [showNewProjectModal, setShowNewProjectModal] = useState(false); // New Project Dialog
  const [showModelsModal, setShowModelsModal] = useState(false);        // Models Selector Sheet
  const [showFileModal, setShowFileModal] = useState(false);          // File Tree Sheet
  const [showProfileModal, setShowProfileModal] = useState(false);      // Master Profile Settings Modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);      // Live Web App Sandbox Preview Modal
  const [showCheckpointsModal, setShowCheckpointsModal] = useState(false); // Git Checkpoints Rollback Modal
  const [showDiffModal, setShowDiffModal] = useState(false);            // Side-by-Side Code Diff Viewer Modal
  const [selectedDiffFile, setSelectedDiffFile] = useState<any>(null);

  // Auto-complete Popups (@ Mentions & / Commands)
  const [showMentionsPopup, setShowMentionsPopup] = useState(false);
  const [showSlashPopup, setShowSlashPopup] = useState(false);
  
  // Active Selected Project State (Empty by default, populated when user selects a project)
  const [activeProjectName, setActiveProjectName] = useState<string>("");
  
  // Settings Screen View Switcher: 'main' | 'profile_edit' | 'capabilities' | 'permissions' | 'usage'
  const [profileSubScreen, setProfileSubScreen] = useState<"main" | "profile_edit" | "capabilities" | "permissions" | "usage">("main");
  
  // User Profile Settings Form States
  const [fullNameInput, setFullNameInput] = useState("Retro Code User");
  const [callNameInput, setCallNameInput] = useState("Retro Code User");
  const [aiPreferenceText, setAiPreferenceText] = useState("Ask clarifying questions before giving detailed answers");
  
  // Capabilities & System Toggles
  const [capWebSearch, setCapWebSearch] = useState(true);
  const [capArtifacts, setCapArtifacts] = useState(true);
  const [capCodeExecution, setCapCodeExecution] = useState(true);
  const [capSwitchModels, setCapSwitchModels] = useState(true);
  const [capMemory, setCapMemory] = useState(false);
  const [selectedToolAccess, setSelectedToolAccess] = useState<"auto" | "ondemand" | "always">("auto");
  const [hapticFeedback, setHapticFeedback] = useState(true);

  // Connectors State & Filters
  const [connectorsList, setConnectorsList] = useState(INITIAL_CONNECTORS_DATA);
  const [selectedConnectorDetail, setSelectedConnectorDetail] = useState<any>(null);
  const [connectorsFilter, setConnectorsFilter] = useState("Popular");
  const [connectorsSearch, setConnectorsSearch] = useState("");

  // Projects Form Search State
  const [newProjectName, setNewProjectName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Active Model Helper Object
  const activeModelObj = AI_MODELS_DATA.find(m => m.id === selectedModelId) || AI_MODELS_DATA[0];

  // --------------------------------------------------------------------------
  // HANDLERS & API ACTION HOOKS
  // --------------------------------------------------------------------------

  /**
   * Input Change Handler with '@' and '/' Trigger Logic
   */
  const handleInputChange = (text: string) => {
    setInputText(text);
    if (text.endsWith("@")) {
      setShowMentionsPopup(true);
      setShowSlashPopup(false);
    } else if (text.endsWith("/")) {
      setShowSlashPopup(true);
      setShowMentionsPopup(false);
    } else if (!text.includes("@") && !text.includes("/")) {
      setShowMentionsPopup(false);
      setShowSlashPopup(false);
    }
  };

  /**
   * Handle Selecting @ Mention Tag
   */
  const handleSelectMention = (tag: string) => {
    setInputText(prev => prev + tag + " ");
    setShowMentionsPopup(false);
  };

  /**
   * Handle Selecting / Slash Command
   */
  const handleSelectSlashCommand = (cmd: string) => {
    setInputText(cmd + " ");
    setShowSlashPopup(false);
  };

  /**
   * Resolve the project this chat runs against: the selected one, the first
   * existing project, or a freshly created default project.
   */
  const ensureProjectId = async (): Promise<string> => {
    if (activeProjectId) return activeProjectId;
    const existing =
      projects.find((p) => p.name === activeProjectName) ?? projects[0];
    if (existing) {
      setActiveProjectId(existing.id);
      setActiveProjectName(existing.name);
      return existing.id;
    }
    const created = await createProject({ name: activeProjectName || "My First App", template: "landing" });
    setActiveProjectId(created.id);
    setActiveProjectName(created.name);
    return created.id;
  };

  /** Load the project's files and build the on-device preview document. */
  const loadPreview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const projectId = await ensureProjectId();
      const files = await getProjectFiles(projectId);
      setPreviewHtml(buildPreviewHtml(files));
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewLoading(false);
    }
  };

  // Refresh the preview every time the modal opens.
  useEffect(() => {
    if (showPreviewModal) void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreviewModal]);

  /**
   * Send Message Action — wired to the real backend:
   * agent-run enqueues a job (HTTP 202) → queue-worker executes the Agent Core
   * in the sandbox → progress is polled from agent_tasks (see effect below).
   */
  const handleSend = async () => {
    if (!inputText.trim() || isExecuting) return;

    const userPromptText = inputText.trim();
    const isFirstPrompt = messages.length === 0;

    const userMsg = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: userPromptText,
      createdAt: Date.now(),
      isIncognito,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setShowMentionsPopup(false);
    setShowSlashPopup(false);

    if (isIncognito) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_agent_${Date.now()}`,
          role: "assistant",
          content:
            "Incognito mode is not connected to the agent backend yet — turn it off to run the agent.",
          createdAt: Date.now(),
          isIncognito,
        },
      ]);
      return;
    }

    if (isFirstPrompt) setThreadTitle(userPromptText.slice(0, 48));
    setIsExecuting(true);

    try {
      const projectId = await ensureProjectId();
      runStartedAtRef.current = new Date().toISOString();
      const res = await agentService.startAgentRun(projectId, userPromptText, {
        title: userPromptText.slice(0, 48),
        sessionId: activeSessionId ?? undefined,
      });
      setActiveSessionId(res.session_id);
    } catch (e) {
      setIsExecuting(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          role: "assistant",
          content: `⚠️ Failed to start the agent: ${e instanceof Error ? e.message : String(e)}`,
          createdAt: Date.now(),
        },
      ]);
    }
  };

  /**
   * Poll agent_tasks while a job is executing. Each tool call renders as a
   * live "tool_run" step; the terminal "agent-run" row carries the final text
   * (or the error) and ends the run. Polling works in both local-guest mode
   * (no RLS-visible rows for Realtime) and production.
   */
  useEffect(() => {
    if (!activeSessionId || !isExecuting) return;
    let cancelled = false;

    const tick = async () => {
      let tasks: AgentTaskData[];
      try {
        tasks = await agentService.getSessionTasks(activeSessionId);
      } catch {
        return; // transient fetch error — keep polling
      }
      if (cancelled) return;

      const since = runStartedAtRef.current;
      const fresh = tasks.filter((t) => !since || t.created_at >= since);

      const steps = fresh
        .filter((t) => t.tool_name !== "agent-run")
        .map((t) => ({
          type: "tool_run",
          tool: t.tool_name,
          status: t.status === "success" ? "completed" : t.status,
          errorCount: t.status === "failed" ? 1 : undefined,
        }));

      const execId = `exec_${since ?? activeSessionId}`;
      setMessages((prev) => {
        const withoutExec = prev.filter((m) => m.id !== execId);
        if (steps.length === 0) return withoutExec;
        return [
          ...withoutExec,
          { id: execId, role: "assistant", content: "", createdAt: Date.now(), steps },
        ];
      });

      const runRow = [...fresh].reverse().find((t) => t.tool_name === "agent-run");
      if (runRow && (runRow.status === "success" || runRow.status === "failed")) {
        if (runRow.status === "success") {
          // Last snapshot may still show steps as "running" — the run is over,
          // so settle every non-failed step to completed.
          setMessages((prev) =>
            prev.map((m) =>
              m.id === execId
                ? {
                    ...m,
                    steps: (m.steps ?? []).map((s: any) =>
                      s.status === "failed" ? s : { ...s, status: "completed" },
                    ),
                  }
                : m,
            ),
          );
        }
        const finalText =
          runRow.status === "success"
            ? String(runRow.tool_output?.final_text ?? "Done.")
            : `⚠️ Agent run failed: ${String(runRow.tool_output?.error ?? "unknown error")}`;
        const touchedWorkspace = fresh.some((t) =>
          ["write", "edit", "apply_patch", "bash"].includes(t.tool_name),
        );
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_agent_${Date.now()}`,
            role: "assistant",
            content: finalText,
            createdAt: Date.now(),
            hasCodeEdit: runRow.status === "success" && touchedWorkspace,
          },
        ]);
        setIsExecuting(false);
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    };

    void tick();
    const interval = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeSessionId, isExecuting]);

  /**
   * Toggle Incognito State (Clears active thread memory for privacy)
   */
  const handleToggleIncognito = () => {
    const nextIncognitoState = !isIncognito;
    setIsIncognito(nextIncognitoState);
    if (nextIncognitoState) {
      setMessages([]);
      setThreadTitle("");
    }
  };

  /**
   * Connector Connect / Disconnect Action
   * BACKEND INTEGRATION: Call `POST /api/connectors/:id/toggle` or trigger OAuth flow.
   * Special case for `skillsh`: Executes `npx skills add` CLI in backend.
   */
  const handleToggleConnectorConnection = (connId: string) => {
    setConnectorsList(prev => prev.map(item => {
      if (item.id === connId) {
        const nextState = !item.connected;
        if (selectedConnectorDetail?.id === connId) {
          setSelectedConnectorDetail({ ...selectedConnectorDetail, connected: nextState });
        }
        return { ...item, connected: nextState };
      }
      return item;
    }));
  };

  // Open Projects Sheet from Drawer
  const handleOpenProjectsFromDrawer = () => {
    setShowDrawerModal(false);
    setShowProjectsModal(true);
  };

  // Open Connectors Sheet from Drawer
  const handleOpenConnectorsFromDrawer = () => {
    setShowDrawerModal(false);
    setSelectedConnectorDetail(null);
    setShowConnectorsModal(true);
  };

  // Open Master Profile Settings from Drawer
  const handleOpenProfileFromDrawer = () => {
    setShowDrawerModal(false);
    setProfileSubScreen("main");
    setShowProfileModal(true);
  };

  /**
   * OPEN PROJECT FOLDER (SHOW CONVERSATIONS LIST)
   * When user taps "Open" on a project or clicks a project folder:
   * 1. Sets activeProjectName to that project.
   * 2. Clears active messages so the Project Conversations List View is rendered.
   * 3. User can pick an existing conversation card OR type in the bottom input to create a new thread.
   */
  const handleOpenProjectFolder = (projectName: string) => {
    setShowDrawerModal(false);
    setIsIncognito(false);
    setActiveProjectName(projectName);
    setMessages([]); // Shows Project Conversations List View
  };

  /**
   * LOAD SPECIFIC CHAT SESSION UNDER A PROJECT
   * BACKEND INTEGRATION: Call `GET /api/sessions/:sessionId/messages`
   */
  const handleLoadSession = (session: any, projectName?: string) => {
    setShowDrawerModal(false);
    setIsIncognito(false);
    if (projectName) {
      setActiveProjectName(projectName);
    }
    setThreadTitle(session.title);

    const userMsg = {
      id: `msg_user_${session.id}`,
      role: "user",
      content: session.title,
      createdAt: Date.now() - 7200000,
    };

    const assistantMsg = {
      id: `msg_agent_${session.id}`,
      role: "assistant",
      content: `Loaded previous conversation for **"${session.title}"** inside **${projectName || activeProjectName || "Retro Code"}**.\n\nI am ready to continue building. What's the next step?`,
      createdAt: Date.now() - 7199000,
      hasCodeEdit: true,
      checkpointHash: "e5509a3",
      steps: [
        { type: "command", cmd: "git status", status: "completed" },
        { type: "thought", text: `Restored context for thread "${session.title}".` },
        { type: "text", text: `Thread context restored. Any new input will be appended to this thread in ${projectName || activeProjectName || "Retro Code"}.` }
      ]
    };

    setMessages([userMsg, assistantMsg]);
  };

  /**
   * Create New Project Action — creates the project via projects-create and
   * seeds it with the selected starter template.
   */
  const handleCreateNewProject = async () => {
    if (!newProjectName.trim() || isCreatingProject) return;
    setIsCreatingProject(true);
    try {
      const created = await createProject({ name: newProjectName.trim(), template: newProjectTemplate });
      setActiveProjectId(created.id);
      setActiveProjectName(created.name);
      setThreadTitle(created.name);
      setActiveSessionId(null);
      runStartedAtRef.current = null;
      setMessages([]);
      setNewProjectName("");
      setIsIncognito(false);
      setShowNewProjectModal(false);
      setShowProjectsModal(false);
      // Show the fresh template right away — instant gratification.
      setShowPreviewModal(true);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          role: "assistant",
          content: `⚠️ Failed to create the project: ${e instanceof Error ? e.message : String(e)}`,
          createdAt: Date.now(),
        },
      ]);
      setShowNewProjectModal(false);
    } finally {
      setIsCreatingProject(false);
    }
  };

  /**
   * Reset to New Blank Chat Session
   */
  const handleNewChat = () => {
    setShowDrawerModal(false);
    setMessages([]);
    setThreadTitle("");
    setInputText("");
    setIsExecuting(false);
    setActiveSessionId(null);
    runStartedAtRef.current = null;
  };

  const isChatActive = messages.length > 0;
  const hasInputText = inputText.trim().length > 0;

  return (
    <SafeAreaView style={{ backgroundColor: bgCanvas }} className="flex-1">
      
      {/* =================================================================== */}
      {/* 1. TOP HEADER (LIGHT MODE & CLAUDE PARITY READY)                   */}
      {/* =================================================================== */}
      {!isChatActive ? (
        /* INITIAL HEADER STATE (Profile button, Segmented Chat/Build mode, Incognito Ghost) */
        <View style={{ backgroundColor: bgCanvas, zIndex: 50, elevation: 10 }} className="flex-row items-center justify-between px-4 py-3 z-50">
          
          {/* Profile Avatar / Drawer Trigger */}
          <TouchableOpacity 
            onPress={() => setShowDrawerModal(true)}
            style={{ backgroundColor: isLight ? "#FFFFFF" : bgCard, borderColor: isLight ? "#E2E8F0" : "rgba(255,255,255,0.1)" }}
            className="w-10 h-10 rounded-full items-center justify-center border shadow-sm"
            activeOpacity={0.8}
          >
            <VectorIcon name="user" size={16} color={isLight ? "#0F172A" : "#D4D4D8"} />
          </TouchableOpacity>

          {/* Mode Switcher: Chat (Q&A) vs Build (AI Agent IDE Workspace) (Crisp white pill with light border) */}
          {isIncognito ? (
            <Text className="text-zinc-400 text-sm font-medium">Incognito chat</Text>
          ) : (
            <View style={{ backgroundColor: isLight ? "#FFFFFF" : "#141414", borderColor: isLight ? "#E2E8F0" : "transparent" }} className="flex-row items-center p-1 rounded-full border shadow-sm">
              <TouchableOpacity
                onPress={() => setActiveMode("chat")}
                style={{ backgroundColor: activeMode === "chat" ? (isLight ? "#F1F5F9" : "#242424") : "transparent" }}
                className="flex-row items-center px-4 py-1.5 rounded-full"
                activeOpacity={0.8}
              >
                <VectorIcon name="search" size={12} color={activeMode === "chat" ? "#38BDF8" : (isLight ? "#64748B" : "#9CA3AF")} style={{ marginRight: 6 }} />
                <Text style={{ color: activeMode === "chat" ? (isLight ? "#0F172A" : "#FFFFFF") : (isLight ? "#64748B" : "#9CA3AF") }} className="text-xs font-semibold">
                  Chat
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveMode("build")}
                style={{ backgroundColor: activeMode === "build" ? (isLight ? "#F1F5F9" : "#242424") : "transparent" }}
                className="flex-row items-center px-4 py-1.5 rounded-full"
                activeOpacity={0.8}
              >
                <VectorIcon name="code" size={12} color={activeMode === "build" ? "#C084FC" : (isLight ? "#64748B" : "#9CA3AF")} style={{ marginRight: 6 }} />
                <Text style={{ color: activeMode === "build" ? (isLight ? "#0F172A" : "#FFFFFF") : (isLight ? "#64748B" : "#9CA3AF") }} className="text-xs font-semibold">
                  Build
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Top-Right Incognito Toggle Button (👻 Ghost Icon) */}
          <TouchableOpacity 
            onPress={handleToggleIncognito}
            style={{ backgroundColor: isIncognito ? (isLight ? "#F3E8FF" : "rgba(59, 7, 100, 0.9)") : (isLight ? "#FFFFFF" : "#141414"), borderColor: isLight ? "#E2E8F0" : "transparent" }}
            className="w-10 h-10 rounded-full items-center justify-center border shadow-sm transition-all"
            activeOpacity={0.8}
          >
            <VectorIcon name="ghost" size={18} color={isIncognito ? "#A855F7" : (isLight ? "#0F172A" : "#A1A1AA")} />
          </TouchableOpacity>

        </View>
      ) : (
        /* ACTIVE THREAD HEADER STATE */
        <View style={{ backgroundColor: bgCanvas, zIndex: 50, elevation: 10 }} className="flex-row items-center justify-between px-4 py-3 z-50">
          
          <View className="flex-row items-center flex-1 mr-2">
            <TouchableOpacity 
              onPress={() => setShowDrawerModal(true)}
              style={{ backgroundColor: isLight ? "#FFFFFF" : bgCard, borderColor: isLight ? "#E2E8F0" : "rgba(255,255,255,0.1)" }}
              className="w-9 h-9 rounded-full items-center justify-center mr-3 border shadow-sm"
              activeOpacity={0.8}
            >
              <Text style={{ color: textPrimary }} className="text-sm">☰</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setShowDrawerModal(true)}
              className="flex-row items-center flex-1" 
              activeOpacity={0.8}
            >
              <Text style={{ color: textPrimary }} className="text-sm font-semibold text-left mr-1" numberOfLines={1}>
                {isIncognito ? "Incognito Chat" : (threadTitle || "Fix the login flow redirect issue")}
              </Text>
              <VectorIcon name="chevron-down" size={10} color={isLight ? "#64748B" : "#71717A"} />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center">
            <TouchableOpacity 
              onPress={handleToggleIncognito}
              style={{ backgroundColor: isIncognito ? (isLight ? "#F3E8FF" : "rgba(59, 7, 100, 0.9)") : (isLight ? "#FFFFFF" : "#141414"), borderColor: isLight ? "#E2E8F0" : "transparent" }}
              className="w-9 h-9 rounded-full items-center justify-center mr-2 border shadow-sm"
              activeOpacity={0.8}
            >
              <VectorIcon name="ghost" size={16} color={isIncognito ? "#A855F7" : (isLight ? "#0F172A" : "#A1A1AA")} />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleNewChat}
              style={{ backgroundColor: isLight ? "#FFFFFF" : "#141414", borderColor: isLight ? "#E2E8F0" : "transparent" }}
              className="w-9 h-9 rounded-full items-center justify-center border shadow-sm"
              activeOpacity={0.8}
            >
              <VectorIcon name="edit" size={14} color={isLight ? "#0F172A" : "#E4E4E7"} />
            </TouchableOpacity>
          </View>

        </View>
      )}

      {/* =================================================================== */}
      {/* 2. MAIN CENTER STREAM CANVAS                                        */}
      {/* =================================================================== */}
      <View style={{ backgroundColor: bgCanvas }} className="flex-1 relative">
        
        {!isChatActive ? (
          isIncognito ? (
            /* INCOGNITO MODE ZERO-STATE CANVAS */
            <View className="flex-1 items-center justify-center px-6">
              <View style={{ backgroundColor: bgCard }} className="w-20 h-20 rounded-3xl items-center justify-center mb-6 shadow-2xl border border-slate-200/40">
                <VectorIcon name="ghost" size={40} color="#C084FC" />
              </View>

              <Text style={{ color: textPrimary }} className="text-base font-semibold text-center mb-2 leading-6">
                Incognito chats aren't saved or used to train models.
              </Text>

              <TouchableOpacity activeOpacity={0.7}>
                <Text style={{ color: textSecondary }} className="text-xs text-center underline">
                  Learn more <Text style={{ color: textSecondary }} className="text-xs">about how your data is used.</Text>
                </Text>
              </TouchableOpacity>
            </View>
          ) : activeProjectName ? (
            /* PROJECT CONVERSATIONS LIST CANVAS (MATCHING USER SCREENSHOT) */
            <ScrollView className="flex-1 px-5 py-4" contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
              {/* Active Project Banner Header */}
              <View style={{ backgroundColor: isLight ? "#FFFFFF" : "#121214", borderColor: isLight ? "#E2E8F0" : "rgba(39, 39, 42, 0.6)" }} className="flex-row items-center justify-between mb-5 p-4 rounded-2xl border shadow-sm">
                <View className="flex-row items-center flex-1 mr-2">
                  <VectorIcon name="folder" size={22} color="#F59E0B" style={{ marginRight: 12 }} />
                  <View className="flex-1">
                    <Text style={{ color: textPrimary }} className="text-base font-bold text-left" numberOfLines={1}>{activeProjectName}</Text>
                    <Text style={{ color: textSecondary }} className="text-xs text-left">Select a conversation or type below for a new thread</Text>
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={() => {
                    setActiveProjectName("");
                    setThreadTitle("");
                  }}
                  style={{ backgroundColor: isLight ? "#F1F5F9" : "#1F1F24" }}
                  className="px-3 py-1.5 rounded-full active:opacity-80"
                >
                  <Text style={{ color: textPrimary }} className="text-xs font-semibold">Change</Text>
                </TouchableOpacity>
              </View>

              {/* Section Header */}
              <Text style={{ color: textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-3 px-1">
                Recent Conversations ({activeProjectName})
              </Text>

              {/* List of Previous Conversations for this Project */}
              <View className="space-y-3">
                {([
                  { id: "p-s-1", title: "Fix the login flow redirect issue", time: "2 hr ago", prBadge: "1 merged", badgeType: "purple" },
                  { id: "p-s-2", title: "Can you refactor this component to use hooks?", time: "15min ago", prBadge: "2 open", badgeType: "blue" },
                  { id: "p-s-3", title: "Write unit tests for the notification module", time: "45hr ago", prBadge: "3 merged", badgeType: "purple" },
                  { id: "p-s-4", title: "Implement drag and drop for the kanban board", time: "1hr ago", prBadge: "3 merged", badgeType: "purple" },
                  { id: "p-s-5", title: "Update the onboarding carousel copy", time: "2hr ago", prBadge: "2 open", badgeType: "blue" }
                ]).map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handleLoadSession(item, activeProjectName)}
                    style={{ backgroundColor: isLight ? "#FFFFFF" : "#141414", borderColor: isLight ? "#E2E8F0" : "rgba(39, 39, 42, 0.4)" }}
                    className="mb-3 p-4 rounded-2xl border active:opacity-80 shadow-sm"
                  >
                    <Text style={{ color: textPrimary }} className="text-sm font-semibold mb-2 text-left" numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View className="flex-row items-center justify-between">
                      <Text style={{ color: textSecondary }} className="text-xs">{item.time} · PRs</Text>
                      <View className={`px-2.5 py-0.5 rounded-full ${
                        item.badgeType === "purple" ? (isLight ? "bg-purple-100" : "bg-purple-950/90") :
                        item.badgeType === "blue" ? (isLight ? "bg-sky-100" : "bg-blue-950/90") : (isLight ? "bg-slate-100" : "bg-zinc-800")
                      }`}>
                        <Text className={`text-xs font-semibold ${
                          item.badgeType === "purple" ? (isLight ? "text-purple-700" : "text-purple-300") :
                          item.badgeType === "blue" ? (isLight ? "text-sky-700" : "text-blue-300") : (isLight ? "text-slate-600" : "text-zinc-400")
                        }`}>
                          {item.prBadge}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          ) : (
            /* PURE WHITE LIGHT MODE WATERMARK CANVAS */
            <View className="flex-1 items-center justify-center select-none px-4 pb-28">
              <View className="flex-row items-baseline justify-center mb-2">
                <Text 
                  style={{ 
                    fontSize: 28, 
                    fontWeight: isLight ? "600" : "300", 
                    color: isLight ? "#0F172A" : "#3F3F46", 
                    fontFamily: "'Inter', 'SF Pro Display', sans-serif",
                    letterSpacing: -1
                  } as any}
                >
                  retro code
                </Text>
                <Text 
                  style={{ 
                    fontSize: 22, 
                    fontWeight: isLight ? "700" : "400", 
                    color: isLight ? "#C084FC" : "#27272A", 
                    fontFamily: "'Inter', 'SF Pro Display', sans-serif",
                    marginLeft: 6
                  } as any}
                >
                  pro
                </Text>
              </View>

              <Text 
                style={{ 
                  fontSize: 10, 
                  fontWeight: "600", 
                  color: isLight ? "#94A3B8" : "#27272A", 
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  opacity: 0.8
                } as any}
              >
                {activeMode === "build" ? "AI AGENT CODING & BUILDER SPACE" : "CHAT & QA WORKSPACE"}
              </Text>
            </View>
          )
        ) : (
          /* ACTIVE STREAM CONVERSATION MESSAGES */
          <ScrollView 
            ref={scrollViewRef}
            className="flex-1 px-4 py-3"
            contentContainerStyle={{ paddingBottom: 160 }}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg) => {
              const isUser = msg.role === "user";

              if (isUser) {
                return (
                  <View key={msg.id} className="mb-6 flex-row justify-end">
                    <View style={{ backgroundColor: isLight ? "#F1F5F9" : "#231B32", borderColor: isLight ? "#E2E8F0" : "transparent" }} className="max-w-[92%] p-4 rounded-3xl border shadow-sm">
                      <Text style={{ color: textPrimary }} className="text-sm leading-6 text-left font-sans font-medium">
                        {msg.content}
                      </Text>
                    </View>
                  </View>
                );
              }

              /* Assistant Response Component Stream */
              return (
                <View key={msg.id} className="mb-6">
                  {msg.content && (
                    <Text style={{ color: textPrimary }} className="text-sm leading-6 text-left mb-3 font-sans">
                      {msg.content}
                    </Text>
                  )}

                  {/* Render Execution Steps (Commands, Diffs, Tool Runs) */}
                  {msg.steps?.map((step: any, sIdx: number) => {
                    if (step.type === "command") {
                      return (
                        <View key={sIdx} className="flex-row items-center justify-between py-2 my-1">
                          <View className="flex-row items-center flex-1 mr-2">
                            <VectorIcon name="terminal" size={12} color={isLight ? "#64748B" : "#A1A1AA"} style={{ marginRight: 6 }} />
                            <Text style={{ color: textSecondary }} className="text-xs font-mono mr-1">Command</Text>
                            <Text style={{ color: textPrimary }} className="text-xs font-mono font-medium" numberOfLines={1}>
                              {step.cmd}
                            </Text>
                          </View>
                          <View style={{ backgroundColor: isLight ? "#D1FAE5" : "#054030" }} className="px-2.5 py-1 rounded-md">
                            <Text style={{ color: isLight ? "#059669" : "#34D399" }} className="text-[11px] font-medium font-mono">completed &gt;</Text>
                          </View>
                        </View>
                      );
                    }

                    if (step.type === "thought") {
                      return (
                        <Text key={sIdx} style={{ color: isLight ? "#64748B" : "#9E99B0" }} className="text-xs italic leading-5 my-2 text-left pl-1">
                          {step.text}
                        </Text>
                      );
                    }

                    if (step.type === "text") {
                      return (
                        <Text key={sIdx} style={{ color: textPrimary }} className="text-sm leading-6 text-left my-2 font-sans">
                          {step.text}
                        </Text>
                      );
                    }

                    /* File Modification Step -> Triggers Interactive Diff Viewer Modal */
                    if (step.type === "file_edit") {
                      return (
                        <TouchableOpacity
                          key={sIdx}
                          onPress={() => {
                            setSelectedDiffFile(step);
                            setShowDiffModal(true);
                          }}
                          style={{ backgroundColor: isLight ? "#F1F5F9" : "#181524", borderColor: isLight ? "#E2E8F0" : "transparent" }}
                          className="flex-row items-center justify-between py-2.5 px-3.5 my-1.5 rounded-xl border shadow-sm"
                          activeOpacity={0.8}
                        >
                          <View className="flex-row items-center">
                            <VectorIcon name="code" size={14} color="#10B981" style={{ marginRight: 6 }} />
                            <Text style={{ color: textSecondary }} className="text-xs font-mono mr-2">
                              {step.editsCount} edits to
                            </Text>
                            <View style={{ backgroundColor: isLight ? "#E2E8F0" : "#241D35" }} className="px-1.5 py-0.5 rounded mr-2">
                              <Text style={{ color: "#D97706" }} className="text-[10px] font-mono font-bold">{step.ext}</Text>
                            </View>
                            <Text style={{ color: textPrimary }} className="text-xs font-mono font-semibold">{step.file}</Text>
                          </View>

                          <View className="flex-row items-center">
                            <Text style={{ color: "#16A34A" }} className="text-xs font-mono font-bold mr-2">
                              +{step.additions}
                            </Text>
                            <Text style={{ color: "#DC2626" }} className="text-xs font-mono font-bold mr-2">
                              -{step.deletions}
                            </Text>
                            <VectorIcon name="arrow-right" size={12} color={isLight ? "#6D42C7" : "#A855F7"} />
                          </View>
                        </TouchableOpacity>
                      );
                    }

                    if (step.type === "tool_run") {
                      const isFailed = step.status === "failed";
                      const isDone = step.status === "completed";
                      const badgeBg = isFailed
                        ? (isLight ? "#FEE2E2" : "#7F1D1D")
                        : isDone
                          ? (isLight ? "#DCFCE7" : "#14532D")
                          : (isLight ? "#FEF3C7" : "#78350F");
                      const badgeFg = isFailed
                        ? (isLight ? "#DC2626" : "#FCA5A5")
                        : isDone
                          ? (isLight ? "#16A34A" : "#86EFAC")
                          : (isLight ? "#D97706" : "#FCD34D");
                      const badgeLabel = isFailed
                        ? `${step.errorCount ?? 1} failed >`
                        : isDone
                          ? "done"
                          : "running…";
                      return (
                        <View key={sIdx} className="flex-row items-center justify-between py-2 my-1">
                          <View className="flex-row items-center">
                            <VectorIcon name="tool" size={13} color={isLight ? "#64748B" : "#A1A1AA"} style={{ marginRight: 6 }} />
                            <Text style={{ color: textSecondary }} className="text-xs font-mono">{step.tool}</Text>
                          </View>

                          <View style={{ backgroundColor: badgeBg }} className="px-2.5 py-1 rounded-md flex-row items-center">
                            <Text style={{ color: badgeFg }} className="text-[11px] font-mono font-medium mr-1">
                              {badgeLabel}
                            </Text>
                          </View>
                        </View>
                      );
                    }

                    return null;
                  })}

                  {/* IN-STREAM ACTIONS: LIVE APP PREVIEW & GIT CHECKPOINT ROLLBACK BUTTONS */}
                  {msg.hasCodeEdit && (
                    <View className="flex-row items-center mt-3 pt-3 space-x-2">
                      {/* Live App Sandbox Runner Button */}
                      <TouchableOpacity
                        onPress={() => setShowPreviewModal(true)}
                        style={{ backgroundColor: isLight ? "#E6F4EA" : "rgba(6, 78, 59, 0.8)", borderColor: isLight ? "#A7F3D0" : "transparent" }}
                        className="px-3.5 py-2 rounded-xl flex-row items-center active:opacity-80 mr-2 border shadow-sm"
                        activeOpacity={0.8}
                      >
                        <VectorIcon name="eye" size={14} color={isLight ? "#16A34A" : "#34D399"} style={{ marginRight: 6 }} />
                        <Text style={{ color: isLight ? "#15803D" : "#34D399" }} className="text-xs font-bold mr-1.5">Preview App</Text>
                        <VectorIcon name="arrow-right" size={12} color={isLight ? "#16A34A" : "#34D399"} />
                      </TouchableOpacity>

                      {/* Targeted Git Checkpoint Rollback Button (only when a real checkpoint exists) */}
                      {msg.checkpointHash && (
                        <TouchableOpacity
                          onPress={() => setShowCheckpointsModal(true)}
                          style={{ backgroundColor: isLight ? "#F1F5F9" : "#1C1C1C", borderColor: isLight ? "#E2E8F0" : "transparent" }}
                          className="px-3.5 py-2 rounded-xl flex-row items-center active:opacity-80 border shadow-sm"
                          activeOpacity={0.8}
                        >
                          <VectorIcon name="rotate-ccw" size={13} color={isLight ? "#6D42C7" : "#C084FC"} style={{ marginRight: 6 }} />
                          <Text style={{ color: textPrimary }} className="text-xs font-semibold mr-1">Checkpoint ({msg.checkpointHash})</Text>
                          <Text style={{ color: isLight ? "#6D42C7" : "#C084FC" }} className="text-xs font-mono font-bold">Rollback</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                </View>
              );
            })}
            {/* Executing Status Indicator */}
            {isExecuting && (
              <View className="flex-row items-center my-3 p-3 bg-[#111111] rounded-xl">
                <View className="w-2 h-2 rounded-full bg-violet-500 animate-ping mr-2" />
                <Text className="text-violet-300 text-xs">Thinking & running tools...</Text>
              </View>
            )}

          </ScrollView>
        )}

        {/* =================================================================== */}
        {/* 3. CLAUDE AI STYLE FLOATING INPUT CARD                              */}
        {/* =================================================================== */}
        <View 
          style={{ 
            backgroundColor: bgCard, 
            borderColor: isLight ? "#EAE6DF" : "transparent"
          }} 
          className="absolute bottom-4 left-3 right-3 p-3 rounded-3xl border shadow-2xl"
        >

          {/* FLOATING '@ MENTIONS' POPUP SELECTOR CARD */}
          {showMentionsPopup && (
            <View style={{ backgroundColor: isLight ? "#F2EFEA" : "#1C1C1E" }} className="mb-2 p-2 rounded-2xl shadow-2xl">
              <Text className="text-purple-500 text-[11px] font-mono px-2 py-1">@ Context Mentions</Text>
              {[
                { tag: "@file", label: "File (Attach specific code file)", icon: "file-text" },
                { tag: "@folder", label: "Folder (Attach workspace directory)", icon: "folder" },
                { tag: "@terminal", label: "Terminal (Attach command output logs)", icon: "terminal" },
                { tag: "@web", label: "Web (Attach live search result)", icon: "globe" }
              ].map(item => (
                <TouchableOpacity
                  key={item.tag}
                  onPress={() => handleSelectMention(item.tag)}
                  style={{ backgroundColor: isLight ? "#FFFFFF" : "transparent" }}
                  className="flex-row items-center p-2 rounded-xl active:opacity-80 my-0.5"
                >
                  <VectorIcon name={item.icon} size={14} color="#C084FC" style={{ marginRight: 8 }} />
                  <Text className="text-purple-600 text-xs font-mono font-bold mr-2">{item.tag}</Text>
                  <Text style={{ color: textSecondary }} className="text-xs flex-1 text-left">{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* FLOATING '/ SLASH COMMANDS' POPUP SELECTOR CARD */}
          {showSlashPopup && (
            <View style={{ backgroundColor: isLight ? "#F2EFEA" : "#1C1C1E" }} className="mb-2 p-2 rounded-2xl shadow-2xl">
              <Text className="text-sky-500 text-[11px] font-mono px-2 py-1">/ Agent Commands</Text>
              {[
                { cmd: "/plan", label: "Create step-by-step implementation plan", icon: "sparkles" },
                { cmd: "/refactor", label: "Refactor & clean up code structure", icon: "zap" },
                { cmd: "/test", label: "Generate automated unit tests", icon: "check" },
                { cmd: "/debug", label: "Investigate and fix error stack traces", icon: "code" }
              ].map(item => (
                <TouchableOpacity
                  key={item.cmd}
                  onPress={() => handleSelectSlash(item.cmd)}
                  style={{ backgroundColor: isLight ? "#FFFFFF" : "transparent" }}
                  className="flex-row items-center p-2 rounded-xl active:opacity-80 my-0.5"
                >
                  <VectorIcon name={item.icon} size={14} color="#38BDF8" style={{ marginRight: 8 }} />
                  <Text className="text-sky-600 text-xs font-mono font-bold mr-2">{item.cmd}</Text>
                  <Text style={{ color: textSecondary }} className="text-xs flex-1 text-left">{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TextInput
            value={inputText}
            onChangeText={handleInputChange}
            onSubmitEditing={handleSend}
            placeholder={isIncognito ? "Chat in Incognito mode..." : (activeMode === "build" ? "Ask or build... (Type @ for files, / for commands)" : "Ask anything...")}
            placeholderTextColor={isLight ? "#8C877D" : "#71717A"}
            className="w-full bg-transparent px-2 py-1 text-sm text-left mb-3 font-sans"
            style={{ color: textPrimary, outlineStyle: "none", outlineWidth: 0 } as any}
            multiline
          />

          {/* Clean Controls Layout */}
          <View className="flex-row items-center justify-between pt-1">
            
            <View className="flex-row items-center">
              
              {/* '+' BUTTON OPENS 'Add to Chat' BOTTOM SHEET MODAL */}
              <TouchableOpacity 
                onPress={() => setShowAddToChatModal(true)}
                style={{ backgroundColor: isLight ? "#FFFFFF" : "#242424", borderColor: isLight ? "#E2E8F0" : "transparent" }}
                className="w-8 h-8 rounded-full items-center justify-center mr-2 border shadow-sm active:opacity-80"
                activeOpacity={0.8}
              >
                <VectorIcon name="plus" size={16} color={isLight ? "#0F172A" : "#D4D4D8"} />
              </TouchableOpacity>

              {/* Model & Thinking Switcher Pill */}
              <TouchableOpacity
                onPress={() => setShowModelsModal(true)}
                style={{ backgroundColor: isLight ? "#FFFFFF" : "#242424", borderColor: isLight ? "#E2E8F0" : "transparent" }}
                className="flex-row items-center px-3.5 py-1.5 rounded-full border shadow-sm active:opacity-80"
                activeOpacity={0.8}
              >
                <VectorIcon name={activeModelObj.icon} size={12} color={activeModelObj.color} style={{ marginRight: 6 }} />
                <Text style={{ color: textPrimary }} className="text-xs font-semibold mr-1.5">
                  {selectedModelId === "auto" ? "Auto" : isThinkingEnabled ? "Thinking" : activeModelObj.name}
                </Text>
                <VectorIcon name="chevron-down" size={10} color={isLight ? "#64748B" : "#71717A"} />
              </TouchableOpacity>

            </View>

            <View className="flex-row items-center">
              
              {isIncognito && (
                <View className="px-2.5 py-1 bg-purple-950/80 rounded-full mr-2 flex-row items-center">
                  <VectorIcon name="ghost" size={12} color="#C084FC" style={{ marginRight: 4 }} />
                  <Text className="text-purple-300 text-[10px] font-mono">Incognito</Text>
                </View>
              )}

              {/* Action Button (Mic / Audio) */}
              <TouchableOpacity
                style={{ backgroundColor: isLight ? "#FFFFFF" : "#242424", borderColor: isLight ? "#E2E8F0" : "transparent" }}
                className="w-9 h-9 rounded-full items-center justify-center mr-2 border shadow-sm active:opacity-80"
                activeOpacity={0.8}
              >
                <VectorIcon name="mic" size={15} color={isLight ? "#0F172A" : "#D4D4D8"} />
              </TouchableOpacity>

              {/* Send Button (Dark circle) */}
              <TouchableOpacity
                onPress={handleSend}
                disabled={!hasInputText}
                style={{
                  backgroundColor: hasInputText ? "#6D42C7" : (isLight ? "#0F172A" : "#262626"),
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 1
                }}
                activeOpacity={0.8}
              >
                <VectorIcon 
                  name={hasInputText ? "arrow-up" : "arrow-up"} 
                  size={16} 
                  color="#FFFFFF" 
                />
              </TouchableOpacity>

            </View>
          </View>
        </View>
      </View>

      {/* =================================================================== */}
      {/* 4. MODAL 1: ADD TO CHAT BOTTOM SHEET (EXACT CLAUDE/PERPLEXITY PARITY) */}
      {/* =================================================================== */}
      <Modal
        visible={showAddToChatModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddToChatModal(false)}
      >
        <View className="flex-1 justify-end bg-black/80">
          <View style={{ backgroundColor: bgCard, borderColor: isLight ? "#EAE6DF" : "transparent" }} className="rounded-t-[32px] p-5 pb-8 relative shadow-2xl border">
            
            <View className="items-center mb-4">
              <View className="w-12 h-1.5 bg-zinc-400 rounded-full opacity-60" />
            </View>

            <View className="flex-row items-center justify-between mb-5 px-1">
              <TouchableOpacity 
                onPress={() => setShowAddToChatModal(false)}
                style={{ backgroundColor: isLight ? "#EAE6DF" : "#222222" }}
                className="w-9 h-9 rounded-full items-center justify-center"
                activeOpacity={0.8}
              >
                <VectorIcon name="x" size={14} color={isLight ? "#1E1D1A" : "#D4D4D8"} />
              </TouchableOpacity>
              
              <Text style={{ color: textPrimary }} className="text-base font-bold">Add to chat</Text>
              <View className="w-9" />
            </View>

            <View className="flex-row justify-between mb-6">
              <TouchableOpacity style={{ backgroundColor: isLight ? "#F7F4EF" : "#1E1E1E" }} className="w-[31%] py-5 rounded-2xl items-center justify-center active:opacity-80 shadow-sm border border-black/5">
                <View style={{ backgroundColor: isLight ? "#EAE6DF" : "#2B2B2B" }} className="w-11 h-11 rounded-full items-center justify-center mb-2">
                  <VectorIcon name="camera" size={20} color={isLight ? "#1E1D1A" : "#E4E4E7"} />
                </View>
                <Text style={{ color: textPrimary }} className="text-xs font-semibold">Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={{ backgroundColor: isLight ? "#F7F4EF" : "#1E1E1E" }} className="w-[31%] py-5 rounded-2xl items-center justify-center active:opacity-80 shadow-sm border border-black/5">
                <View style={{ backgroundColor: isLight ? "#EAE6DF" : "#2B2B2B" }} className="w-11 h-11 rounded-full items-center justify-center mb-2">
                  <VectorIcon name="image" size={20} color={isLight ? "#1E1D1A" : "#E4E4E7"} />
                </View>
                <Text style={{ color: textPrimary }} className="text-xs font-semibold">Photos</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => {
                  setShowAddToChatModal(false);
                  setShowFileModal(true);
                }}
                style={{ backgroundColor: isLight ? "#F7F4EF" : "#1E1E1E" }}
                className="w-[31%] py-5 rounded-2xl items-center justify-center active:opacity-80 shadow-sm border border-black/5"
              >
                <View style={{ backgroundColor: isLight ? "#EAE6DF" : "#2B2B2B" }} className="w-11 h-11 rounded-full items-center justify-center mb-2">
                  <VectorIcon name="file-text" size={20} color={isLight ? "#1E1D1A" : "#E4E4E7"} />
                </View>
                <Text style={{ color: textPrimary }} className="text-xs font-semibold">Files</Text>
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: isLight ? "#F7F4EF" : "#1C1C1C" }} className="rounded-2xl overflow-hidden mb-2 border border-black/5">
              <View className="flex-row items-center justify-between p-4">
                <View className="flex-row items-center">
                  <View style={{ backgroundColor: isLight ? "#EAE6DF" : "#2B2B2B" }} className="w-9 h-9 rounded-full items-center justify-center mr-3">
                    <VectorIcon name="globe" size={16} color="#38BDF8" />
                  </View>
                  <Text style={{ color: textPrimary }} className="text-sm font-semibold">Web search</Text>
                </View>
                <Switch
                  value={capWebSearch}
                  onValueChange={setCapWebSearch}
                  trackColor={{ false: "#3F3F46", true: "#38BDF8" }}
                  thumbColor={capWebSearch ? "#FFFFFF" : "#A1A1AA"}
                />
              </View>

              <TouchableOpacity
                onPress={() => {
                  setShowAddToChatModal(false);
                  setSelectedConnectorDetail(null);
                  setShowConnectorsModal(true);
                }}
                className="flex-row items-center justify-between p-4 active:opacity-80"
              >
                <View className="flex-row items-center">
                  <View style={{ backgroundColor: isLight ? "#EAE6DF" : "#2B2B2B" }} className="w-9 h-9 rounded-full items-center justify-center mr-3">
                    <VectorIcon name="puzzle" size={16} color="#C084FC" />
                  </View>
                  <Text style={{ color: textPrimary }} className="text-sm font-semibold">Connectors & Agent Skills</Text>
                </View>
                <VectorIcon name="chevron-right" size={14} color={isLight ? "#6E6D68" : "#71717A"} />
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* 5. MODAL 2: INTERACTIVE CODE DIFF VIEWER (GREEN '+' & RED '-')      */}
      {/* =================================================================== */}
      <Modal
        visible={showDiffModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowDiffModal(false)}
      >
        <View style={{ backgroundColor: "#000000" }} className="flex-1 bg-black">
          <View className="flex-row items-center justify-between px-5 py-4 bg-[#09090B]">
            <TouchableOpacity onPress={() => setShowDiffModal(false)} className="p-1 flex-row items-center">
              <VectorIcon name="x" size={14} color="#A1A1AA" style={{ marginRight: 6 }} />
              <Text className="text-zinc-400 text-sm font-semibold">Close</Text>
            </TouchableOpacity>
            
            <View className="flex-row items-center">
              <Text style={{ color: "#FBBF24" }} className="text-xs font-mono font-bold mr-2">TS</Text>
              <Text className="text-white text-sm font-mono font-bold">{selectedDiffFile?.file || "util.ts"}</Text>
            </View>

            <View className="flex-row items-center space-x-2">
              <TouchableOpacity className="bg-emerald-600 px-3 py-1 rounded-lg mr-2 active:bg-emerald-500">
                <Text className="text-white text-xs font-bold">Accept All</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-red-950 px-3 py-1 rounded-lg active:bg-red-900">
                <Text className="text-red-300 text-xs font-bold">Reject</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView className="flex-1 px-4 py-4 font-mono" showsVerticalScrollIndicator={false}>
            <View className="bg-[#0D0D11] p-4 rounded-2xl">
              <Text className="text-zinc-500 text-xs font-mono mb-2">// src/auth/util.ts diff view</Text>

              <Text className="text-zinc-400 text-xs font-mono leading-6">
                {"  export function handleAuthRedirect(req: Request) {"}
              </Text>

              <View className="bg-red-950/40 p-1 rounded my-1 border-l-4 border-red-500">
                <Text className="text-red-400 text-xs font-mono leading-6">
                  {"-   return Response.redirect('/dashboard');"}
                </Text>
              </View>

              <View className="bg-emerald-950/40 p-1 rounded my-1 border-l-4 border-emerald-500">
                <Text className="text-emerald-400 text-xs font-mono leading-6">
                  {"+   const returnUrl = req.url.searchParams.get('returnUrl') || '/dashboard';"}
                </Text>
                <Text className="text-emerald-400 text-xs font-mono leading-6">
                  {"+   return Response.redirect(returnUrl);"}
                </Text>
              </View>

              <Text className="text-zinc-400 text-xs font-mono leading-6">
                {"  }"}
              </Text>
            </View>
          </ScrollView>

        </View>
      </Modal>

      {/* =================================================================== */}
      {/* 6. MODAL 3: DRAWER DASHBOARD & SESSIONS HISTORY                      */}
      {/* =================================================================== */}
      <Modal
        visible={showDrawerModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowDrawerModal(false)}
      >
        <View style={{ backgroundColor: bgCanvas }} className="flex-1">
          <View style={{ backgroundColor: bgCanvas }} className="flex-row items-center justify-between px-5 py-4">
            {/* User Profile Avatar & Name Trigger */}
            <TouchableOpacity 
              onPress={handleOpenProfileFromDrawer}
              style={{ backgroundColor: isLight ? "#FFFFFF" : "#141414" }}
              className="flex-row items-center px-3 py-1.5 rounded-2xl border border-slate-200/40 active:opacity-80"
            >
              <View className="w-7 h-7 rounded-full bg-[#221F33] items-center justify-center mr-2">
                <VectorIcon name="user" size={14} color="#C084FC" />
              </View>
              <Text style={{ color: textPrimary }} className="text-sm font-bold tracking-wide mr-1.5" numberOfLines={1}>
                {fullNameInput || "Retro Code User"}
              </Text>
              <VectorIcon name="chevron-right" size={10} color={isLight ? "#64748B" : "#71717A"} />
            </TouchableOpacity>

            <View className="flex-row items-center">
              {/* Theme Toggle Button (Light ☀️ / Dark 🌙) */}
              <TouchableOpacity 
                onPress={() => setMode(isLight ? "darkest" : "light")}
                style={{ backgroundColor: isLight ? "#FFFFFF" : "#111111" }}
                className="w-9 h-9 rounded-full items-center justify-center mr-2 border border-slate-200/40 active:opacity-80"
              >
                <Text className="text-sm">{isLight ? "🌙" : "☀️"}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={{ backgroundColor: isLight ? "#FFFFFF" : "#111111" }}
                className="w-9 h-9 rounded-full items-center justify-center mr-2 border border-slate-200/40"
              >
                <VectorIcon name="cloud" size={15} color={isLight ? "#64748B" : "#A1A1AA"} />
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setShowDrawerModal(false)}
                style={{ backgroundColor: isLight ? "#FFFFFF" : "#111111" }}
                className="w-9 h-9 rounded-full items-center justify-center border border-slate-200/40"
              >
                <VectorIcon name="x" size={14} color={isLight ? "#0F172A" : "#E4E4E7"} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView className="flex-1 px-5 py-3" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
            <TouchableOpacity 
              onPress={handleOpenProjectsFromDrawer}
              style={{ backgroundColor: isLight ? "#FFFFFF" : "#111111" }}
              className="flex-row items-center py-3 px-3.5 rounded-2xl mb-2.5 border border-slate-200/40 active:opacity-80"
            >
              <VectorIcon name="folder" size={18} color="#F59E0B" style={{ marginRight: 12 }} />
              <Text style={{ color: textPrimary }} className="text-sm font-bold flex-1 text-left">Projects</Text>
              <VectorIcon name="chevron-right" size={12} color={isLight ? "#64748B" : "#71717A"} />
            </TouchableOpacity>

            {/* Skills.sh Agent Connectors Trigger */}
            <TouchableOpacity 
              onPress={handleOpenConnectorsFromDrawer}
              style={{ backgroundColor: isLight ? "#F3E8FF" : "rgba(58, 12, 95, 0.4)" }}
              className="flex-row items-center py-3 px-3.5 rounded-2xl mb-4 border border-purple-500/20 active:opacity-80"
            >
              <VectorIcon name="puzzle" size={18} color="#C084FC" style={{ marginRight: 12 }} />
              <View className="flex-1">
                <Text style={{ color: isLight ? "#581C87" : "#FFFFFF" }} className="text-sm font-bold text-left">Skills.sh Ecosystem</Text>
                <Text style={{ color: isLight ? "#7E22CE" : "#D8B4FE" }} className="text-[10px] text-left">1,000+ AI Agent Skills & Icons</Text>
              </View>
              <Text style={{ color: isLight ? "#6B21A8" : "#E9D5FF" }} className="text-xs font-bold">Featured ➔</Text>
            </TouchableOpacity>

            {/* PROJECT GROUPED CHAT SESSIONS TREE */}
            <View className="mb-6">
              <Text style={{ color: textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-4 px-1">
                Projects & Workspace Chats
              </Text>

              {[
                {
                  projectId: "proj-1",
                  projectName: "Landing Page SaaS",
                  sessions: [
                    { id: "s-1", title: "Fix the login flow redirect issue", time: "2 hr ago", prBadge: "1 merged", badgeType: "purple" },
                    { id: "s-2", title: "Can you refactor this component to use hooks?", time: "15min ago", prBadge: "2 open", badgeType: "blue" },
                    { id: "s-3", title: "Write unit tests for the notification module", time: "45hr ago", prBadge: "3 merged", badgeType: "purple" },
                  ]
                },
                {
                  projectId: "proj-2",
                  projectName: "Analytics Admin Dashboard",
                  sessions: [
                    { id: "s-4", title: "Kiro mobile app story book demo", time: "4 hr ago", prBadge: "2 open", badgeType: "blue" },
                    { id: "s-5", title: "Implement drag and drop for the kanban board", time: "1hr ago", prBadge: "3 merged", badgeType: "purple" },
                  ]
                },
                {
                  projectId: "proj-3",
                  projectName: "E-Commerce Expo App",
                  sessions: [
                    { id: "s-6", title: "Update the onboarding carousel copy", time: "2hr ago", prBadge: "2 open", badgeType: "blue" },
                    { id: "s-7", title: "Debug memory leak in websocket connection", time: "6hr ago", prBadge: "1 closed", badgeType: "gray" },
                  ]
                }
              ].map((group) => (
                <View key={group.projectId} className="mb-5">
                  {/* Folder Header */}
                  <TouchableOpacity 
                    onPress={() => handleOpenProjectFolder(group.projectName)}
                    className="flex-row items-center justify-between mb-2 px-1 active:opacity-80"
                  >
                    <View className="flex-row items-center flex-1 mr-2">
                      <VectorIcon name="folder" size={16} color="#F59E0B" style={{ marginRight: 8 }} />
                      <Text style={{ color: textPrimary }} className="text-sm font-bold text-left" numberOfLines={1}>
                        {group.projectName}
                      </Text>
                    </View>

                    <View style={{ backgroundColor: isLight ? "#E2E8F0" : "#1C1C1C" }} className="px-2.5 py-1 rounded-lg">
                      <Text style={{ color: isLight ? "#6B21A8" : "#D8B4FE" }} className="text-[10px] font-mono font-bold">Open</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Grouped Nested Chat Sessions */}
                  <View style={{ borderColor: isLight ? "#CBD5E1" : "rgba(39, 39, 42, 0.8)" }} className="pl-3 ml-2 border-l">
                    {group.sessions.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => handleLoadSession(item, group.projectName)}
                        style={{ backgroundColor: isLight ? "#FFFFFF" : "#121212", borderColor: isLight ? "#E2E8F0" : "transparent" }}
                        className="p-3 rounded-xl mb-2 border active:opacity-80 shadow-sm"
                      >
                        <Text style={{ color: textPrimary }} className="text-xs font-medium mb-1.5 text-left font-sans" numberOfLines={1}>
                          {item.title}
                        </Text>
                        <View className="flex-row items-center justify-between">
                          <Text style={{ color: textSecondary }} className="text-[10px]">{item.time}</Text>
                          <View className={`px-2 py-0.5 rounded-full ${
                            item.badgeType === "purple" ? (isLight ? "bg-purple-100" : "bg-purple-950/80") :
                            item.badgeType === "blue" ? (isLight ? "bg-sky-100" : "bg-blue-950/80") : (isLight ? "bg-slate-100" : "bg-zinc-800")
                          }`}>
                            <Text className={`text-[9px] font-medium ${
                              item.badgeType === "purple" ? (isLight ? "text-purple-700" : "text-purple-300") :
                              item.badgeType === "blue" ? (isLight ? "text-sky-700" : "text-blue-300") : (isLight ? "text-slate-600" : "text-zinc-400")
                            }`}>
                              {item.prBadge}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Bottom Floating Bar Navigation Container */}
          <View className="absolute bottom-4 left-4 right-4 flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center bg-[#141414] px-3.5 py-2.5 rounded-full mr-3">
              <VectorIcon name="search" size={14} color="#A1A1AA" style={{ marginRight: 8 }} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search..."
                placeholderTextColor="#71717A"
                className="flex-1 text-zinc-100 text-xs text-left"
                style={{ color: "#F4F4F5" }}
              />
              <VectorIcon name="tool" size={14} color="#A1A1AA" />
            </View>

            <TouchableOpacity 
              onPress={handleNewChat}
              className="w-12 h-12 rounded-full bg-[#6D42C7] items-center justify-center shadow-lg"
            >
              <VectorIcon name="edit" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* 7. MODAL 4: CONNECTORS SHEET & CONNECTOR DETAIL VIEW                 */}
      {/* =================================================================== */}
      <Modal
        visible={showConnectorsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowConnectorsModal(false)}
      >
        <View className="flex-1 justify-end bg-black/80">
          <View className="h-[85%] bg-[#121212] rounded-t-[32px] p-4 relative">
            <View className="items-center mb-3">
              <View className="w-12 h-1.5 bg-zinc-700 rounded-full opacity-60" />
            </View>

            {selectedConnectorDetail ? (
              <View className="flex-1 flex-col justify-between">
                <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                  <View className="flex-row items-center mb-4">
                    <TouchableOpacity 
                      onPress={() => setSelectedConnectorDetail(null)}
                      className="w-10 h-10 rounded-full bg-[#242424] items-center justify-center"
                    >
                      <VectorIcon name="arrow-left" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>

                  <View className="items-center mb-6">
                    <View className="w-20 h-20 rounded-3xl bg-[#262626] items-center justify-center mb-3 shadow-xl">
                      <VectorIcon name={selectedConnectorDetail.icon} size={36} color={selectedConnectorDetail.color || "#C084FC"} />
                    </View>
                    <Text className="text-white text-2xl font-bold mb-1 text-center">{selectedConnectorDetail.name}</Text>
                    <Text className="text-zinc-400 text-xs text-center px-4 leading-5">
                      {selectedConnectorDetail.description}
                    </Text>
                  </View>

                  <View className="mb-6">
                    <Text className="text-white text-sm font-bold mb-3 text-left">Overview</Text>
                    {selectedConnectorDetail.overviewBullets?.map((bullet: string, bIdx: number) => (
                      <View key={bIdx} className="flex-row items-start mb-2.5">
                        <Text className="text-zinc-500 text-xs mr-2">•</Text>
                        <Text className="text-zinc-300 text-xs flex-1 leading-5 text-left">{bullet}</Text>
                      </View>
                    ))}
                  </View>

                  <View className="mb-6 space-y-2">
                    <TouchableOpacity className="flex-row items-center justify-between p-3.5 rounded-2xl bg-[#1E1E1E] mb-2 active:bg-[#282828]">
                      <View className="flex-row items-center">
                        <VectorIcon name="globe" size={16} color="#A1A1AA" style={{ marginRight: 10 }} />
                        <Text className="text-zinc-200 text-xs font-semibold">Website</Text>
                      </View>
                      <VectorIcon name="arrow-right" size={12} color="#71717A" />
                    </TouchableOpacity>

                    <TouchableOpacity className="flex-row items-center justify-between p-3.5 rounded-2xl bg-[#1E1E1E] mb-2 active:bg-[#282828]">
                      <View className="flex-row items-center">
                        <VectorIcon name="file-text" size={16} color="#A1A1AA" style={{ marginRight: 10 }} />
                        <Text className="text-zinc-200 text-xs font-semibold">Documentation</Text>
                      </View>
                      <VectorIcon name="arrow-right" size={12} color="#71717A" />
                    </TouchableOpacity>

                    <TouchableOpacity className="flex-row items-center justify-between p-3.5 rounded-2xl bg-[#1E1E1E] mb-2 active:bg-[#282828]">
                      <View className="flex-row items-center">
                        <VectorIcon name="tool" size={16} color="#A1A1AA" style={{ marginRight: 10 }} />
                        <Text className="text-zinc-200 text-xs font-semibold">Support</Text>
                      </View>
                      <VectorIcon name="arrow-right" size={12} color="#71717A" />
                    </TouchableOpacity>
                  </View>

                  <Text className="text-zinc-500 text-xs text-left mb-4">
                    Developed by {selectedConnectorDetail.developer || "Third Party"}
                  </Text>
                </ScrollView>

                <TouchableOpacity
                  onPress={() => handleToggleConnectorConnection(selectedConnectorDetail.id)}
                  style={{ backgroundColor: selectedConnectorDetail.connected ? "#1F2937" : "#6D42C7" }}
                  className="w-full py-4 rounded-3xl items-center justify-center active:opacity-90 shadow-xl"
                >
                  <Text style={{ color: selectedConnectorDetail.connected ? "#9CA3AF" : "#FFFFFF" }} className="text-sm font-bold">
                    {selectedConnectorDetail.connected ? "Disconnect Ecosystem" : "Install Skills.sh Ecosystem"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-2 px-1">
                  <Text className="text-white text-xl font-bold">Connectors & Agent Skills</Text>
                  <TouchableOpacity 
                    onPress={() => setShowConnectorsModal(false)}
                    className="w-8 h-8 rounded-full bg-[#242424] items-center justify-center"
                  >
                    <VectorIcon name="x" size={14} color="#A1A1AA" />
                  </TouchableOpacity>
                </View>

                <Text className="text-zinc-400 text-xs leading-5 px-1 mb-4 text-left">
                  Connect your apps, cloud services, and install Skills.sh AI agent skill modules.
                </Text>

                <View className="flex-row items-center bg-[#1E1E1E] px-3.5 py-2.5 rounded-2xl mb-4">
                  <VectorIcon name="search" size={14} color="#A1A1AA" style={{ marginRight: 10 }} />
                  <TextInput
                    value={connectorsSearch}
                    onChangeText={setConnectorsSearch}
                    placeholder="Search connectors & skills..."
                    placeholderTextColor="#71717A"
                    className="flex-1 text-zinc-100 text-xs text-left"
                    style={{ color: "#F4F4F5" }}
                  />
                </View>

                <View style={{ height: 44 }} className="mb-3">
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ alignItems: "center", paddingRight: 10 }}
                  >
                    {["Popular", "AI Skills", "Connected", "Data & Analytics", "Services"].map((cat) => {
                      const isCatSelected = connectorsFilter === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => setConnectorsFilter(cat)}
                          activeOpacity={0.8}
                          style={{
                            backgroundColor: isCatSelected ? "#E4E4E7" : "#1E1E1E",
                          }}
                          className="px-4 py-2 rounded-full mr-2 flex-row items-center justify-center"
                        >
                          <Text 
                            style={{ color: isCatSelected ? "#000000" : "#D4D4D8" }}
                            className="text-xs font-semibold"
                          >
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                  {connectorsList.map((conn) => (
                    <TouchableOpacity
                      key={conn.id}
                      onPress={() => setSelectedConnectorDetail(conn)}
                      className={`flex-row items-center p-3.5 rounded-2xl mb-3 active:bg-[#242424] ${
                        conn.id === "skillsh" 
                          ? "bg-purple-950/30" 
                          : "bg-[#1A1A1A]"
                      }`}
                    >
                      <View className={`w-11 h-11 rounded-2xl items-center justify-center mr-3.5 ${
                        conn.id === "skillsh" ? "bg-purple-900/40" : "bg-[#262626]"
                      }`}>
                        <VectorIcon name={conn.icon} size={20} color={conn.color || "#C084FC"} />
                      </View>

                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text className="text-white text-sm font-bold text-left mb-0.5 mr-2">{conn.name}</Text>
                          {conn.id === "skillsh" && (
                            <View className="bg-purple-900/80 px-2 py-0.5 rounded">
                              <Text className="text-purple-300 text-[9px] font-mono uppercase font-bold">Featured Ecosystem</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-zinc-400 text-xs text-left leading-4 opacity-80" numberOfLines={2}>
                          {conn.description}
                        </Text>
                      </View>

                      {conn.connected && (
                        <View className="bg-emerald-950/80 px-2 py-0.5 rounded-md ml-2">
                          <Text className="text-emerald-400 text-[10px] font-mono">Connected</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* 8. MODAL 5: PROJECTS MANAGEMENT SHEET                               */}
      {/* =================================================================== */}
      <Modal
        visible={showProjectsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProjectsModal(false)}
      >
        <View className="flex-1 justify-end bg-black/80">
          <View style={{ backgroundColor: bgCard }} className="h-[85%] rounded-t-[32px] p-4 shadow-2xl">
            <View className="items-center mb-3">
              <View className="w-12 h-1.5 bg-zinc-400 rounded-full opacity-60" />
            </View>

            <View className="flex-row items-center justify-between mb-4 pb-2 px-1">
              <Text style={{ color: textPrimary }} className="text-xl font-bold">Projects</Text>
              
              <View className="flex-row items-center">
                <TouchableOpacity 
                  onPress={() => setShowNewProjectModal(true)}
                  className="w-8 h-8 rounded-full bg-amber-500/20 items-center justify-center mr-2 active:bg-amber-500/30"
                >
                  <VectorIcon name="plus" size={16} color="#F59E0B" />
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setShowProjectsModal(false)}
                  style={{ backgroundColor: isLight ? "#EAE6DF" : "#242424" }}
                  className="w-8 h-8 rounded-full items-center justify-center"
                >
                  <VectorIcon name="x" size={14} color={isLight ? "#1E1D1A" : "#A1A1AA"} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                onPress={() => setShowNewProjectModal(true)}
                style={{ backgroundColor: isLight ? "#FEF3C7" : "rgba(69, 26, 3, 0.3)" }}
                className="mb-4 p-4 rounded-2xl flex-row items-center justify-between active:opacity-80"
              >
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-xl bg-amber-500/20 items-center justify-center mr-3">
                    <VectorIcon name="sparkles" size={18} color="#D97706" />
                  </View>
                  <View>
                    <Text style={{ color: isLight ? "#92400E" : "#FCD34D" }} className="text-sm font-bold text-left mb-0.5">New Project</Text>
                    <Text style={{ color: isLight ? "#B45309" : "#FBBF24" }} className="text-xs text-left">Create coding environment & build new app</Text>
                  </View>
                </View>
                <VectorIcon name="plus" size={18} color="#D97706" />
              </TouchableOpacity>

              {[
                {
                  title: "Landing Page SaaS",
                  desc: "Next.js + Tailwind CSS modern landing page for AI builder",
                  date: "2026/07/25"
                },
                {
                  title: "Analytics Admin Dashboard",
                  desc: "React dashboard with Chart.js and Supabase database",
                  date: "2026/07/24"
                },
                {
                  title: "E-Commerce Expo App",
                  desc: "React Native mobile app with Stripe checkout integration",
                  date: "2026/07/22"
                }
              ].map((proj) => (
                <TouchableOpacity
                  key={proj.title}
                  onPress={() => {
                    setShowProjectsModal(false);
                    setActiveProjectName(proj.title);
                    setThreadTitle(proj.title);
                  }}
                  style={{ backgroundColor: isLight ? "#F7F4EF" : "#1A1A1A", borderColor: isLight ? "#EAE6DF" : "transparent" }}
                  className="mb-3.5 p-4 rounded-2xl border active:opacity-80 shadow-sm"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text style={{ color: textPrimary }} className="text-base font-bold text-left">{proj.title}</Text>
                    <TouchableOpacity style={{ backgroundColor: isLight ? "#EAE6DF" : "#262626" }} className="w-7 h-7 rounded-lg items-center justify-center">
                      <VectorIcon name="trash" size={12} color={isLight ? "#6E6D68" : "#71717A"} />
                    </TouchableOpacity>
                  </View>

                  <Text style={{ color: textSecondary }} className="text-xs text-left mb-3 leading-5">{proj.desc}</Text>
                  <Text style={{ color: textMuted }} className="text-[10px] text-left">Last viewed: {proj.date}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* 9. MODAL 6: CREATE NEW PROJECT FORM DIALOG                          */}
      {/* =================================================================== */}
      <Modal
        visible={showNewProjectModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowNewProjectModal(false)}
      >
        <View className="flex-1 justify-center bg-black/80 px-6">
          <View className="bg-[#181818] p-5 rounded-[28px] shadow-2xl">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center">
                <VectorIcon name="sparkles" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                <Text className="text-white text-base font-bold">Create New Project</Text>
              </View>
              <TouchableOpacity onPress={() => setShowNewProjectModal(false)}>
                <VectorIcon name="x" size={14} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-zinc-400 text-xs mb-2 text-left">Project Name:</Text>
            <TextInput
              value={newProjectName}
              onChangeText={setNewProjectName}
              placeholder="e.g. AI Portfolio App..."
              placeholderTextColor="#71717A"
              className="bg-[#242424] p-3 rounded-xl text-white text-xs mb-4 text-left"
              style={{ color: "#FFFFFF" }}
            />

            <Text className="text-zinc-400 text-xs mb-2 text-left">Start from a template:</Text>
            <View className="flex-row flex-wrap mb-4">
              {PROJECT_TEMPLATE_CHOICES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setNewProjectTemplate(t.id)}
                  className="px-3 py-2 rounded-xl mr-2 mb-2"
                  style={{ backgroundColor: newProjectTemplate === t.id ? "#F59E0B" : "#242424" }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: newProjectTemplate === t.id ? "#000000" : "#A1A1AA" }}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleCreateNewProject}
              disabled={isCreatingProject}
              className="bg-amber-500 py-3 rounded-xl items-center shadow-lg flex-row justify-center"
              style={{ opacity: isCreatingProject ? 0.6 : 1 }}
            >
              {isCreatingProject ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <>
                  <Text className="text-black text-xs font-bold mr-1.5">Create & Open Project</Text>
                  <VectorIcon name="arrow-right" size={14} color="#000000" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* 10. MODAL 7: LIVE WEB APP ARTIFACT SANDBOX PREVIEW                 */}
      {/* =================================================================== */}
      <Modal
        visible={showPreviewModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={{ backgroundColor: "#000000" }} className="flex-1 bg-black">
          <View className="flex-row items-center justify-between px-5 py-4 bg-[#09090B]">
            <TouchableOpacity onPress={() => setShowPreviewModal(false)} className="p-1 flex-row items-center">
              <VectorIcon name="x" size={14} color="#A1A1AA" style={{ marginRight: 6 }} />
              <Text className="text-zinc-400 text-sm font-semibold">Close</Text>
            </TouchableOpacity>
            <View className="flex-row items-center">
              <VectorIcon name="eye" size={16} color="#34D399" style={{ marginRight: 6 }} />
              <Text className="text-white text-base font-bold">Live App Preview</Text>
            </View>
            <TouchableOpacity onPress={loadPreview} className="p-1 flex-row items-center">
              <VectorIcon name="rotate-ccw" size={12} color="#38BDF8" style={{ marginRight: 4 }} />
              <Text className="text-sky-400 text-xs font-bold">Refresh</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-1 bg-[#111113] p-4">
            <View className="w-full h-full bg-[#18181B] rounded-3xl p-4 flex-col">
              <View className="flex-row items-center justify-between pb-3">
                <View className="flex-row space-x-1.5">
                  <View className="w-3 h-3 rounded-full bg-red-500" />
                  <View className="w-3 h-3 rounded-full bg-amber-500" />
                  <View className="w-3 h-3 rounded-full bg-emerald-500" />
                </View>
                <Text className="text-zinc-400 text-xs font-mono">
                  {activeProjectName ? activeProjectName.toLowerCase().replace(/\s+/g, "-") + ".app" : "preview"}
                </Text>
              </View>

              {previewLoading ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator size="large" color="#8B5CF6" />
                  <Text className="text-zinc-400 text-xs mt-4">Building on-device preview…</Text>
                </View>
              ) : previewError ? (
                <View className="flex-1 items-center justify-center px-6">
                  <VectorIcon name="x" size={32} color="#F87171" style={{ marginBottom: 12 }} />
                  <Text className="text-white text-sm font-bold mb-2">Preview failed</Text>
                  <Text className="text-zinc-400 text-xs text-center leading-5">{previewError}</Text>
                </View>
              ) : previewHtml && Platform.OS === "web" ? (
                <WebPreviewFrame html={previewHtml} />
              ) : (
                <View className="flex-1 items-center justify-center px-6">
                  <VectorIcon name="mobile" size={36} color="#10B981" style={{ marginBottom: 12 }} />
                  <Text className="text-white text-sm font-bold mb-2">Native preview coming soon</Text>
                  <Text className="text-zinc-400 text-xs text-center leading-5">
                    The WebView-powered preview ships with the native build (Phase 4). Use the web app to preview for now.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* 11. MODAL 8: GIT CHECKPOINTS & TIMELINE ROLLBACK (AUTO-FIT HEIGHT) */}
      {/* =================================================================== */}
      <Modal
        visible={showCheckpointsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCheckpointsModal(false)}
      >
        <View className="flex-1 justify-end bg-black/80">
          <View className="max-h-[85%] bg-[#121212] rounded-t-[32px] p-5 pb-8">
            <View className="items-center mb-4">
              <View className="w-12 h-1.5 bg-zinc-700 rounded-full opacity-60" />
            </View>

            <View className="flex-row items-center justify-between mb-4 pb-3">
              <View className="flex-row items-center">
                <VectorIcon name="rotate-ccw" size={18} color="#C084FC" style={{ marginRight: 8 }} />
                <Text className="text-white text-xl font-bold">Git Checkpoints</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowCheckpointsModal(false)}
                className="w-8 h-8 rounded-full bg-[#242424] items-center justify-center"
              >
                <VectorIcon name="x" size={14} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { id: "cp-1", title: "Refactored Auth Redirect & Session Cookie", time: "10 mins ago", hash: "e5509a3" },
                { id: "cp-2", title: "Added Incognito Mode & Connectors Sheet", time: "1 hr ago", hash: "a88f20b" },
                { id: "cp-3", title: "Initial App Setup & Navigation", time: "3 hrs ago", hash: "c1103de" }
              ].map((cp) => (
                <View key={cp.id} className="mb-4 p-4 rounded-2xl bg-[#1A1A1A] flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <View className="flex-row items-center mb-1">
                      <View className="w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2" />
                      <Text className="text-white text-sm font-bold text-left">{cp.title}</Text>
                    </View>
                    <Text className="text-zinc-400 text-xs text-left font-mono">{cp.time} · {cp.hash}</Text>
                  </View>

                  <TouchableOpacity className="bg-purple-950/80 px-3 py-1.5 rounded-xl active:bg-purple-900 flex-row items-center">
                    <Text className="text-purple-300 text-xs font-semibold mr-1">Rollback</Text>
                    <VectorIcon name="rotate-ccw" size={12} color="#C084FC" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* 12. MODAL 9: MASTER PROFILE & SETTINGS MULTI-SCREEN MODAL           */}
      {/* =================================================================== */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={{ backgroundColor: bgCanvas }} className="flex-1">
          
          {/* SUB-SCREEN 1: MAIN SETTINGS OVERVIEW */}
          {profileSubScreen === "main" && (
            <View style={{ backgroundColor: bgCanvas }} className="flex-1">
              <View className="flex-row items-center justify-between px-5 py-4">
                <TouchableOpacity onPress={() => setShowProfileModal(false)} className="p-1 flex-row items-center">
                  <VectorIcon name="x" size={14} color={isLight ? "#6E6D68" : "#A1A1AA"} style={{ marginRight: 6 }} />
                  <Text style={{ color: textSecondary }} className="text-sm font-semibold">Close</Text>
                </TouchableOpacity>
                <Text style={{ color: textPrimary }} className="text-base font-bold">Settings</Text>
                <TouchableOpacity className="p-1">
                  <VectorIcon name="info" size={16} color={isLight ? "#6E6D68" : "#A1A1AA"} />
                </TouchableOpacity>
              </View>

              <ScrollView className="flex-1 px-4 py-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
                {/* Profile Card */}
                <View style={{ backgroundColor: bgCard, borderColor: isLight ? "#EAE6DF" : "transparent" }} className="p-4 rounded-2xl mb-4 flex-row items-center justify-between shadow-sm border">
                  <View className="flex-row items-center flex-1 mr-2">
                    <View className="w-10 h-10 rounded-full bg-purple-950/40 items-center justify-center mr-3">
                      <VectorIcon name="user" size={18} color="#C084FC" />
                    </View>
                    <View className="flex-1">
                      <Text style={{ color: textPrimary }} className="text-sm font-bold text-left" numberOfLines={1}>guest@retrocode.dev</Text>
                      <Text style={{ color: textSecondary }} className="text-xs text-left">developer@retrocode.dev</Text>
                    </View>
                  </View>

                  <View style={{ backgroundColor: isLight ? "#1E1D1A" : "#FFFFFF" }} className="px-3.5 py-1.5 rounded-full items-center justify-center">
                    <Text style={{ color: isLight ? "#FFFFFF" : "#000000", fontWeight: "700", fontSize: 12 }}>Free</Text>
                  </View>
                </View>

                {/* Upgrade Card */}
                <View style={{ backgroundColor: isLight ? "#F2EFEA" : "#141417", borderColor: isLight ? "#EAE6DF" : "transparent" }} className="p-5 rounded-2xl mb-6 shadow-sm border relative overflow-hidden">
                  <Text style={{ color: textPrimary }} className="text-base font-bold text-left mb-1">Want more Retro Code?</Text>
                  <Text style={{ color: textSecondary }} className="text-xs text-left mb-4 leading-5">
                    Upgrade for more usage and capabilities.
                  </Text>
                  
                  <TouchableOpacity style={{ backgroundColor: isLight ? "#1E1D1A" : "#FFFFFF" }} className="px-6 py-2.5 rounded-2xl self-start active:opacity-90 shadow-md items-center justify-center">
                    <Text style={{ color: isLight ? "#FFFFFF" : "#000000", fontWeight: "700", fontSize: 13 }}>Upgrade</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ backgroundColor: bgCard, borderColor: isLight ? "#EAE6DF" : "transparent" }} className="rounded-2xl overflow-hidden mb-5 border shadow-sm">
                  <TouchableOpacity
                    onPress={() => setProfileSubScreen("profile_edit")}
                    className="flex-row items-center justify-between p-4 active:opacity-80"
                  >
                    <View className="flex-row items-center">
                      <VectorIcon name="user" size={16} color={isLight ? "#6E6D68" : "#A1A1AA"} style={{ marginRight: 12 }} />
                      <Text style={{ color: textPrimary }} className="text-sm font-semibold">Profile</Text>
                    </View>
                    <VectorIcon name="chevron-right" size={12} color={isLight ? "#6E6D68" : "#71717A"} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setProfileSubScreen("usage")}
                    className="flex-row items-center justify-between p-4 active:opacity-80"
                  >
                    <View className="flex-row items-center">
                      <VectorIcon name="card" size={16} color={isLight ? "#6E6D68" : "#A1A1AA"} style={{ marginRight: 12 }} />
                      <Text style={{ color: textPrimary }} className="text-sm font-semibold">Usage & Billing</Text>
                    </View>
                    <VectorIcon name="chevron-right" size={12} color={isLight ? "#6E6D68" : "#71717A"} />
                  </TouchableOpacity>
                </View>

                <View style={{ backgroundColor: bgCard, borderColor: isLight ? "#EAE6DF" : "transparent" }} className="rounded-2xl overflow-hidden mb-5 border shadow-sm">
                  <TouchableOpacity
                    onPress={() => setProfileSubScreen("capabilities")}
                    className="flex-row items-center justify-between p-4 active:opacity-80"
                  >
                    <View className="flex-row items-center">
                      <VectorIcon name="settings" size={16} color={isLight ? "#6E6D68" : "#A1A1AA"} style={{ marginRight: 12 }} />
                      <View>
                        <Text style={{ color: textPrimary }} className="text-sm font-semibold text-left">Capabilities</Text>
                        <Text style={{ color: textSecondary }} className="text-xs text-left">4 enabled</Text>
                      </View>
                    </View>
                    <VectorIcon name="chevron-right" size={12} color={isLight ? "#6E6D68" : "#71717A"} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setShowProfileModal(false);
                      setShowConnectorsModal(true);
                    }}
                    className="flex-row items-center justify-between p-4 active:opacity-80"
                  >
                    <View className="flex-row items-center">
                      <VectorIcon name="puzzle" size={16} color={isLight ? "#6E6D68" : "#A1A1AA"} style={{ marginRight: 12 }} />
                      <Text style={{ color: textPrimary }} className="text-sm font-semibold">Connectors & Agent Skills</Text>
                    </View>
                    <VectorIcon name="chevron-right" size={12} color={isLight ? "#6E6D68" : "#71717A"} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setProfileSubScreen("permissions")}
                    className="flex-row items-center justify-between p-4 active:opacity-80"
                  >
                    <View className="flex-row items-center">
                      <VectorIcon name="shield" size={16} color={isLight ? "#6E6D68" : "#A1A1AA"} style={{ marginRight: 12 }} />
                      <Text style={{ color: textPrimary }} className="text-sm font-semibold">Permissions</Text>
                    </View>
                    <VectorIcon name="chevron-right" size={12} color={isLight ? "#6E6D68" : "#71717A"} />
                  </TouchableOpacity>
                </View>

                {/* Theme & Preferences */}
                <View style={{ backgroundColor: bgCard, borderColor: isLight ? "#EAE6DF" : "transparent" }} className="rounded-2xl overflow-hidden mb-6 border shadow-sm">
                  <TouchableOpacity 
                    onPress={() => setMode(isLight ? "darkest" : "light")}
                    className="flex-row items-center justify-between p-4 active:opacity-80"
                  >
                    <View className="flex-row items-center">
                      <VectorIcon name={isLight ? "sun" : "moon"} size={16} color={isLight ? "#D97757" : "#A1A1AA"} style={{ marginRight: 12 }} />
                      <View>
                        <Text style={{ color: textPrimary }} className="text-sm font-semibold text-left">Color mode</Text>
                        <Text style={{ color: isLight ? "#D97757" : "#A1A1AA" }} className="text-xs text-left font-medium">
                          {isLight ? "Claude Light (Paper Beige)" : "System Darkest"}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-xs font-bold text-purple-500">Tap to Switch ➔</Text>
                  </TouchableOpacity>

                  <TouchableOpacity className="flex-row items-center justify-between p-4">
                    <View className="flex-row items-center">
                      <VectorIcon name="type" size={16} color={isLight ? "#6E6D68" : "#A1A1AA"} style={{ marginRight: 12 }} />
                      <View>
                        <Text style={{ color: textPrimary }} className="text-sm font-semibold text-left">Font style</Text>
                        <Text style={{ color: textSecondary }} className="text-xs text-left">Default</Text>
                      </View>
                    </View>
                    <VectorIcon name="chevron-right" size={12} color={isLight ? "#6E6D68" : "#71717A"} />
                  </TouchableOpacity>

                  <View className="flex-row items-center justify-between p-4">
                    <View className="flex-row items-center">
                      <VectorIcon name="mobile" size={16} color={isLight ? "#6E6D68" : "#A1A1AA"} style={{ marginRight: 12 }} />
                      <Text style={{ color: textPrimary }} className="text-sm font-semibold">Haptic feedback</Text>
                    </View>
                    <Switch
                      value={hapticFeedback}
                      onValueChange={setHapticFeedback}
                      trackColor={{ false: "#3F3F46", true: "#38BDF8" }}
                      thumbColor={hapticFeedback ? "#FFFFFF" : "#A1A1AA"}
                    />
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={() => setShowProfileModal(false)}
                  className="w-full py-3.5 rounded-full bg-red-500/10 items-center justify-center mb-8 active:opacity-80"
                >
                  <Text className="text-red-500 text-sm font-bold">Sign Out</Text>
                </TouchableOpacity>

              </ScrollView>
            </View>
          )}

          {/* SUB-SCREEN 2: PROFILE EDIT */}
          {profileSubScreen === "profile_edit" && (
            <View className="flex-1 bg-[#09090B]">
              <View className="flex-row items-center px-4 py-4">
                <TouchableOpacity 
                  onPress={() => setProfileSubScreen("main")} 
                  className="w-10 h-10 rounded-full bg-[#181818] items-center justify-center mr-3"
                >
                  <VectorIcon name="arrow-left" size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <Text className="text-white text-lg font-bold">Profile</Text>
              </View>

              <ScrollView className="flex-1 px-4 py-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
                <Text className="text-zinc-300 text-xs font-semibold text-left mb-2">Full name</Text>
                <TextInput
                  value={fullNameInput}
                  onChangeText={setFullNameInput}
                  className="bg-[#141417] p-3.5 rounded-2xl text-white text-sm mb-4 text-left"
                  style={{ color: "#FFFFFF" }}
                />

                <Text className="text-zinc-300 text-xs font-semibold text-left mb-2">What should we call you?</Text>
                <TextInput
                  value={callNameInput}
                  onChangeText={setCallNameInput}
                  className="bg-[#141417] p-3.5 rounded-2xl text-white text-sm mb-5 text-left"
                  style={{ color: "#FFFFFF" }}
                />

                <TouchableOpacity className="bg-zinc-700 py-3.5 rounded-2xl items-center mb-8 active:bg-zinc-600">
                  <Text className="text-white text-xs font-bold">Update Profile</Text>
                </TouchableOpacity>

                <Text className="text-white text-sm font-bold text-left mb-1">
                  What personal preferences should Retro Code consider in responses?
                </Text>
                <Text className="text-zinc-400 text-xs text-left mb-3">
                  Your preferences will apply to all conversations.
                </Text>

                <TextInput
                  value={aiPreferenceText}
                  onChangeText={setAiPreferenceText}
                  multiline
                  numberOfLines={4}
                  className="bg-[#141417] p-4 rounded-2xl text-zinc-200 text-xs mb-5 text-left h-28"
                  style={{ color: "#E4E4E7" }}
                />

                <TouchableOpacity className="bg-zinc-700 py-3.5 rounded-2xl items-center mb-8 active:bg-zinc-600">
                  <Text className="text-white text-xs font-bold">Save Preferences</Text>
                </TouchableOpacity>

                <Text className="text-zinc-400 text-xs font-semibold text-left mb-3">Account Actions</Text>
                <TouchableOpacity className="flex-row items-center py-3">
                  <VectorIcon name="trash" size={16} color="#EF4444" style={{ marginRight: 10 }} />
                  <Text className="text-red-500 text-sm font-semibold">Delete Account</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* SUB-SCREEN 3: CAPABILITIES */}
          {profileSubScreen === "capabilities" && (
            <View className="flex-1 bg-[#09090B]">
              <View className="flex-row items-center px-4 py-4">
                <TouchableOpacity 
                  onPress={() => setProfileSubScreen("main")} 
                  className="w-10 h-10 rounded-full bg-[#181818] items-center justify-center mr-3"
                >
                  <VectorIcon name="arrow-left" size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <Text className="text-white text-lg font-bold">Capabilities</Text>
              </View>

              <ScrollView className="flex-1 px-4 py-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
                <View className="bg-[#141417] rounded-2xl overflow-hidden mb-6">
                  <View className="p-4 flex-row items-center justify-between">
                    <View className="flex-row items-start flex-1 mr-3">
                      <VectorIcon name="globe" size={18} color="#A1A1AA" style={{ marginRight: 12, marginTop: 2 }} />
                      <View className="flex-1">
                        <Text className="text-white text-sm font-bold text-left mb-1">Web search</Text>
                        <Text className="text-zinc-400 text-xs text-left leading-4">
                          Retro Code will automatically search the web when it determines it needs current information
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={capWebSearch}
                      onValueChange={setCapWebSearch}
                      trackColor={{ false: "#3F3F46", true: "#38BDF8" }}
                      thumbColor={capWebSearch ? "#FFFFFF" : "#A1A1AA"}
                    />
                  </View>

                  <View className="p-4 flex-row items-center justify-between">
                    <View className="flex-row items-start flex-1 mr-3">
                      <VectorIcon name="box" size={18} color="#A1A1AA" style={{ marginRight: 12, marginTop: 2 }} />
                      <View className="flex-1">
                        <Text className="text-white text-sm font-bold text-left mb-1">Artifacts</Text>
                        <Text className="text-zinc-400 text-xs text-left leading-4">Required by code execution</Text>
                      </View>
                    </View>
                    <Switch
                      value={capArtifacts}
                      onValueChange={setCapArtifacts}
                      trackColor={{ false: "#3F3F46", true: "#38BDF8" }}
                      thumbColor={capArtifacts ? "#FFFFFF" : "#A1A1AA"}
                    />
                  </View>

                  <View className="p-4 flex-row items-center justify-between">
                    <View className="flex-row items-start flex-1 mr-3">
                      <VectorIcon name="code" size={18} color="#A1A1AA" style={{ marginRight: 12, marginTop: 2 }} />
                      <View className="flex-1">
                        <Text className="text-white text-sm font-bold text-left mb-1">Code execution and file creation</Text>
                        <Text className="text-zinc-400 text-xs text-left leading-4">
                          Allow Retro Code to execute code and create and edit docs, spreadsheets, presentations, PDFs, and data reports.
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={capCodeExecution}
                      onValueChange={setCapCodeExecution}
                      trackColor={{ false: "#3F3F46", true: "#38BDF8" }}
                      thumbColor={capCodeExecution ? "#FFFFFF" : "#A1A1AA"}
                    />
                  </View>

                  <View className="p-4 flex-row items-center justify-between">
                    <View className="flex-row items-start flex-1 mr-3">
                      <VectorIcon name="rotate-ccw" size={18} color="#A1A1AA" style={{ marginRight: 12, marginTop: 2 }} />
                      <View className="flex-1">
                        <Text className="text-white text-sm font-bold text-left mb-1">Switch models when a message is flagged</Text>
                        <Text className="text-zinc-400 text-xs text-left leading-4">
                          When safety measures flag a message, automatically switch to a different model to keep chatting. When off, your chat will pause instead.
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={capSwitchModels}
                      onValueChange={setCapSwitchModels}
                      trackColor={{ false: "#3F3F46", true: "#38BDF8" }}
                      thumbColor={capSwitchModels ? "#FFFFFF" : "#A1A1AA"}
                    />
                  </View>
                </View>

                <Text className="text-zinc-400 text-xs font-semibold text-left mb-2">Memory</Text>
                <View className="bg-[#141417] p-4 rounded-2xl flex-row items-center justify-between mb-6">
                  <Text className="text-white text-sm font-bold">Memory</Text>
                  <Switch
                    value={capMemory}
                    onValueChange={setCapMemory}
                    trackColor={{ false: "#3F3F46", true: "#38BDF8" }}
                    thumbColor={capMemory ? "#FFFFFF" : "#A1A1AA"}
                  />
                </View>

                <Text className="text-zinc-400 text-xs font-semibold text-left mb-2">Tool access</Text>
                <View className="bg-[#141417] rounded-2xl overflow-hidden mb-6">
                  <TouchableOpacity
                    onPress={() => setSelectedToolAccess("auto")}
                    className="p-4 flex-row justify-between items-center active:bg-[#1E1E22]"
                  >
                    <View>
                      <Text className="text-sky-400 text-sm font-bold text-left mb-0.5">Auto</Text>
                      <Text className="text-zinc-400 text-xs text-left">Retro Code chooses for you</Text>
                    </View>
                    {selectedToolAccess === "auto" && <VectorIcon name="check" size={16} color="#38BDF8" />}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setSelectedToolAccess("ondemand")}
                    className="p-4 flex-row justify-between items-center active:bg-[#1E1E22]"
                  >
                    <View>
                      <Text className="text-white text-sm font-bold text-left mb-0.5">On demand</Text>
                      <Text className="text-zinc-400 text-xs text-left">Load when needed. More messages, lower accuracy</Text>
                    </View>
                    {selectedToolAccess === "ondemand" && <VectorIcon name="check" size={16} color="#38BDF8" />}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setSelectedToolAccess("always")}
                    className="p-4 flex-row justify-between items-center active:bg-[#1E1E22]"
                  >
                    <View>
                      <Text className="text-white text-sm font-bold text-left mb-0.5">Always available</Text>
                      <Text className="text-zinc-400 text-xs text-left">Ready from start. Fewer messages, better accuracy</Text>
                    </View>
                    {selectedToolAccess === "always" && <VectorIcon name="check" size={16} color="#38BDF8" />}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          )}

          {/* SUB-SCREEN 4: PERMISSIONS */}
          {profileSubScreen === "permissions" && (
            <View className="flex-1 bg-[#09090B]">
              <View className="flex-row items-center px-4 py-4">
                <TouchableOpacity 
                  onPress={() => setProfileSubScreen("main")} 
                  className="w-10 h-10 rounded-full bg-[#181818] items-center justify-center mr-3"
                >
                  <VectorIcon name="arrow-left" size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <Text className="text-white text-lg font-bold">Permissions</Text>
              </View>

              <ScrollView className="flex-1 px-4 py-5" showsVerticalScrollIndicator={false}>
                <View className="bg-[#141417] rounded-2xl overflow-hidden mb-6">
                  <View className="p-4 flex-row items-center justify-between">
                    <View className="flex-row items-start flex-1 mr-3">
                      <VectorIcon name="pin" size={18} color="#A1A1AA" style={{ marginRight: 12, marginTop: 2 }} />
                      <View className="flex-1">
                        <Text className="text-white text-sm font-bold text-left mb-1">Location</Text>
                        <Text className="text-zinc-400 text-xs text-left leading-4">
                          To allow access to your location, turn on the permission in your system settings.
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity className="flex-row items-center">
                      <Text className="text-zinc-400 text-xs mr-1">Settings</Text>
                      <VectorIcon name="arrow-right" size={10} color="#71717A" />
                    </TouchableOpacity>
                  </View>

                  <View className="p-4 flex-row items-center justify-between">
                    <View className="flex-row items-start flex-1 mr-3">
                      <VectorIcon name="calendar" size={18} color="#A1A1AA" style={{ marginRight: 12, marginTop: 2 }} />
                      <View className="flex-1">
                        <Text className="text-white text-sm font-bold text-left mb-1">Calendar</Text>
                        <Text className="text-zinc-400 text-xs text-left leading-4">
                          To allow access to your calendar, turn on the permission in your system settings.
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity className="flex-row items-center">
                      <Text className="text-zinc-400 text-xs mr-1">Settings</Text>
                      <VectorIcon name="arrow-right" size={10} color="#71717A" />
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          )}

          {/* SUB-SCREEN 5: USAGE AND CREDITS */}
          {profileSubScreen === "usage" && (
            <View className="flex-1 bg-[#0A0A0A]">
              <View className="flex-row items-center px-4 py-4">
                <TouchableOpacity 
                  onPress={() => setProfileSubScreen("main")} 
                  className="w-10 h-10 rounded-full bg-[#181818] items-center justify-center mr-3"
                >
                  <VectorIcon name="arrow-left" size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <Text className="text-white text-lg font-bold">Usage and credits</Text>
              </View>

              <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
                <View className="mb-6">
                  <Text className="text-white text-sm font-bold mb-1 text-left">Available usage-based credits</Text>
                  <TouchableOpacity activeOpacity={0.7} className="mb-4">
                    <Text className="text-zinc-400 text-xs text-left">
                      Learn more <Text className="text-zinc-500 text-xs">about how credits work.</Text>
                    </Text>
                  </TouchableOpacity>

                  <View className="bg-[#141414] p-4 rounded-2xl mb-3">
                    <View className="flex-row items-center justify-between mb-4">
                      <View>
                        <Text className="text-zinc-400 text-xs text-left mb-1">Available credits</Text>
                        <Text className="text-white text-2xl font-bold text-left">0</Text>
                      </View>
                      <TouchableOpacity className="bg-zinc-100 px-4 py-2 rounded-full active:bg-white items-center justify-center">
                        <Text style={{ color: "#000000", fontWeight: "700", fontSize: 12 }}>Add credits</Text>
                      </TouchableOpacity>
                    </View>

                    <View className="bg-red-950/40 p-3 rounded-xl">
                      <Text className="text-red-400 text-xs font-bold text-left mb-1">
                        ⓘ You're out of credits
                      </Text>
                      <Text className="text-red-300/80 text-[11px] text-left leading-4">
                        Add more credits or log on to desktop to enable auto-refill.
                      </Text>
                    </View>
                  </View>

                  <View className="bg-[#141414] px-4 py-3 rounded-xl flex-row justify-between">
                    <Text className="text-zinc-400 text-xs font-medium">Credit grant</Text>
                    <Text className="text-zinc-400 text-xs font-medium">Amount granted</Text>
                  </View>
                </View>

                <View className="mb-6">
                  <Text className="text-white text-sm font-bold mb-3 text-left">Credit usage</Text>
                  <View className="flex-row flex-wrap justify-between">
                    <View className="w-[48%] bg-[#141414] p-3.5 rounded-2xl mb-3">
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-white text-xs font-bold">Text usage</Text>
                        <VectorIcon name="chart" size={15} color="#A1A1AA" />
                      </View>
                      <Text className="text-white text-xl font-bold mb-0.5 text-left">0</Text>
                      <Text className="text-zinc-500 text-[10px] text-left">credits this month</Text>
                    </View>

                    <View className="w-[48%] bg-[#141414] p-3.5 rounded-2xl mb-3">
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-white text-xs font-bold">Image usage</Text>
                        <VectorIcon name="image" size={15} color="#A1A1AA" />
                      </View>
                      <Text className="text-white text-xl font-bold mb-0.5 text-left">0</Text>
                      <Text className="text-zinc-500 text-[10px] text-left">credits this month</Text>
                    </View>

                    <View className="w-[48%] bg-[#141414] p-3.5 rounded-2xl mb-3">
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-white text-xs font-bold">Video usage</Text>
                        <VectorIcon name="video" size={15} color="#A1A1AA" />
                      </View>
                      <Text className="text-white text-xl font-bold mb-0.5 text-left">0</Text>
                      <Text className="text-zinc-500 text-[10px] text-left">credits this month</Text>
                    </View>

                    <View className="w-[48%] bg-[#141414] p-3.5 rounded-2xl mb-3">
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-white text-xs font-bold">Audio usage</Text>
                        <VectorIcon name="mic" size={15} color="#A1A1AA" />
                      </View>
                      <Text className="text-white text-xl font-bold mb-0.5 text-left">0</Text>
                      <Text className="text-zinc-500 text-[10px] text-left">credits this month</Text>
                    </View>
                  </View>
                </View>

                <View className="bg-[#141414] rounded-2xl overflow-hidden">
                  <View className="flex-row justify-between px-4 py-3 bg-[#1A1A1A]">
                    <Text className="text-zinc-400 text-xs font-medium">Session</Text>
                    <Text className="text-zinc-400 text-xs font-medium">Date</Text>
                    <Text className="text-zinc-400 text-xs font-medium">Credits</Text>
                  </View>
                  <View className="py-8 items-center justify-center">
                    <Text className="text-zinc-500 text-xs">No usage for specific dates</Text>
                  </View>
                </View>
              </ScrollView>
            </View>
          )}

        </View>
      </Modal>

      {/* =================================================================== */}
      {/* 13. MODAL 10: PERPLEXITY MODELS SELECTOR SHEET                      */}
      {/* =================================================================== */}
      <Modal
        visible={showModelsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModelsModal(false)}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setShowModelsModal(false)} 
          className="flex-1 justify-end bg-black/60"
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: isLight ? "#FFFFFF" : bgCard, borderColor: isLight ? "#E2E8F0" : "rgba(255,255,255,0.1)" }} 
            className="h-[52%] rounded-t-[32px] px-5 pt-3 pb-4 shadow-2xl border flex-col"
          >
            {/* Top Drag Indicator Handle */}
            <View className="items-center mb-1.5">
              <View style={{ backgroundColor: isLight ? "#CBD5E1" : "#52525B" }} className="w-10 h-1 rounded-full" />
            </View>

            {/* Header Row */}
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-baseline">
                <Text style={{ color: textPrimary }} className="text-lg font-bold mr-2">Models</Text>
                <Text style={{ color: textSecondary }} className="text-xs font-medium">Best AI Engines</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowModelsModal(false)}
                style={{ backgroundColor: isLight ? "#F1F5F9" : "#1A1A1A" }}
                className="w-7 h-7 rounded-full items-center justify-center border border-slate-200/50"
              >
                <VectorIcon name="x" size={13} color={isLight ? "#0F172A" : "#A1A1AA"} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Models List */}
            <ScrollView className="flex-1 mt-1" showsVerticalScrollIndicator={false}>
              {AI_MODELS_DATA.map((model) => {
                const isSelected = selectedModelId === model.id;

                return (
                  <TouchableOpacity
                    key={model.id}
                    onPress={() => setSelectedModelId(model.id)}
                    activeOpacity={0.9}
                    style={{
                      backgroundColor: isSelected 
                        ? (isLight ? "#F1F5F9" : "#1C1C1C")
                        : (isLight ? "#FAFAFA" : "transparent"),
                      borderColor: isSelected
                        ? (isLight ? "#CBD5E1" : "rgba(255,255,255,0.15)")
                        : (isLight ? "#F1F5F9" : "transparent")
                    }}
                    className="mb-2 p-3 rounded-2xl transition-all border"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <VectorIcon name={model.icon} size={15} color={model.color} style={{ marginRight: 8 }} />
                        <Text style={{ color: textPrimary }} className="text-sm font-semibold mr-2">
                          {model.name}
                        </Text>
                        
                        {model.badge && (
                          <View className="bg-sky-500/20 px-1.5 py-0.5 rounded mr-1">
                            <Text className="text-sky-400 text-[9px] font-mono uppercase">{model.badge}</Text>
                          </View>
                        )}
                        {model.badgeExtra && (
                          <View className="bg-emerald-500/20 px-1.5 py-0.5 rounded">
                            <Text className="text-emerald-400 text-[9px] font-mono uppercase">{model.badgeExtra}</Text>
                          </View>
                        )}
                      </View>

                      {isSelected && (
                        <VectorIcon name="check" size={15} color="#38BDF8" />
                      )}
                    </View>

                    <Text style={{ color: textSecondary }} className="text-xs mt-1 pl-6 opacity-90 text-left">
                      {model.description}
                    </Text>

                    {isSelected && (
                      <View className="mt-3 pt-2.5 flex-row items-center justify-between pl-6 border-t border-slate-200/40">
                        <Text style={{ color: textPrimary }} className="text-xs font-semibold">Thinking Mode</Text>
                        <Switch
                          value={isThinkingEnabled}
                          onValueChange={setIsThinkingEnabled}
                          trackColor={{ false: "#3F3F46", true: "#38BDF8" }}
                          thumbColor={isThinkingEnabled ? "#FFFFFF" : "#A1A1AA"}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* =================================================================== */}
      {/* 14. MODAL 11: PROJECT FILES TREE & HISTORY SHEET                   */}
      {/* =================================================================== */}
      <Modal
        visible={showFileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFileModal(false)}
      >
        <View className="flex-1 justify-end bg-black/80">
          <View className="h-3/4 bg-[#0F0F0F] p-4 rounded-t-[28px]">
            <View className="flex-row justify-between items-center mb-4 pb-3">
              <Text className="text-zinc-200 text-sm font-bold">📑 Project Files & History</Text>
              <TouchableOpacity onPress={() => setShowFileModal(false)} className="p-1">
                <VectorIcon name="x" size={14} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1">
              {MOCK_FILE_TREE.map((node) => (
                <View key={node.name} className="mb-3 pl-2">
                  <View className="flex-row items-center mb-1">
                    <VectorIcon name={node.type === "folder" ? "folder" : "file-text"} size={14} color="#F59E0B" style={{ marginRight: 6 }} />
                    <Text className="text-zinc-300 text-xs font-mono font-bold">
                      {node.name}
                    </Text>
                  </View>
                  {node.children?.map((child) => (
                    <View key={child.name} className="py-2.5 px-3 bg-[#1A1A1A] rounded-xl flex-row justify-between items-center mb-1.5">
                      <View className="flex-row items-center">
                        <VectorIcon name="file-text" size={13} color="#38BDF8" style={{ marginRight: 6 }} />
                        <Text className="text-zinc-300 text-xs font-mono">{child.name}</Text>
                      </View>
                      <Text className="text-zinc-500 text-[10px]">{child.size}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};
