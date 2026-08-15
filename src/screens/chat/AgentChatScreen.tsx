/**
 * frontend/src/screens/chat/AgentChatScreen.tsx
 * ============================================================================
 * PURE OBSIDIAN BLACK THEME (#000000) AGENT WORKSPACE & AI CODING IDE
 * APPLICATION BRAND: RETRO CODE
 * SEAMLESS BORDERLESS MODERN DESIGN SYSTEM (CLEAN SLEEK MINIMALISM)
 * ============================================================================
 * 
 * Everything here talks to the real backend: prompts go through agent-run (or
 * agent-ask in incognito), progress is polled from agent_tasks, and files,
 * checkpoints and sessions come from their own services. There are no
 * placeholders left in this screen.
 *
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from "react";
import { View, ScrollView, TouchableOpacity, TextInput, SafeAreaView, Modal, Platform, ActivityIndicator, Alert } from "react-native";
import { confirmAction, notify } from "../../services/notify";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { useTheme } from "../../theme/ThemeProvider";
import { useThemeStore } from "../../theme/store";
import { type ThemeMode } from "../../theme/theme";
import { type ProjectNavigationProp } from "../../navigation/types";
import { useProjects } from "../../hooks/useProjects";
import { agentService, type AgentTaskData, type AgentSessionData } from "../../services/agentService";
import {
  createCheckpoint,
  getProjectCheckpoints,
  relativeTime,
  restoreCheckpoint,
  type CheckpointRow,
} from "../../services/checkpointService";
import { useAuthStore } from "../../stores/authStore";
import { supabase } from "../../services/supabase";
import { useSettingsStore } from "../../stores/settingsStore";
import { getUsage, type UsageSummary } from "../../services/usageService";
import { getProjectFiles, toFileEntries, type ProjectFileEntry } from "../../services/fileService";
import { buildPreviewHtml } from "../../services/previewBuilder";
import { ToolRunPanel, ToolRunRow, type ToolRunStep } from "../../components/ToolRunRow";
import { AgentMessageText } from "../../components/AgentMessageText";
import { PreviewSurface } from "../../components/PreviewSurface";
import { Icon as VectorIcon } from "../../components/Icon";

// ============================================================================
// 1. DATA MODELS & INITIAL STATE SCHEMAS
// ============================================================================

/**
 * AI Models Directory
 * Ids must match the server's ALLOWED_MODELS allow-list; the server rejects anything else.
 */
/**
 * Selectable models. These ids are sent to agent-run, which only honours ids on
 * its own allow-list (ALLOWED_MODELS) — anything else falls back to the server
 * default, so the picker can never point the agent at an arbitrary model.
 */
const AI_MODELS_DATA = [
  { id: "auto", name: "Auto", icon: "zap", color: "#F59E0B", category: "Best", description: "Let the server pick the default model" },
  { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", icon: "zap", color: "#22C55E", badge: "default", category: "Best", description: "Fast general coding model" },
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", icon: "code", color: "#38BDF8", category: "Best", description: "Fast and economical" },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner", icon: "sparkles", color: "#6366F1", category: "Best", description: "Deeper reasoning for complex tasks" },
];

/**
 * "/" shortcuts. These are prompt expansions, not backend commands — each one
 * writes a complete instruction into the composer so the agent receives real
 * intent instead of a bare token it would not understand.
 */
const SLASH_COMMANDS = [
  {
    cmd: "/plan",
    icon: "sparkles",
    label: "Plan before changing anything",
    expands: "Before editing anything, inspect the project and give me a short step-by-step plan. Wait for my approval.",
  },
  {
    cmd: "/refactor",
    icon: "zap",
    label: "Clean up code without changing behaviour",
    expands: "Refactor the following for clarity without changing behaviour, then summarise what you changed:",
  },
  {
    cmd: "/test",
    icon: "check",
    label: "Add tests",
    expands: "Write tests covering the main cases and edge cases for:",
  },
  {
    cmd: "/fix",
    icon: "code",
    label: "Diagnose and fix an error",
    expands: "Find the cause of this problem, fix it, and explain the root cause:",
  },
  {
    cmd: "/explain",
    icon: "info",
    label: "Explain how something works",
    expands: "Read the relevant files and explain, in plain language, how this works:",
  },
] as const;

/** Starter templates — must mirror supabase/functions/shared/templates.ts */
const PROJECT_TEMPLATE_CHOICES = [
  { id: "landing", label: "Landing", icon: "zap" },
  { id: "todo", label: "Todo", icon: "check" },
  { id: "gallery", label: "Gallery", icon: "image" },
  { id: "blog", label: "Blog", icon: "file-text" },
  { id: "quiz", label: "Quiz", icon: "sparkles" },
  { id: "blank", label: "Blank", icon: "folder" },
];


/** All three theme modes are reachable from the one control that offers them. */
const THEME_MODE_LABEL: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  darkest: "Darkest",
};
const NEXT_THEME_MODE: Record<ThemeMode, ThemeMode> = {
  light: "dark",
  dark: "darkest",
  darkest: "light",
};

// ============================================================================
// 2. MAIN SCREEN COMPONENT
// ============================================================================

export const AgentChatScreen = () => {
  const { colors } = useTheme();
  const { mode, setMode } = useThemeStore();
  const navigation = useNavigation<ProjectNavigationProp>();
  const route = useRoute();
  const scrollViewRef = useRef<ScrollView>(null);

  const isLight = mode === "light";
  const bgCanvas = isLight ? "#FFFFFF" : "#000000";      // Pure 100% Crisp White (#FFFFFF)
  const bgCard = isLight ? "#FFFFFF" : "#141414";        // Pure White card (#FFFFFF)
  const bgPill = isLight ? "#F1F5F9" : "#242424";        // Clean soft white/gray pill (#F1F5F9)
  const textPrimary = isLight ? "#0F172A" : "#FFFFFF";   // Dark Slate Charcoal text (#0F172A)
  const textSecondary = isLight ? "#475569" : "#A1A1AA"; // Muted Slate text (#475569)
  const textMuted = isLight ? "#94A3B8" : "#71717A";     // Placeholder text (#94A3B8)

  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------
  
  // Active Workspace Mode: 'chat' (General Q&A) vs 'build' (AI Agent IDE Workspace)
  const [activeMode, setActiveMode] = useState<"chat" | "build">("build");
  
  // Anonymous / Incognito Mode: When true, sessions are not logged or saved to database
  const [isIncognito, setIsIncognito] = useState(false);
  
  // Selected Model & Thinking Reasoning Toggle State
  const defaultModel = useSettingsStore((s) => s.defaultModel);
  const [selectedModelId, setSelectedModelId] = useState<string>(defaultModel);
  
  // Chat Stream Messages & Execution State
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [forkingMessageId, setForkingMessageId] = useState<string | null>(null);
  const [threadTitle, setThreadTitle] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);

  // Live agent session wiring (agent-run → job_queue → queue-worker → agent_tasks)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const runStartedAtRef = useRef<string | null>(null);
  const { projects, createProject, deleteProject } = useProjects();
  const { profile, user, signOut } = useAuthStore();
  // Guests have no profile row and no email, so they are named as what
  // they are rather than given someone else's placeholder name.
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Guest";

  // On-device live preview state (Phase 2 killer feature)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Template picked in the New Project dialog
  const [newProjectTemplate, setNewProjectTemplate] = useState<string>("landing");
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Real project files for the file-tree sheet
  const [fileEntries, setFileEntries] = useState<ProjectFileEntry[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  // Real chat sessions per project, for the drawer tree
  const [drawerSessions, setDrawerSessions] = useState<Record<string, AgentSessionData[]>>({});
  const [drawerQuery, setDrawerQuery] = useState("");

  // Real checkpoints for the active project
  const [checkpoints, setCheckpoints] = useState<CheckpointRow[]>([]);
  const [checkpointsLoading, setCheckpointsLoading] = useState(false);
  const [restoringCheckpointId, setRestoringCheckpointId] = useState<string | null>(null);
  const [savingCheckpoint, setSavingCheckpoint] = useState(false);

  // Real token usage (usage-check → usage_metering)
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  
  // Modal Visibility Controllers
  const [showDrawerModal, setShowDrawerModal] = useState(false);        // Drawer Dashboard
  const [showAddToChatModal, setShowAddToChatModal] = useState(false);  // '+' Add to Chat Sheet
  const [showProjectsModal, setShowProjectsModal] = useState(false);    // Projects List Sheet
  const [showNewProjectModal, setShowNewProjectModal] = useState(false); // New Project Dialog
  const [showModelsModal, setShowModelsModal] = useState(false);        // Models Selector Sheet
  const [showFileModal, setShowFileModal] = useState(false);          // File Tree Sheet
  const [showProfileModal, setShowProfileModal] = useState(false);      // Master Profile Settings Modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);      // Live Web App Sandbox Preview Modal
  const [showCheckpointsModal, setShowCheckpointsModal] = useState(false); // Restore-point history and rollback sheet

  // Auto-complete Popups (@ Mentions & / Commands)
  const [showMentionsPopup, setShowMentionsPopup] = useState(false);
  const [showSlashPopup, setShowSlashPopup] = useState(false);

  /**
   * Opened with a project/session (e.g. "Resume" from chat history, or a deep
   * link): adopt them and restore the conversation. Previously these route
   * params were ignored, so Resume silently opened an empty new chat.
   */
  useEffect(() => {
    const params = (route.params ?? {}) as { projectId?: string; sessionId?: string };
    if (!params.projectId && !params.sessionId) return;

    if (params.projectId) {
      setActiveProjectId(params.projectId);
      const match = projects.find((p) => p.id === params.projectId);
      if (match) setActiveProjectName(match.name);
    }
    if (params.sessionId && params.sessionId !== activeSessionId) {
      const project = params.projectId
        ? { id: params.projectId, name: projects.find((p) => p.id === params.projectId)?.name ?? "" }
        : { id: activeProjectId ?? "", name: activeProjectName };
      void handleLoadSession({ id: params.sessionId }, project);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params, projects.length]);
  
  // Active Selected Project State (Empty by default, populated when user selects a project)
  const [activeProjectName, setActiveProjectName] = useState<string>("");
  
  // Settings sheet view: the menu, or the usage panel.
  const [profileSubScreen, setProfileSubScreen] = useState<"main" | "usage">("main");
  
  // User Profile Settings Form States

  // Projects Form Search State
  const [newProjectName, setNewProjectName] = useState("");

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
      void loadFileEntries(); // populate the picker with this project's real files
    } else if (text.endsWith("/")) {
      setShowSlashPopup(true);
      setShowMentionsPopup(false);
    } else {
      setShowMentionsPopup(false);
      setShowSlashPopup(false);
    }
  };

  /** Attach a real file path: replaces the trailing "@" with `path`. */
  const handleSelectMention = (filePath: string) => {
    setInputText((prev) => `${prev.replace(/@$/, "")}${filePath} `);
    setShowMentionsPopup(false);
  };

  /** Expand a shortcut into the full instruction it stands for. */
  const handleSelectSlashCommand = (cmd: string) => {
    const command = SLASH_COMMANDS.find((entry) => entry.cmd === cmd);
    setInputText((prev) => `${prev.replace(/\/$/, "")}${command?.expands ?? cmd} `);
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

  /** Load real chat sessions for every project when the drawer opens. */
  useEffect(() => {
    if (!showDrawerModal || projects.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        projects.map(async (project) => {
          try {
            return [project.id, await agentService.getProjectSessions(project.id)] as const;
          } catch {
            return [project.id, [] as AgentSessionData[]] as const;
          }
        }),
      );
      if (!cancelled) setDrawerSessions(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDrawerModal, projects.length]);

  /** Load real token usage when the usage sub-screen opens. */
  useEffect(() => {
    if (profileSubScreen !== "usage") return;
    let cancelled = false;
    setUsageLoading(true);
    setUsageError(null);
    (async () => {
      try {
        const summary = await getUsage();
        if (!cancelled) setUsage(summary);
      } catch (e) {
        if (!cancelled) {
          setUsage(null);
          setUsageError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setUsageLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profileSubScreen]);

  const loadCheckpoints = async (projectId: string) => {
    setCheckpointsLoading(true);
    try {
      setCheckpoints(await getProjectCheckpoints(projectId));
    } catch {
      setCheckpoints([]);
    } finally {
      setCheckpointsLoading(false);
    }
  };

  /** Load real checkpoints when the checkpoints modal opens. */
  useEffect(() => {
    if (!showCheckpointsModal) return;
    void (async () => {
      const projectId = await ensureProjectId();
      await loadCheckpoints(projectId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCheckpointsModal]);

  /** Fetch the project's real file list (file-tree sheet and the "@" picker). */
  const loadFileEntries = async () => {
    setFilesLoading(true);
    setFilesError(null);
    try {
      const projectId = await ensureProjectId();
      setFileEntries(toFileEntries(await getProjectFiles(projectId)));
    } catch (e) {
      setFileEntries([]);
      setFilesError(e instanceof Error ? e.message : String(e));
    } finally {
      setFilesLoading(false);
    }
  };

  useEffect(() => {
    if (showFileModal) void loadFileEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFileModal]);

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

    // Incognito answers come straight back in the response — no session, no
    // transcript, no job queue — so the conversation exists only in this state.
    if (isIncognito) {
      setIsExecuting(true);
      try {
        const history = messages
          .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
          .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content) }));
        const answer = await agentService.askIncognito(userPromptText, history, selectedModelId);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_agent_${Date.now()}`,
            role: "assistant",
            content: answer.text || "(no answer)",
            createdAt: Date.now(),
            isIncognito,
          },
        ]);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_err_${Date.now()}`,
            role: "assistant",
            content: `⚠️ Incognito reply failed: ${e instanceof Error ? e.message : String(e)}`,
            createdAt: Date.now(),
            isIncognito,
          },
        ]);
      } finally {
        setIsExecuting(false);
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
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
        model: selectedModelId,
        // Chat mode answers questions about the project without being able to
        // change it; Build mode is the full agent.
        profile: activeMode === "chat" ? "readonly" : "standard",
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
   * Save a restore point on demand — the "before I try this" button. Runs are
   * snapshotted automatically, so this is for the moments in between (a manual
   * edit in the file viewer, or just wanting a marker).
   */
  const handleSaveRestorePoint = async () => {
    if (savingCheckpoint) return;
    setSavingCheckpoint(true);
    try {
      const projectId = await ensureProjectId();
      const result = await createCheckpoint(projectId, activeSessionId);
      if (!result.checkpoint) {
        notify("Nothing to save", result.detail ?? "This project has no files yet.");
      } else {
        await loadCheckpoints(projectId);
      }
    } catch (e) {
      notify("Could not save a restore point", e instanceof Error ? e.message : String(e));
    } finally {
      setSavingCheckpoint(false);
    }
  };

  const saveRestorePointButton = (
    <TouchableOpacity
      onPress={handleSaveRestorePoint}
      disabled={savingCheckpoint || isExecuting}
      className="flex-row items-center justify-center py-2.5 mb-4 rounded-xl bg-[#1A1A1A] border border-zinc-800"
      activeOpacity={0.8}
    >
      {savingCheckpoint ? (
        <ActivityIndicator size="small" color="#C084FC" />
      ) : (
        <>
          <VectorIcon name="plus" size={13} color="#C084FC" style={{ marginRight: 6 }} />
          <Text className="text-purple-300 text-xs font-semibold">Save a restore point now</Text>
        </>
      )}
    </TouchableOpacity>
  );

  /**
   * Roll the project's files back to a snapshot.
   *
   * This overwrites the working files, so it asks first. The backend snapshots
   * the current state before swapping, which is why the confirmation can
   * honestly say the rollback is itself undoable.
   */
  const handleRollback = async (checkpointId: string, description: string) => {
    if (restoringCheckpointId) return;
    const confirmed = await confirmAction(
      "Roll back the project?",
      `Every file goes back to how it was ${description}. A restore point is saved first, so you can undo this too.`,
    );
    if (!confirmed) return;

    setRestoringCheckpointId(checkpointId);
    try {
      const result = await restoreCheckpoint(checkpointId);
      setShowCheckpointsModal(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_restore_${Date.now()}`,
          role: "assistant",
          content: `Rolled the project back — ${result.files_restored} file(s) restored.`,
          createdAt: Date.now(),
          hasCodeEdit: true,
          // Offer the reverse straight away.
          checkpointId: result.safety_checkpoint_id ?? null,
        },
      ]);
      // The file list and any open preview are now stale.
      setFileEntries([]);
      if (activeProjectId) void loadCheckpoints(activeProjectId);
    } catch (e) {
      notify("Rollback failed", e instanceof Error ? e.message : String(e));
    } finally {
      setRestoringCheckpointId(null);
    }
  };

  /**
   * Branch the conversation at one of your own prompts. The original session is
   * left untouched — agent-fork copies the transcript up to that message into a
   * new session, so you can take the conversation a different way without
   * losing what the agent already did.
   */
  const handleForkFrom = async (message: any) => {
    if (!activeSessionId || forkingMessageId) return;
    setForkingMessageId(message.id);
    try {
      const forked = await agentService.forkAgentSession(activeSessionId, message.transcriptIndex);
      setActiveSessionId(forked.id);
      setThreadTitle(forked.title ?? "Forked session");
      runStartedAtRef.current = null;
      // Show exactly what the fork contains: everything through this prompt.
      setMessages((prev) => {
        const cut = prev.findIndex((m) => m.id === message.id);
        return cut === -1 ? prev : prev.slice(0, cut + 1);
      });
      notify("Branched", "This is a new session — the original is untouched.");
    } catch (e) {
      notify("Could not branch", e instanceof Error ? e.message : String(e));
    } finally {
      setForkingMessageId(null);
    }
  };

  /**
   * Messages typed in this session have no transcript position until the worker
   * has written them, so forking is unavailable on them. Once a run finishes we
   * read the stored transcript back and attach each user prompt's real index.
   * Both lists are append-only and in the same order, so a sequential walk
   * pairs them up; the content check keeps a mismatch from labelling the wrong
   * message.
   */
  const backfillTranscriptIndices = async (sessionId: string) => {
    let transcript: any[];
    try {
      const full = await agentService.getSession(sessionId);
      transcript = Array.isArray(full.transcript) ? full.transcript : [];
    } catch {
      return; // Fork stays unavailable for this turn; nothing else is affected.
    }
    const stored = transcript
      .map((m: any, transcriptIndex: number) => ({ m, transcriptIndex }))
      .filter(({ m }: any) => m?.role === "user" && m?.content);

    setMessages((prev) => {
      let next = 0;
      return prev.map((m) => {
        if (m.role !== "user") return m;
        const candidate = stored[next++];
        if (!candidate || String(candidate.m.content) !== m.content) return m;
        return { ...m, transcriptIndex: candidate.transcriptIndex };
      });
    });
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
          target: t.tool_input?.target ?? undefined,
          status: t.status === "success" ? "completed" : t.status === "failed" ? "failed" : "running",
          metrics: t.tool_output?.metrics ?? undefined,
          durationMs: t.duration_ms ?? undefined,
          error: t.tool_output?.error ?? undefined,
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
            // The worker snapshots before it runs and reports the id here, so
            // this message can offer to undo exactly what it did.
            checkpointId: touchedWorkspace
              ? (runRow.tool_output?.checkpoint_id ?? null)
              : null,
          },
        ]);
        setIsExecuting(false);
        scrollViewRef.current?.scrollToEnd({ animated: true });
        void backfillTranscriptIndices(activeSessionId);
      }
    };

    void tick();

    // Realtime pushes each agent_tasks write the instant the worker makes it,
    // so steps appear immediately instead of up to a poll late. It can't be
    // relied on blindly though (blocked sockets, proxies, dropped channels), so
    // polling stays — fast until the channel confirms it is live, then slow.
    const FAST_MS = 2500;
    const SLOW_MS = 8000;
    let interval = setInterval(tick, FAST_MS);

    const channel = supabase
      .channel(`agent_tasks:${activeSessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_tasks", filter: `session_id=eq.${activeSessionId}` },
        () => { void tick(); },
      )
      .subscribe((status) => {
        if (cancelled) return;
        // Only back off once events are actually flowing; on any error or drop
        // go back to fast polling so the UI never stalls.
        clearInterval(interval);
        interval = setInterval(tick, status === "SUBSCRIBED" ? SLOW_MS : FAST_MS);
      });

    return () => {
      cancelled = true;
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [activeSessionId, isExecuting]);

  /**
   * Toggle Incognito State. An incognito chat has no stored session, so the
   * active one is dropped as well — otherwise the task poller would keep
   * attributing the previous conversation's steps to this one.
   */
  const handleToggleIncognito = () => {
    const nextIncognitoState = !isIncognito;
    setIsIncognito(nextIncognitoState);
    if (nextIncognitoState) {
      setMessages([]);
      setThreadTitle("");
      setActiveSessionId(null);
      runStartedAtRef.current = null;
    }
  };

  /**
   * Chat vs Build is a real difference in what the agent may do: Build runs
   * with the standard profile and can write files, Chat runs read-only. The
   * backend fixes a session's profile at creation, so switching modes starts a
   * new conversation rather than silently keeping the old permissions.
   */
  const handleSelectMode = (mode: "chat" | "build") => {
    if (mode === activeMode || isExecuting) return;
    setActiveMode(mode);
    if (activeSessionId) {
      setActiveSessionId(null);
      setMessages([]);
      setThreadTitle("");
      runStartedAtRef.current = null;
    }
  };


  // Open Projects Sheet from Drawer
  const handleOpenProjectsFromDrawer = () => {
    setShowDrawerModal(false);
    setShowProjectsModal(true);
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
  /**
   * The chat screen lives in MainTabs → AgentTab, so the Profile stack and the
   * root modals have to be addressed through their parents. Without these the
   * 20-odd built screens were unreachable.
   */
  const goTo = (screen: string, params?: object) => {
    setShowProfileModal(false);
    setShowDrawerModal(false);
    (navigation as unknown as { navigate: (n: string, p?: object) => void }).navigate(screen, params);
  };

  const goToProfile = (screen: string, params?: object) =>
    goTo("ProfileTab", { screen, params });

  const goToProject = (screen: string, params?: object) =>
    goTo("ProjectsTab", { screen, params });

  /** Really sign out (this used to only close the settings sheet). */
  const handleSignOut = async () => {
    setShowProfileModal(false);
    try {
      await signOut();
    } catch (e) {
      notify("Could not sign out", e instanceof Error ? e.message : String(e));
    }
  };

  /** Delete a project (and its files) from the projects sheet, with confirmation. */
  const handleDeleteProjectFromSheet = async (projectId: string, projectName: string) => {
    const run = async () => {
      try {
        await deleteProject(projectId);
        if (activeProjectId === projectId) {
          setActiveProjectId(null);
          setActiveProjectName("");
          setActiveSessionId(null);
          setMessages([]);
          setThreadTitle("");
        }
      } catch (e) {
        notify("Could not delete", e instanceof Error ? e.message : String(e));
      }
    };
    const confirmed = await confirmAction(
      "Delete project",
      `Delete “${projectName}” and all of its files? This cannot be undone.`,
    );
    if (confirmed) await run();
  };

  const handleOpenProjectFolder = (projectId: string, projectName: string) => {
    setShowDrawerModal(false);
    setIsIncognito(false);
    setActiveProjectId(projectId);
    setActiveProjectName(projectName);
    setActiveSessionId(null);
    runStartedAtRef.current = null;
    setThreadTitle("");
    setMessages([]); // Shows Project Conversations List View
  };

  /**
   * Load a real session: fetch its transcript from agent_sessions and render it.
   * Continuing the thread then goes through agent-run with this session id.
   */
  const handleLoadSession = async (
    session: { id: string; title?: string | null },
    project: { id: string; name: string },
  ) => {
    setShowDrawerModal(false);
    setIsIncognito(false);
    setActiveProjectId(project.id);
    setActiveProjectName(project.name);
    setActiveSessionId(session.id);
    runStartedAtRef.current = null;
    setThreadTitle(session.title ?? "");
    setMessages([
      { id: `loading_${session.id}`, role: "assistant", content: "Loading conversation…", createdAt: Date.now() },
    ]);

    try {
      const full = await agentService.getSession(session.id);
      const transcript = Array.isArray(full.transcript) ? full.transcript : [];
      const restored = transcript
        // transcriptIndex is the position in the *raw* transcript, which is what
        // agent-fork slices on — it is not the index in this filtered list.
        .map((m: any, transcriptIndex: number) => ({ m, transcriptIndex }))
        .filter(({ m }: any) => (m?.role === "user" || m?.role === "assistant") && m?.content)
        .map(({ m, transcriptIndex }: any) => ({
          id: m.id ?? `restored_${session.id}_${transcriptIndex}`,
          role: m.role,
          content: String(m.content),
          createdAt: m.createdAt ?? Date.now(),
          transcriptIndex,
        }));
      setMessages(
        restored.length
          ? restored
          : [{
              id: `empty_${session.id}`,
              role: "assistant",
              content: "This conversation has no messages yet. Send a prompt to continue it.",
              createdAt: Date.now(),
            }],
      );
    } catch (e) {
      setMessages([{
        id: `err_${session.id}`,
        role: "assistant",
        content: `⚠️ Could not load this conversation: ${e instanceof Error ? e.message : String(e)}`,
        createdAt: Date.now(),
      }]);
    }
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
                onPress={() => handleSelectMode("chat")}
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
                onPress={() => handleSelectMode("build")}
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

          {/* Top-right incognito toggle */}
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
                {isIncognito ? "Incognito Chat" : (threadTitle || activeProjectName || "New chat")}
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
                This chat is not saved anywhere.
              </Text>

              <Text style={{ color: textSecondary }} className="text-xs text-center leading-5 max-w-[300px]">
                No session, no history, no record of what you asked — the answer comes
                straight back and lives only on this screen. Closing the chat loses it.
              </Text>
              <Text style={{ color: textSecondary }} className="text-xs text-center leading-5 max-w-[300px] mt-3">
                In exchange there are no tools: the agent can't read or change your
                project files here. Turn incognito off to build.
              </Text>
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

              {/* Real conversations for this project */}
              <View className="space-y-3">
                {(activeProjectId ? drawerSessions[activeProjectId] ?? [] : []).length === 0 ? (
                  <View className="items-center py-8 px-4">
                    <Text style={{ color: textSecondary }} className="text-xs text-center leading-5">
                      No conversations in this project yet. Type below to start one.
                    </Text>
                  </View>
                ) : (
                  (drawerSessions[activeProjectId!] ?? []).map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() =>
                        handleLoadSession(item, { id: activeProjectId!, name: activeProjectName })
                      }
                      style={{ backgroundColor: isLight ? "#FFFFFF" : "#141414", borderColor: isLight ? "#E2E8F0" : "rgba(39, 39, 42, 0.4)" }}
                      className="mb-3 p-4 rounded-2xl border active:opacity-80 shadow-sm"
                    >
                      <Text style={{ color: textPrimary }} className="text-sm font-semibold mb-2 text-left" numberOfLines={1}>
                        {item.title || "Untitled chat"}
                      </Text>
                      <View className="flex-row items-center justify-between">
                        <Text style={{ color: textSecondary }} className="text-xs">
                          {relativeTime(item.updated_at ?? item.created_at)}
                        </Text>
                        <Text style={{ color: textMuted }} className="text-[10px] font-mono">
                          {item.token_usage_total ? `${item.token_usage_total.toLocaleString()} tokens` : item.status}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
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
                // Only prompts the backend has stored can be branched — the
                // fork endpoint slices on a transcript position we don't know
                // for a message that is still in flight.
                const canFork = typeof msg.transcriptIndex === "number" && !isExecuting;
                return (
                  <View key={msg.id} className="mb-6 items-end">
                    <View style={{ backgroundColor: isLight ? "#F1F5F9" : "#231B32", borderColor: isLight ? "#E2E8F0" : "transparent" }} className="max-w-[92%] p-4 rounded-3xl border shadow-sm">
                      <Text style={{ color: textPrimary }} className="text-sm leading-6 text-left font-sans font-medium">
                        {msg.content}
                      </Text>
                    </View>
                    {canFork && (
                      <TouchableOpacity
                        onPress={() => handleForkFrom(msg)}
                        disabled={forkingMessageId !== null}
                        className="flex-row items-center mt-1.5 mr-1 py-1 px-2"
                        accessibilityLabel="Branch the conversation from this message"
                      >
                        {forkingMessageId === msg.id ? (
                          <ActivityIndicator size="small" color={textSecondary} />
                        ) : (
                          <>
                            <VectorIcon name="branch" size={11} color={textSecondary} style={{ marginRight: 5 }} />
                            <Text style={{ color: textSecondary }} className="text-[11px] font-mono">
                              branch from here
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }

              /* Assistant Response Component Stream */
              const toolRunSteps: ToolRunStep[] = (msg.steps ?? []).filter(
                (s: any) => s?.type === "tool_run",
              );
              const otherSteps = (msg.steps ?? []).filter((s: any) => s?.type !== "tool_run");

              return (
                <View key={msg.id} className="mb-6">
                  {/* Terminal-style execution log: one panel per agent turn */}
                  {toolRunSteps.length > 0 && (
                    <ToolRunPanel isLight={isLight}>
                      {toolRunSteps.map((step, sIdx) => (
                        <ToolRunRow key={sIdx} step={step} isLight={isLight} />
                      ))}
                    </ToolRunPanel>
                  )}

                  {msg.content ? (
                    <AgentMessageText content={msg.content} isLight={isLight} textColor={textPrimary} />
                  ) : null}

                  {/* Legacy step renderers (commands, thoughts, diff cards) */}
                  {otherSteps.map((step: any, sIdx: number) => {
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

                      {/* Undo this turn — the worker snapshotted the project
                          right before it ran, so this restores that exact state. */}
                      {msg.checkpointId && (
                        <TouchableOpacity
                          onPress={() => handleRollback(msg.checkpointId, "before this change")}
                          disabled={restoringCheckpointId !== null || isExecuting}
                          style={{ backgroundColor: isLight ? "#F1F5F9" : "#1C1C1C", borderColor: isLight ? "#E2E8F0" : "transparent" }}
                          className="px-3.5 py-2 rounded-xl flex-row items-center active:opacity-80 border shadow-sm"
                          activeOpacity={0.8}
                        >
                          {restoringCheckpointId === msg.checkpointId ? (
                            <ActivityIndicator size="small" color={isLight ? "#6D42C7" : "#C084FC"} />
                          ) : (
                            <>
                              <VectorIcon name="rotate-ccw" size={13} color={isLight ? "#6D42C7" : "#C084FC"} style={{ marginRight: 6 }} />
                              <Text style={{ color: textPrimary }} className="text-xs font-semibold">Undo this change</Text>
                            </>
                          )}
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

          {/* '@' FILE PICKER — real files from the active project */}
          {showMentionsPopup && (
            <View style={{ backgroundColor: isLight ? "#F2EFEA" : "#1C1C1E" }} className="mb-2 p-2 rounded-2xl shadow-2xl max-h-56">
              <Text className="text-purple-500 text-[11px] font-mono px-2 py-1">
                @ Attach a project file
              </Text>
              <ScrollView>
                {fileEntries.length === 0 ? (
                  <Text style={{ color: textSecondary }} className="text-xs px-2 py-3 text-left">
                    {filesLoading ? "Loading files…" : "No files in this project yet."}
                  </Text>
                ) : (
                  fileEntries.map((entry) => (
                    <TouchableOpacity
                      key={entry.path}
                      onPress={() => handleSelectMention(entry.path)}
                      style={{ backgroundColor: isLight ? "#FFFFFF" : "transparent" }}
                      className="flex-row items-center p-2 rounded-xl active:opacity-80 my-0.5"
                    >
                      <VectorIcon name="file-text" size={14} color="#C084FC" style={{ marginRight: 8 }} />
                      <Text numberOfLines={1} className="text-purple-600 text-xs font-mono font-bold flex-1 text-left">
                        {entry.path}
                      </Text>
                      <Text style={{ color: textSecondary }} className="text-[10px] ml-2">{entry.sizeLabel}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          )}

          {/* '/' PROMPT SHORTCUTS — each expands into a full instruction */}
          {showSlashPopup && (
            <View style={{ backgroundColor: isLight ? "#F2EFEA" : "#1C1C1E" }} className="mb-2 p-2 rounded-2xl shadow-2xl">
              <Text className="text-sky-500 text-[11px] font-mono px-2 py-1">/ Prompt shortcuts</Text>
              {SLASH_COMMANDS.map((item) => (
                <TouchableOpacity
                  key={item.cmd}
                  onPress={() => handleSelectSlashCommand(item.cmd)}
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
                  {activeModelObj.name}
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
              
              <Text style={{ color: textPrimary }} className="text-base font-bold">Project</Text>
              <View className="w-9" />
            </View>

            {/* Three ways into the project from the composer. Restore points
                used to have no entry point at all — the sheet existed but
                nothing opened it. */}
            <View className="flex-row justify-between mb-6">
              {([
                { key: "files", label: "Files", icon: "file-text", run: () => setShowFileModal(true) },
                { key: "preview", label: "Preview", icon: "eye", run: () => setShowPreviewModal(true) },
                { key: "restore", label: "Restore points", icon: "rotate-ccw", run: () => setShowCheckpointsModal(true) },
              ] as const).map((action) => (
                <TouchableOpacity
                  key={action.key}
                  onPress={() => {
                    setShowAddToChatModal(false);
                    action.run();
                  }}
                  style={{ backgroundColor: isLight ? "#F7F4EF" : "#1E1E1E" }}
                  className="w-[31%] py-5 rounded-2xl items-center justify-center active:opacity-80 shadow-sm border border-black/5"
                >
                  <View style={{ backgroundColor: isLight ? "#EAE6DF" : "#2B2B2B" }} className="w-11 h-11 rounded-full items-center justify-center mb-2">
                    <VectorIcon name={action.icon} size={20} color={isLight ? "#1E1D1A" : "#E4E4E7"} />
                  </View>
                  <Text style={{ color: textPrimary }} className="text-xs font-semibold text-center">{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

          </View>
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
                {displayName}
              </Text>
              <VectorIcon name="chevron-right" size={10} color={isLight ? "#64748B" : "#71717A"} />
            </TouchableOpacity>

            <View className="flex-row items-center">
              {/* Theme toggle */}
              <TouchableOpacity 
                onPress={() => setMode(isLight ? "darkest" : "light")}
                style={{ backgroundColor: isLight ? "#FFFFFF" : "#111111" }}
                className="w-9 h-9 rounded-full items-center justify-center mr-2 border border-slate-200/40 active:opacity-80"
              >
                <VectorIcon name={isLight ? "moon" : "sun"} size={15} color={isLight ? "#6E6D68" : "#FCD34D"} />
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

            {/* PROJECT GROUPED CHAT SESSIONS TREE — real projects + sessions */}
            <View className="mb-6">
              <Text style={{ color: textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-4 px-1">
                Projects & Workspace Chats
              </Text>

              {projects.length === 0 ? (
                <View className="items-center py-8 px-4">
                  <VectorIcon name="folder" size={26} color="#52525B" style={{ marginBottom: 10 }} />
                  <Text style={{ color: textSecondary }} className="text-xs text-center leading-5">
                    No projects yet. Create one to start building.
                  </Text>
                </View>
              ) : (
                projects.map((project) => {
                  const sessions = (drawerSessions[project.id] ?? []).filter((s) =>
                    !drawerQuery.trim() ||
                    (s.title ?? "").toLowerCase().includes(drawerQuery.trim().toLowerCase()),
                  );
                  return (
                    <View key={project.id} className="mb-5">
                      {/* Folder Header */}
                      <TouchableOpacity
                        onPress={() => handleOpenProjectFolder(project.id, project.name)}
                        className="flex-row items-center justify-between mb-2 px-1 active:opacity-80"
                      >
                        <View className="flex-row items-center flex-1 mr-2">
                          <VectorIcon name="folder" size={16} color="#F59E0B" style={{ marginRight: 8 }} />
                          <Text style={{ color: textPrimary }} className="text-sm font-bold text-left" numberOfLines={1}>
                            {project.name}
                          </Text>
                        </View>

                        <View style={{ backgroundColor: isLight ? "#E2E8F0" : "#1C1C1C" }} className="px-2.5 py-1 rounded-lg">
                          <Text style={{ color: isLight ? "#6B21A8" : "#D8B4FE" }} className="text-[10px] font-mono font-bold">Open</Text>
                        </View>
                      </TouchableOpacity>

                      {/* Real sessions for this project */}
                      <View style={{ borderColor: isLight ? "#CBD5E1" : "rgba(39, 39, 42, 0.8)" }} className="pl-3 ml-2 border-l">
                        {sessions.length === 0 ? (
                          <Text style={{ color: textMuted }} className="text-[10px] py-2 text-left">
                            {drawerSessions[project.id] ? "No chats yet" : "Loading…"}
                          </Text>
                        ) : (
                          sessions.map((item) => (
                            <TouchableOpacity
                              key={item.id}
                              onPress={() => handleLoadSession(item, project)}
                              style={{ backgroundColor: isLight ? "#FFFFFF" : "#121212", borderColor: isLight ? "#E2E8F0" : "transparent" }}
                              className="p-3 rounded-xl mb-2 border active:opacity-80 shadow-sm"
                            >
                              <Text style={{ color: textPrimary }} className="text-xs font-medium mb-1.5 text-left font-sans" numberOfLines={1}>
                                {item.title || "Untitled chat"}
                              </Text>
                              <View className="flex-row items-center justify-between">
                                <Text style={{ color: textSecondary }} className="text-[10px]">
                                  {relativeTime(item.updated_at ?? item.created_at)}
                                </Text>
                                <View
                                  style={{
                                    backgroundColor:
                                      item.status === "completed"
                                        ? (isLight ? "#DCFCE7" : "#14532D")
                                        : item.status === "failed"
                                          ? (isLight ? "#FEE2E2" : "#7F1D1D")
                                          : (isLight ? "#F1F5F9" : "#27272A"),
                                  }}
                                  className="px-2 py-0.5 rounded-full"
                                >
                                  <Text
                                    style={{
                                      color:
                                        item.status === "completed"
                                          ? (isLight ? "#15803D" : "#86EFAC")
                                          : item.status === "failed"
                                            ? (isLight ? "#DC2626" : "#FCA5A5")
                                            : (isLight ? "#475569" : "#A1A1AA"),
                                    }}
                                    className="text-[9px] font-medium"
                                  >
                                    {item.status}
                                  </Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>

          {/* Bottom Floating Bar Navigation Container */}
          <View className="absolute bottom-4 left-4 right-4 flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center bg-[#141414] px-3.5 py-2.5 rounded-full mr-3">
              <VectorIcon name="search" size={14} color="#A1A1AA" style={{ marginRight: 8 }} />
              <TextInput
                value={drawerQuery}
                onChangeText={setDrawerQuery}
                placeholder="Search chats..."
                placeholderTextColor="#71717A"
                className="flex-1 text-zinc-100 text-xs text-left"
                style={{ color: "#F4F4F5" }}
              />
              {drawerQuery.length > 0 && (
                <TouchableOpacity onPress={() => setDrawerQuery("")} className="p-1">
                  <VectorIcon name="x" size={12} color="#A1A1AA" />
                </TouchableOpacity>
              )}
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
                onPress={() => {
                  setShowProjectsModal(false);
                  goTo("GlobalSearch");
                }}
                style={{ backgroundColor: isLight ? "#F7F4EF" : "#1A1A1A", borderColor: isLight ? "#EAE6DF" : "transparent" }}
                className="mb-3 p-3 rounded-2xl flex-row items-center border active:opacity-80"
              >
                <VectorIcon name="search" size={15} color={textSecondary} style={{ marginRight: 10 }} />
                <Text style={{ color: textSecondary }} className="text-xs text-left flex-1">
                  Search your projects and chats
                </Text>
              </TouchableOpacity>

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

              {projects.length === 0 ? (
                <View className="items-center py-10 px-4">
                  <VectorIcon name="folder" size={28} color="#52525B" style={{ marginBottom: 10 }} />
                  <Text style={{ color: textSecondary }} className="text-xs text-center leading-5">
                    No projects yet — tap “New Project” above to create your first one.
                  </Text>
                </View>
              ) : (
                projects.map((proj) => (
                  <TouchableOpacity
                    key={proj.id}
                    onPress={() => {
                      setShowProjectsModal(false);
                      handleOpenProjectFolder(proj.id, proj.name);
                    }}
                    style={{ backgroundColor: isLight ? "#F7F4EF" : "#1A1A1A", borderColor: isLight ? "#EAE6DF" : "transparent" }}
                    className="mb-3.5 p-4 rounded-2xl border active:opacity-80 shadow-sm"
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <Text style={{ color: textPrimary }} className="text-base font-bold text-left flex-1 mr-2" numberOfLines={1}>
                        {proj.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteProjectFromSheet(proj.id, proj.name)}
                        style={{ backgroundColor: isLight ? "#EAE6DF" : "#262626" }}
                        className="w-7 h-7 rounded-lg items-center justify-center"
                      >
                        <VectorIcon name="trash" size={12} color={isLight ? "#6E6D68" : "#71717A"} />
                      </TouchableOpacity>
                    </View>

                    {proj.description ? (
                      <Text style={{ color: textSecondary }} className="text-xs text-left mb-3 leading-5" numberOfLines={2}>
                        {proj.description}
                      </Text>
                    ) : null}
                    <Text style={{ color: textMuted }} className="text-[10px] text-left mb-3">
                      Created {relativeTime(proj.created_at)}
                    </Text>

                    {/* Entry points into the project screens */}
                    <View className="flex-row flex-wrap">
                      {([
                        { label: "Details", target: "ProjectDetail" },
                        { label: "Files", target: "FileTree" },
                        { label: "History", target: "SessionHistory" },
                        { label: "Restore points", target: "CheckpointList" },
                        { label: "Settings", target: "ProjectSettings" },
                      ] as const).map((entry) => (
                        <TouchableOpacity
                          key={entry.target}
                          onPress={() => goToProject(entry.target, { projectId: proj.id })}
                          style={{ backgroundColor: isLight ? "#EAE6DF" : "#262626" }}
                          className="px-2.5 py-1 rounded-lg mr-2 mb-1"
                        >
                          <Text style={{ color: textSecondary }} className="text-[10px] font-semibold">{entry.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </TouchableOpacity>
                ))
              )}
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
              ) : previewHtml ? (
                <PreviewSurface html={previewHtml} />
              ) : (
                <View className="flex-1 items-center justify-center px-6">
                  <VectorIcon name="eye" size={36} color="#52525B" style={{ marginBottom: 12 }} />
                  <Text className="text-zinc-400 text-xs text-center leading-5">
                    Nothing to preview yet — ask the agent to build something.
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
                <Text className="text-white text-xl font-bold">Restore points</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowCheckpointsModal(false)}
                className="w-8 h-8 rounded-full bg-[#242424] items-center justify-center"
              >
                <VectorIcon name="x" size={14} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {checkpointsLoading ? (
                <View className="py-10 items-center">
                  <ActivityIndicator size="small" color="#C084FC" />
                  <Text className="text-zinc-500 text-xs mt-3">Loading checkpoints…</Text>
                </View>
              ) : checkpoints.length === 0 ? (
                <View className="py-10 items-center px-6">
                  <VectorIcon name="rotate-ccw" size={26} color="#52525B" style={{ marginBottom: 10 }} />
                  <Text className="text-zinc-300 text-sm font-bold mb-2">No restore points yet</Text>
                  <Text className="text-zinc-500 text-xs text-center leading-5 mb-4">
                    One is saved automatically before every run that can change your files.
                    Ask the agent to build something and it will show up here.
                  </Text>
                  <View className="w-full px-6">{saveRestorePointButton}</View>
                </View>
              ) : (
                <>
                  <Text className="text-zinc-500 text-xs text-left leading-5 mb-3 px-1">
                    Each one is how the project looked before that run. Rolling back saves a
                    restore point first, so it can be undone.
                  </Text>
                  {saveRestorePointButton}
                  {checkpoints.map((cp) => (
                    <View key={cp.id} className="mb-3 p-4 rounded-2xl bg-[#1A1A1A]">
                      <View className="flex-row items-center mb-1">
                        <View className="w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2" />
                        <Text className="text-white text-sm font-bold text-left flex-1" numberOfLines={1}>
                          {cp.session_title ? `Before: ${cp.session_title}` : "Restore point"}
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-between mt-1">
                        <Text className="text-zinc-400 text-xs text-left font-mono">
                          {relativeTime(cp.created_at)} · {cp.id.slice(0, 7)}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleRollback(cp.id, `on ${relativeTime(cp.created_at)}`)}
                          disabled={restoringCheckpointId !== null || isExecuting}
                          className="px-3 py-1.5 rounded-lg bg-[#242424] flex-row items-center"
                          activeOpacity={0.8}
                        >
                          {restoringCheckpointId === cp.id ? (
                            <ActivityIndicator size="small" color="#C084FC" />
                          ) : (
                            <>
                              <VectorIcon name="rotate-ccw" size={12} color="#C084FC" style={{ marginRight: 5 }} />
                              <Text className="text-purple-300 text-xs font-semibold">Restore</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              )}
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
                <View className="w-9" />
              </View>

              <ScrollView className="flex-1 px-4 py-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
                {/* Profile Card */}
                <View style={{ backgroundColor: bgCard, borderColor: isLight ? "#EAE6DF" : "transparent" }} className="p-4 rounded-2xl mb-4 flex-row items-center justify-between shadow-sm border">
                  <View className="flex-row items-center flex-1 mr-2">
                    <View className="w-10 h-10 rounded-full bg-purple-950/40 items-center justify-center mr-3">
                      <VectorIcon name="user" size={18} color="#C084FC" />
                    </View>
                    <View className="flex-1">
                      <Text style={{ color: textPrimary }} className="text-sm font-bold text-left" numberOfLines={1}>
                        {profile?.display_name || user?.email?.split("@")[0] || "Guest"}
                      </Text>
                      <Text style={{ color: textSecondary }} className="text-xs text-left" numberOfLines={1}>
                        {user?.email ?? (user?.is_anonymous ? "Guest session (not saved)" : "Not signed in")}
                      </Text>
                    </View>
                  </View>

                  <View style={{ backgroundColor: isLight ? "#1E1D1A" : "#FFFFFF" }} className="px-3.5 py-1.5 rounded-full items-center justify-center">
                    <Text style={{ color: isLight ? "#FFFFFF" : "#000000", fontWeight: "700", fontSize: 12 }}>
                      {(profile?.subscription_tier ?? "free").toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Upgrade Card */}
                <View style={{ backgroundColor: isLight ? "#F2EFEA" : "#141417", borderColor: isLight ? "#EAE6DF" : "transparent" }} className="p-5 rounded-2xl mb-6 shadow-sm border relative overflow-hidden">
                  <Text style={{ color: textPrimary }} className="text-base font-bold text-left mb-1">Want more Retro Code?</Text>
                  <Text style={{ color: textSecondary }} className="text-xs text-left mb-4 leading-5">
                    Upgrade for more usage and capabilities.
                  </Text>

                  <TouchableOpacity
                    onPress={() => goTo("Paywall", {})}
                    style={{ backgroundColor: isLight ? "#1E1D1A" : "#FFFFFF" }}
                    className="px-6 py-2.5 rounded-2xl self-start active:opacity-90 shadow-md items-center justify-center"
                  >
                    <Text style={{ color: isLight ? "#FFFFFF" : "#000000", fontWeight: "700", fontSize: 13 }}>Upgrade</Text>
                  </TouchableOpacity>
                </View>

                {/* Account & app screens (these live in the Profile stack) */}
                <View style={{ backgroundColor: bgCard, borderColor: isLight ? "#EAE6DF" : "transparent" }} className="rounded-2xl overflow-hidden mb-5 border shadow-sm">
                  {([
                    { label: "Account", icon: "user", target: "AccountSettings", root: false },
                    { label: "Preferences", icon: "settings", target: "Preferences", root: false },
                    { label: "Security", icon: "lock", target: "SecuritySettings", root: false },
                    { label: "Subscription", icon: "zap", target: "ManageSubscription", root: true },
                    { label: "Token usage", icon: "chart", target: "TokenUsage", root: true },
                    { label: "Help & Support", icon: "info", target: "HelpSupport", root: false },
                    { label: "About", icon: "info", target: "About", root: false },
                    { label: "Privacy Policy", icon: "file-text", target: "PrivacyPolicy", root: false },
                    { label: "Terms of Service", icon: "file-text", target: "TermsOfService", root: false },
                  ] as const).map((row) => (
                    <TouchableOpacity
                      key={row.target}
                      onPress={() => (row.root ? goTo(row.target) : goToProfile(row.target))}
                      className="flex-row items-center justify-between p-4 active:opacity-80"
                    >
                      <View className="flex-row items-center">
                        <VectorIcon name={row.icon} size={16} color={isLight ? "#6E6D68" : "#A1A1AA"} style={{ marginRight: 12 }} />
                        <Text style={{ color: textPrimary }} className="text-sm font-semibold text-left">{row.label}</Text>
                      </View>
                      <VectorIcon name="chevron-right" size={12} color={isLight ? "#6E6D68" : "#71717A"} />
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ backgroundColor: bgCard, borderColor: isLight ? "#EAE6DF" : "transparent" }} className="rounded-2xl overflow-hidden mb-5 border shadow-sm">
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


                {/* Theme & Preferences */}
                <View style={{ backgroundColor: bgCard, borderColor: isLight ? "#EAE6DF" : "transparent" }} className="rounded-2xl overflow-hidden mb-6 border shadow-sm">
                  <TouchableOpacity 
                    onPress={() => setMode(NEXT_THEME_MODE[mode])}
                    className="flex-row items-center justify-between p-4 active:opacity-80"
                  >
                    <View className="flex-row items-center">
                      <VectorIcon name={isLight ? "sun" : "moon"} size={16} color={isLight ? "#D97757" : "#A1A1AA"} style={{ marginRight: 12 }} />
                      <View>
                        <Text style={{ color: textPrimary }} className="text-sm font-semibold text-left">Color mode</Text>
                        <Text style={{ color: isLight ? "#D97757" : "#A1A1AA" }} className="text-xs text-left font-medium">
                          {THEME_MODE_LABEL[mode]}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-xs font-bold text-purple-500">Tap to Switch ➔</Text>
                  </TouchableOpacity>

                </View>

                <TouchableOpacity
                  onPress={handleSignOut}
                  className="w-full py-3.5 rounded-full bg-red-500/10 items-center justify-center mb-8 active:opacity-80"
                >
                  <Text className="text-red-500 text-sm font-bold">Sign Out</Text>
                </TouchableOpacity>

              </ScrollView>
            </View>
          )}

          {/* SUB-SCREEN 2: PROFILE EDIT */}

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
                {usageLoading ? (
                  <View className="py-12 items-center">
                    <ActivityIndicator size="small" color="#8B5CF6" />
                    <Text className="text-zinc-500 text-xs mt-3">Loading usage…</Text>
                  </View>
                ) : usage ? (
                  <>
                    <View className="bg-[#141414] p-4 rounded-2xl mb-4">
                      <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-zinc-400 text-xs">Plan</Text>
                        <Text className="text-white text-xs font-bold uppercase">{usage.tier}</Text>
                      </View>

                      <Text className="text-zinc-400 text-xs text-left mb-1">Tokens used this period</Text>
                      <Text className="text-white text-2xl font-bold text-left mb-3">
                        {usage.tokensUsed.toLocaleString()}
                        {usage.tokenLimit ? (
                          <Text className="text-zinc-500 text-sm font-medium"> / {usage.tokenLimit.toLocaleString()}</Text>
                        ) : null}
                      </Text>

                      {usage.tokenLimit > 0 && (
                        <View className="h-2 bg-[#27272A] rounded-full overflow-hidden mb-2">
                          <View
                            style={{
                              width: `${Math.min(100, Math.round((usage.tokensUsed / usage.tokenLimit) * 100))}%`,
                              backgroundColor: usage.remaining > 0 ? "#8B5CF6" : "#F87171",
                            }}
                            className="h-full rounded-full"
                          />
                        </View>
                      )}

                      <Text className="text-zinc-500 text-[11px] text-left">
                        {usage.remaining > 0
                          ? `${usage.remaining.toLocaleString()} tokens remaining`
                          : "Limit reached — new agent runs are blocked until the period resets."}
                      </Text>
                    </View>

                    <View className="flex-row justify-between">
                      <View className="w-[48%] bg-[#141414] p-3.5 rounded-2xl">
                        <Text className="text-white text-xs font-bold mb-2">Agent runs</Text>
                        <Text className="text-white text-xl font-bold text-left">{usage.requests.toLocaleString()}</Text>
                        <Text className="text-zinc-500 text-[10px] text-left">this period</Text>
                      </View>
                      <View className="w-[48%] bg-[#141414] p-3.5 rounded-2xl">
                        <Text className="text-white text-xs font-bold mb-2">Resets</Text>
                        <Text className="text-white text-sm font-bold text-left">
                          {usage.periodEnd ? new Date(usage.periodEnd).toLocaleDateString() : "—"}
                        </Text>
                        <Text className="text-zinc-500 text-[10px] text-left">end of period</Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <View className="py-12 items-center px-6">
                    <Text className="text-zinc-400 text-xs text-center leading-5">
                      {usageError ?? "Usage is unavailable right now."}
                    </Text>
                  </View>
                )}
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
                      </View>

                      {isSelected && (
                        <VectorIcon name="check" size={15} color="#38BDF8" />
                      )}
                    </View>

                    <Text style={{ color: textSecondary }} className="text-xs mt-1 pl-6 opacity-90 text-left">
                      {model.description}
                    </Text>
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
              <Text className="text-zinc-200 text-sm font-bold">Project Files</Text>
              <TouchableOpacity onPress={() => setShowFileModal(false)} className="p-1">
                <VectorIcon name="x" size={14} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1">
              {filesLoading ? (
                <View className="py-10 items-center">
                  <ActivityIndicator size="small" color="#8B5CF6" />
                  <Text className="text-zinc-500 text-xs mt-3">Loading project files…</Text>
                </View>
              ) : fileEntries.length === 0 ? (
                <View className="py-10 items-center px-6">
                  <VectorIcon name="folder" size={28} color="#52525B" style={{ marginBottom: 10 }} />
                  <Text className="text-zinc-400 text-xs text-center leading-5">
                    {filesError ?? "No files yet — ask the agent to build something and they'll appear here."}
                  </Text>
                </View>
              ) : (
                fileEntries.map((entry) => (
                  <View
                    key={entry.path}
                    className="py-2.5 px-3 bg-[#1A1A1A] rounded-xl flex-row justify-between items-center mb-1.5"
                    style={{ marginLeft: entry.depth * 12 }}
                  >
                    <View className="flex-row items-center flex-1 mr-2">
                      <VectorIcon name="file-text" size={13} color="#38BDF8" style={{ marginRight: 6 }} />
                      <Text numberOfLines={1} className="text-zinc-300 text-xs font-mono">{entry.path}</Text>
                    </View>
                    <Text className="text-zinc-500 text-[10px]">{entry.sizeLabel}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};
