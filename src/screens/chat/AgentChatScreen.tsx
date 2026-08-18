/**
 * frontend/src/screens/chat/AgentChatScreen.tsx
 * ============================================================================
 * AGENT WORKSPACE & AI CODING IDE
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
import {
  errorFeedback,
  selectionFeedback,
  sendFeedback,
  successFeedback,
  tapFeedback,
  warningFeedback,
} from "../../services/haptics";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { useTheme } from "../../theme/ThemeProvider";
import { useThemeStore } from "../../theme/store";
import { themeFonts, type ThemeMode } from "../../theme/theme";
import { fontFamilyFor } from "../../theme/fonts";
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
import { isUuid } from "../../services/formatting";
import { directionStyleFor } from "../../theme/direction";
import { SKILLS } from "../../core/agent/skills/catalog";
import { deployProject } from "../../services/deployService";
import { forgetNetlifyToken, loadNetlifyToken, saveNetlifyToken, tokenStorageIsSecure } from "../../services/deployToken";
import { looksLikeNetlifyToken } from "../../services/netlify";
import { buildPreviewHtml } from "../../services/previewBuilder";
import { createShare } from "../../services/shareService";
import { exportProject, openDownload, readableSize } from "../../services/exportService";
import { shareLink } from "../../services/shareSheet";
import { ToolRunPanel, ToolRunRow, type ToolRunStep } from "../../components/ToolRunRow";
import { AgentMessageText } from "../../components/AgentMessageText";
import { ThinkingIndicator } from "../../components/ThinkingIndicator";
import { AnimatedAgentText } from "../../components/AnimatedAgentText";
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
  { id: "auto", name: "Auto", icon: "zap", tone: "warning" as const, category: "Best", description: "Let the server pick the default model" },
  { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", icon: "zap", tone: "success" as const, badge: "default", category: "Best", description: "Fast general coding model" },
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", icon: "code", tone: "brandPrimary" as const, category: "Best", description: "Fast and economical" },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner", icon: "sparkles", tone: "brandPrimary" as const, category: "Best", description: "Deeper reasoning for complex tasks" },
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
  const bgCanvas = colors.canvasBase;
  const bgCard = colors.surfaceRaised;
  const bgPill = colors.surfaceMuted;
  const textPrimary = colors.inkPrimary;
  const textSecondary = colors.inkSecondary;
  const textMuted = colors.inkMuted;

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

  // Publishing the previewed page to a link. The URL is kept so the button can
  // become "Copy link" — publishing twice would leave two live pages and only
  // one of them in the user's hand.
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  // Building a zip reads every file in the project, so the tile shows it is
  // working rather than looking ignored.
  const [exporting, setExporting] = useState(false);

  /**
   * Skills switched on for the next request. Kept per-chat rather than saved: a
   * skill is a choice about *this* piece of work, and one silently left on from
   * last week would quietly shape every later answer.
   */
  const [activeSkills, setActiveSkills] = useState<string[]>([]);
  const [showSkillsModal, setShowSkillsModal] = useState(false);

  // Publishing to Netlify. The live URL is kept so the button becomes "Open site"
  // rather than silently deploying a second copy.
  const [deploying, setDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [netlifyToken, setNetlifyToken] = useState("");
  const [hasNetlifyToken, setHasNetlifyToken] = useState(false);

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
    const raw = (route.params ?? {}) as { projectId?: string; sessionId?: string };
    // Only adopt real ids. A navigator once passed a "global-default"
    // placeholder as initialParams, and adopting it sent that string to
    // agent-run as a project id — rejected, with the run never starting.
    const params = {
      projectId: isUuid(raw.projectId) ? raw.projectId : undefined,
      sessionId: isUuid(raw.sessionId) ? raw.sessionId : undefined,
    };
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
  /**
   * What the header shows. Named here so the text and its direction are measured
   * from the same string — a title is whatever the user asked, so it is Persian
   * as often as English.
   */
  const headerTitle = isIncognito
    ? "Incognito Chat"
    : (threadTitle || activeProjectName || "New chat");
  
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

  // Whether an account is already connected decides what the deploy button says.
  useEffect(() => {
    let cancelled = false;
    void loadNetlifyToken().then((token) => {
      if (!cancelled) setHasNetlifyToken(!!token);
    });
    return () => { cancelled = true; };
  }, []);

  /** Load the project's files and build the on-device preview document. */
  const loadPreview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    // Any previously published link describes the old build. Offering "Copy
    // link" next to a page that has since changed would hand out a stale URL.
    setPublishedUrl(null);
    setDeployedUrl(null);
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

  /**
   * The label under the pulsing mark. "Thinking" for half a minute is
   * indistinguishable from being stuck, so a run names its current tool.
   */
  const liveSteps: ToolRunStep[] = (() => {
    const exec = messages.find((m) => typeof m.id === "string" && m.id.startsWith("exec_"));
    return (exec?.steps ?? []) as ToolRunStep[];
  })();
  const currentStep = [...liveSteps].reverse().find((s) => s.status === "running") ?? liveSteps.at(-1);
  const isAsking = activeMode === "chat" || isIncognito;
  const thinkingLabel = isAsking
    ? "Thinking"
    : currentStep
      ? `Running ${currentStep.tool}`
      : "Starting the agent";
  const thinkingDetail = isAsking
    ? undefined
    : currentStep?.target ?? (liveSteps.length ? `${liveSteps.length} step(s) so far` : "Preparing the workspace");

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
  /** A suggestion is a prompt the user did not have to type. */
  const handleAskFollowUp = (question: string) => {
    if (isExecuting) return;
    selectionFeedback();
    setInputText(question);
    // Let the input commit before send reads it.
    setTimeout(() => { void handleSend(question); }, 0);
  };

  const handleSend = async (override?: string) => {
    const source = (override ?? inputText).trim();
    if (!source || isExecuting) return;

    const userPromptText = source;
    const isFirstPrompt = messages.length === 0;

    const userMsg = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: userPromptText,
      createdAt: Date.now(),
      isIncognito,
    };
    setMessages((prev) => [...prev, userMsg]);
    sendFeedback();
    setInputText("");
    setShowMentionsPopup(false);
    setShowSlashPopup(false);

    if (isFirstPrompt) setThreadTitle(userPromptText.slice(0, 48));

    // Asking a question does not need the agent. Chat and Incognito call the
    // model directly and the answer is in the response — no job queue, no cron
    // worker, no sandbox, and no polling for a reply that is already here.
    if (activeMode === "chat" || isIncognito) {
      runStartedAtRef.current = null; // stops the agent-task poller from waking
      setIsExecuting(true);
      try {
        // A stored chat keeps its own history server-side; incognito has no
        // server-side anything, so the conversation travels with the request.
        const history = isIncognito
          ? messages
              .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
              .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content) }))
          : undefined;

        const answer = await agentService.ask({
          prompt: userPromptText,
          model: selectedModelId,
          ...(activeSkills.length ? { skills: activeSkills } : {}),
          ...(isIncognito
            ? { history }
            : {
                projectId: await ensureProjectId(),
                sessionId: activeSessionId ?? undefined,
                // Only names a new chat; an existing one keeps its title.
                ...(activeSessionId ? {} : { title: userPromptText.slice(0, 48) }),
              }),
        });
        if (answer.session_id) setActiveSessionId(answer.session_id);
        successFeedback();
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_agent_${Date.now()}`,
            role: "assistant",
            content: answer.text || "(no answer)",
            createdAt: Date.now(),
            animate: true,
            followUps: answer.follow_ups ?? [],
            isIncognito,
          },
        ]);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_err_${Date.now()}`,
            role: "assistant",
            content: `⚠️ Could not answer: ${e instanceof Error ? e.message : String(e)}`,
            isError: true,
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

    setIsExecuting(true);

    try {
      const projectId = await ensureProjectId();
      runStartedAtRef.current = new Date().toISOString();
      const res = await agentService.startAgentRun(projectId, userPromptText, {
        title: userPromptText.slice(0, 48),
        sessionId: activeSessionId ?? undefined,
        model: selectedModelId,
        ...(activeSkills.length ? { skills: activeSkills } : {}),
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
    <TouchableOpacity style={{ borderColor: colors.borderHairline,  backgroundColor: colors.surfaceMuted }}
      onPress={handleSaveRestorePoint}
      disabled={savingCheckpoint || isExecuting}
      className="flex-row items-center justify-center py-2.5 mb-4 rounded-xl border"
      activeOpacity={0.8}
    >
      {savingCheckpoint ? (
        <ActivityIndicator size="small" color={colors.brandPrimary} />
      ) : (
        <>
          <VectorIcon name="plus" size={13} color={colors.brandPrimary} style={{ marginRight: 6 }} />
          <Text style={{ color: colors.brandPrimary }} className=" text-xs font-semibold">Save a restore point now</Text>
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

    warningFeedback();
    setRestoringCheckpointId(checkpointId);
    try {
      const result = await restoreCheckpoint(checkpointId);
      successFeedback();
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
   * Download the project as a zip.
   *
   * The link is signed and short-lived, so it is handed straight to whatever
   * saves downloads here rather than stored — a stale link in state would fail
   * silently later.
   */
  const handleExport = async () => {
    if (exporting) return;
    tapFeedback();
    setExporting(true);
    try {
      const projectId = await ensureProjectId();
      const result = await exportProject(projectId);
      successFeedback();
      const opened = await openDownload(result.url);
      notify(
        opened ? "Download started" : "Your download link",
        opened
          ? `${result.fileName} — ${result.fileCount} files, ${readableSize(result.sizeBytes)}.`
          : result.url,
      );
    } catch (e) {
      errorFeedback();
      notify("Could not export", e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  /**
   * Publish the project to Netlify's free tier.
   *
   * The token goes from this device straight to Netlify — it is never sent to our
   * backend, so there is nothing of the user's account in our database at all.
   */
  const handleDeploy = async () => {
    if (deploying) return;

    if (deployedUrl) {
      const opened = await openDownload(deployedUrl);
      if (!opened) notify("Your site", deployedUrl);
      return;
    }

    tapFeedback();
    setDeploying(true);
    try {
      const projectId = await ensureProjectId();
      const result = await deployProject(projectId, activeProjectName || "Retro app");

      if (result.needsToken) {
        // Not a failure — there is just no account connected yet.
        setShowDeployModal(true);
        return;
      }
      if (!result.ok || !result.url) {
        errorFeedback();
        notify("Could not deploy", result.error ?? "Netlify did not accept the upload.");
        return;
      }

      setDeployedUrl(result.url);
      successFeedback();
      notify("Your site is live", result.url);
    } catch (e) {
      errorFeedback();
      notify("Could not deploy", e instanceof Error ? e.message : String(e));
    } finally {
      setDeploying(false);
    }
  };

  const handleSaveToken = async () => {
    if (!looksLikeNetlifyToken(netlifyToken)) {
      notify("That does not look like a token", "Paste the personal access token from Netlify — it has no spaces.");
      return;
    }
    await saveNetlifyToken(netlifyToken);
    // Cleared from state immediately: it does not need to sit in a React tree.
    setNetlifyToken("");
    setHasNetlifyToken(true);
    setShowDeployModal(false);
    successFeedback();
    notify("Netlify connected", "Press Deploy again to publish this project.");
  };

  /**
   * Publish the previewed page to a public link, then hand that link over.
   *
   * The document sent up is exactly the one on screen, so what a friend opens is
   * what the user just looked at. Published once and remembered: pressing again
   * shares the same URL rather than leaving a second live page behind.
   */
  const handleShareApp = async () => {
    if (publishing) return;

    if (publishedUrl) {
      const outcome = await shareLink(publishedUrl, activeProjectName || "My app");
      if (outcome === "copied") notify("Link copied", publishedUrl);
      else if (outcome === "manual") notify("Your link", publishedUrl);
      return;
    }

    if (!previewHtml) {
      notify("Nothing to share yet", "Ask the agent to build something first.");
      return;
    }

    tapFeedback();
    setPublishing(true);
    try {
      const projectId = await ensureProjectId();
      const share = await createShare({
        projectId,
        html: previewHtml,
        title: activeProjectName || undefined,
      });
      setPublishedUrl(share.url);
      successFeedback();

      const outcome = await shareLink(share.url, activeProjectName || "My app");
      if (outcome === "copied") notify("Link copied", share.url);
      else if (outcome === "manual") notify("Your link", share.url);
    } catch (e) {
      errorFeedback();
      notify("Could not publish", e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
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
    // Only a Build run produces agent_tasks rows; runStartedAtRef marks one.
    if (!activeSessionId || !isExecuting || !runStartedAtRef.current) return;
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
            animate: runRow.status === "success",
            hasCodeEdit: runRow.status === "success" && touchedWorkspace,
            // The worker snapshots before it runs and reports the id here, so
            // this message can offer to undo exactly what it did.
            checkpointId: touchedWorkspace
              ? (runRow.tool_output?.checkpoint_id ?? null)
              : null,
          },
        ]);
        setIsExecuting(false);
        if (runRow.status === "success") successFeedback();
        else errorFeedback();
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
    selectionFeedback();
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
   * Chat and Build are different machines, not two settings on one. Chat asks
   * the model directly and gets an answer back; Build queues a job the worker
   * picks up, with tools and a sandbox. Switching starts a new conversation:
   * a Q&A transcript is not an agent run's, and agent-run would otherwise
   * inherit the chat session's profile.
   */
  const handleSelectMode = (mode: "chat" | "build") => {
    if (mode === activeMode || isExecuting) return;
    selectionFeedback();
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
            style={{ backgroundColor: bgCard, borderColor: colors.borderHairline }}
            className="w-10 h-10 rounded-full items-center justify-center border shadow-sm"
            activeOpacity={0.8}
          >
            <VectorIcon name="user" size={16} color={colors.inkPrimary} />
          </TouchableOpacity>

          {/* Chat asks the model directly; Build queues an agent run with tools. */}
          {isIncognito ? (
            <Text style={{ color: colors.inkSecondary }} className=" text-sm font-medium">Incognito chat</Text>
          ) : (
            <View style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }} className="flex-row items-center p-1 rounded-full border shadow-sm">
              <TouchableOpacity
                onPress={() => handleSelectMode("chat")}
                style={{ backgroundColor: activeMode === "chat" ? (colors.surfaceMuted) : "transparent" }}
                className="flex-row items-center px-4 py-1.5 rounded-full"
                activeOpacity={0.8}
              >
                <VectorIcon name="search" size={12} color={activeMode === "chat" ? colors.brandPrimary : (colors.inkSecondary)} style={{ marginRight: 6 }} />
                <Text style={{ color: activeMode === "chat" ? (colors.inkPrimary) : (colors.inkSecondary) }} className="text-xs font-semibold">
                  Chat
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSelectMode("build")}
                style={{ backgroundColor: activeMode === "build" ? (colors.surfaceMuted) : "transparent" }}
                className="flex-row items-center px-4 py-1.5 rounded-full"
                activeOpacity={0.8}
              >
                <VectorIcon name="code" size={12} color={activeMode === "build" ? colors.brandPrimary : (colors.inkSecondary)} style={{ marginRight: 6 }} />
                <Text style={{ color: activeMode === "build" ? (colors.inkPrimary) : (colors.inkSecondary) }} className="text-xs font-semibold">
                  Build
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Top-right incognito toggle */}
          <TouchableOpacity 
            onPress={handleToggleIncognito}
            style={{ backgroundColor: isIncognito ? (colors.incognitoSoft) : (colors.surfaceRaised), borderColor: colors.borderHairline }}
            className="w-10 h-10 rounded-full items-center justify-center border shadow-sm transition-all"
            activeOpacity={0.8}
          >
            <VectorIcon name="ghost" size={18} color={isIncognito ? colors.brandPrimary : (colors.inkSecondary)} />
          </TouchableOpacity>

        </View>
      ) : (
        /* ACTIVE THREAD HEADER STATE */
        <View style={{ backgroundColor: bgCanvas, zIndex: 50, elevation: 10 }} className="flex-row items-center justify-between px-4 py-3 z-50">

          <View className="flex-row items-center flex-1 mr-2">
            <TouchableOpacity 
              onPress={() => setShowDrawerModal(true)}
              style={{ backgroundColor: bgCard, borderColor: colors.borderHairline }}
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
              {/* A thread's title is whatever the user asked, so it is Persian
                  as often as not. `text-left` truncated it from the wrong end. */}
              <Text
                style={{ color: textPrimary, ...directionStyleFor(headerTitle) }}
                className="text-sm font-semibold mr-1"
                numberOfLines={1}
              >
                {headerTitle}
              </Text>
              <VectorIcon name="chevron-down" size={10} color={colors.inkSecondary} />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center">
            <TouchableOpacity 
              onPress={handleToggleIncognito}
              style={{ backgroundColor: isIncognito ? (colors.incognitoSoft) : (colors.surfaceRaised), borderColor: colors.borderHairline }}
              className="w-9 h-9 rounded-full items-center justify-center mr-2 border shadow-sm"
              activeOpacity={0.8}
            >
              <VectorIcon name="ghost" size={16} color={isIncognito ? colors.brandPrimary : (colors.inkSecondary)} />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleNewChat}
              style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
              className="w-9 h-9 rounded-full items-center justify-center border shadow-sm"
              activeOpacity={0.8}
            >
              <VectorIcon name="edit" size={14} color={colors.inkPrimary} />
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
              <View style={{ borderColor: colors.borderHairline,  backgroundColor: bgCard }} className="w-20 h-20 rounded-3xl items-center justify-center mb-6 shadow-2xl border">
                <VectorIcon name="ghost" size={40} color={colors.brandPrimary} />
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
              <View style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }} className="flex-row items-center justify-between mb-5 p-4 rounded-2xl border shadow-sm">
                <View className="flex-row items-center flex-1 mr-2">
                  <VectorIcon name="folder" size={22} color={colors.warning} style={{ marginRight: 12 }} />
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
                  style={{ backgroundColor: colors.surfaceMuted }}
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
                      style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
                      className="mb-3 p-4 rounded-2xl border active:opacity-80 shadow-sm"
                    >
                      <Text
                        style={{ color: textPrimary, ...directionStyleFor(item.title) }}
                        className="text-sm font-semibold mb-2"
                        numberOfLines={1}
                      >
                        {item.title || "Untitled chat"}
                      </Text>
                      <View className="flex-row items-center justify-between">
                        <Text style={{ color: textSecondary }} className="text-xs">
                          {relativeTime(item.updated_at ?? item.created_at)}
                        </Text>
                        <Text style={{ color: textMuted }} className="text-[10px] font-mono">
                          {item.token_usage_total ? `${item.token_usage_total.toLocaleString("en-US")} tokens` : item.status}
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
                    color: colors.inkMuted, 
                    fontFamily: themeFonts.uiBold,
                    letterSpacing: -1
                  } as any}
                >
                  retro code
                </Text>
                <Text 
                  style={{ 
                    fontSize: 22, 
                    fontWeight: isLight ? "700" : "400", 
                    color: colors.brandPrimary, 
                    fontFamily: themeFonts.uiBold,
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
                  color: colors.inkMuted, 
                  fontFamily: themeFonts.mono,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  opacity: 0.8
                } as any}
              >
                {activeMode === "build" ? "AI AGENT CODING & BUILDER SPACE" : "ASK ABOUT CODE — NO FILES TOUCHED"}
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
                    <View style={{ backgroundColor: colors.bubbleUser, borderColor: colors.borderHairline }} className="max-w-[92%] p-4 rounded-3xl border shadow-sm">
                      {/* Direction from the text itself. `text-left` here was
                          left-aligning Persian, so a user's own message ran the
                          opposite way to the answer below it. */}
                      <Text
                        style={{ color: textPrimary, ...directionStyleFor(msg.content) }}
                        className="text-sm leading-6 font-sans font-medium"
                      >
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
                    <AnimatedAgentText
                      id={msg.id}
                      content={msg.content}
                      animate={msg.animate === true}
                      isLight={isLight}
                      textColor={textPrimary}
                    />
                  ) : null}

                  {/* Legacy step renderers (commands, thoughts, diff cards) */}
                  {otherSteps.map((step: any, sIdx: number) => {
                    if (step.type === "command") {
                      return (
                        <View key={sIdx} className="flex-row items-center justify-between py-2 my-1">
                          <View className="flex-row items-center flex-1 mr-2">
                            <VectorIcon name="terminal" size={12} color={colors.inkSecondary} style={{ marginRight: 6 }} />
                            <Text style={{ color: textSecondary }} className="text-xs font-mono mr-1">Command</Text>
                            <Text style={{ color: textPrimary }} className="text-xs font-mono font-medium" numberOfLines={1}>
                              {step.cmd}
                            </Text>
                          </View>
                          <View style={{ backgroundColor: colors.successSoft }} className="px-2.5 py-1 rounded-md">
                            <Text style={{ color: colors.success }} className="text-[11px] font-medium font-mono">completed &gt;</Text>
                          </View>
                        </View>
                      );
                    }

                    if (step.type === "thought") {
                      return (
                        <Text key={sIdx} style={{ color: colors.inkSecondary }} className="text-xs italic leading-5 my-2 text-left pl-1">
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

                  {/* Where the conversation could go next. Generated with the
                      answer, so they cost a handful of tokens rather than a
                      second model call. Only on the newest message — stale
                      suggestions are noise. */}
                  {Array.isArray(msg.followUps) && msg.followUps.length > 0 &&
                    msg.id === messages[messages.length - 1]?.id && !isExecuting && (
                    <View className="mt-4 pt-1">
                      {msg.followUps.map((question: string, qIdx: number) => (
                        <TouchableOpacity
                          key={qIdx}
                          onPress={() => handleAskFollowUp(question)}
                          style={{ borderTopColor: colors.borderHairline, borderTopWidth: 1 }}
                          className="flex-row items-center py-3 active:opacity-70"
                          activeOpacity={0.7}
                        >
                          <VectorIcon
                            name="arrow-right"
                            size={13}
                            color={colors.inkMuted}
                            style={{ marginRight: 10 }}
                          />
                          <Text
                            style={{ color: textPrimary }}
                            className="text-sm flex-1 text-left leading-5"
                          >
                            {question}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* IN-STREAM ACTIONS: LIVE APP PREVIEW & GIT CHECKPOINT ROLLBACK BUTTONS */}
                  {msg.hasCodeEdit && (
                    <View className="flex-row items-center mt-3 pt-3 space-x-2">
                      {/* Live App Sandbox Runner Button */}
                      <TouchableOpacity
                        onPress={() => setShowPreviewModal(true)}
                        style={{ backgroundColor: colors.successSoft, borderColor: colors.borderHairline }}
                        className="px-3.5 py-2 rounded-xl flex-row items-center active:opacity-80 mr-2 border shadow-sm"
                        activeOpacity={0.8}
                      >
                        <VectorIcon name="eye" size={14} color={colors.success} style={{ marginRight: 6 }} />
                        <Text style={{ color: colors.success }} className="text-xs font-bold mr-1.5">Preview App</Text>
                        <VectorIcon name="arrow-right" size={12} color={colors.success} />
                      </TouchableOpacity>

                      {/* Undo this turn — the worker snapshotted the project
                          right before it ran, so this restores that exact state. */}
                      {msg.checkpointId && (
                        <TouchableOpacity
                          onPress={() => handleRollback(msg.checkpointId, "before this change")}
                          disabled={restoringCheckpointId !== null || isExecuting}
                          style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.borderHairline }}
                          className="px-3.5 py-2 rounded-xl flex-row items-center active:opacity-80 border shadow-sm"
                          activeOpacity={0.8}
                        >
                          {restoringCheckpointId === msg.checkpointId ? (
                            <ActivityIndicator size="small" color={colors.brandPrimary} />
                          ) : (
                            <>
                              <VectorIcon name="rotate-ccw" size={13} color={colors.brandPrimary} style={{ marginRight: 6 }} />
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
            {isExecuting && (
              <ThinkingIndicator label={thinkingLabel} detail={thinkingDetail} />
            )}

          </ScrollView>
        )}

        {/* =================================================================== */}
        {/* 3. CLAUDE AI STYLE FLOATING INPUT CARD                              */}
        {/* =================================================================== */}
        <View 
          style={{ 
            backgroundColor: bgCard, 
            borderColor: colors.borderHairline
          }} 
          className="absolute bottom-4 left-3 right-3 p-3 rounded-3xl border shadow-2xl"
        >

          {/* '@' FILE PICKER — real files from the active project */}
          {showMentionsPopup && (
            <View style={{ backgroundColor: colors.surfaceMuted }} className="mb-2 p-2 rounded-2xl shadow-2xl max-h-56">
              <Text style={{ color: colors.brandPrimary }} className=" text-[11px] font-mono px-2 py-1">
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
                      style={{ backgroundColor: colors.surfaceRaised }}
                      className="flex-row items-center p-2 rounded-xl active:opacity-80 my-0.5"
                    >
                      <VectorIcon name="file-text" size={14} color={colors.brandPrimary} style={{ marginRight: 8 }} />
                      <Text style={{ color: colors.brandPrimary }} numberOfLines={1} className=" text-xs font-mono font-bold flex-1 text-left">
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
            <View style={{ backgroundColor: colors.surfaceMuted }} className="mb-2 p-2 rounded-2xl shadow-2xl">
              <Text style={{ color: colors.brandPrimary }} className=" text-[11px] font-mono px-2 py-1">/ Prompt shortcuts</Text>
              {SLASH_COMMANDS.map((item) => (
                <TouchableOpacity
                  key={item.cmd}
                  onPress={() => handleSelectSlashCommand(item.cmd)}
                  style={{ backgroundColor: colors.surfaceRaised }}
                  className="flex-row items-center p-2 rounded-xl active:opacity-80 my-0.5"
                >
                  <VectorIcon name={item.icon} size={14} color={colors.brandPrimary} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.brandPrimary }} className=" text-xs font-mono font-bold mr-2">{item.cmd}</Text>
                  <Text style={{ color: textSecondary }} className="text-xs flex-1 text-left">{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Whatever is switched on shapes every answer, so it is visible here
              rather than only inside the sheet that set it. Tapping one turns it
              off — the fastest way back is where you noticed it. */}
          {activeSkills.length > 0 && (
            <View className="flex-row flex-wrap mb-2">
              {SKILLS.filter((skill) => activeSkills.includes(skill.id)).map((skill) => (
                <TouchableOpacity
                  key={skill.id}
                  onPress={() => {
                    selectionFeedback();
                    setActiveSkills((prev) => prev.filter((id) => id !== skill.id));
                  }}
                  style={{ backgroundColor: colors.brandSoft, borderColor: colors.brandPrimary }}
                  className="flex-row items-center px-2.5 py-1 rounded-full border mr-1.5 mb-1.5"
                  activeOpacity={0.7}
                  accessibilityLabel={`Turn off ${skill.name}`}
                >
                  <VectorIcon name={skill.icon} size={10} color={colors.brandPrimary} style={{ marginRight: 4 }} />
                  <Text style={{ color: colors.brandPrimary }} className="text-[10px] font-semibold">
                    {skill.name}
                  </Text>
                  <VectorIcon name="x" size={9} color={colors.brandPrimary} style={{ marginLeft: 5 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TextInput
            value={inputText}
            onChangeText={handleInputChange}
            onSubmitEditing={() => void handleSend()}
            placeholder={isIncognito ? "Ask in Incognito — nothing is saved..." : (activeMode === "build" ? "Ask or build... (Type @ for files, / for commands)" : "Ask a question — answers come straight back...")}
            placeholderTextColor={colors.inkMuted}
            className="w-full bg-transparent px-2 py-1 text-sm mb-3"
            style={{
              color: textPrimary,
              // Follows what is being typed, so a Persian prompt is set in
              // Vazirmatn as it is written rather than after it is sent.
              fontFamily: fontFamilyFor(inputText),
              // And runs the right way as it is typed. The input was hard-set to
              // left, so writing Persian put the caret and the text on the wrong
              // side of the field — the one place a user notices on every
              // keystroke rather than only when reading back.
              ...directionStyleFor(inputText),
              outlineStyle: "none",
              outlineWidth: 0,
            } as any}
            multiline
          />

          {/* Clean Controls Layout */}
          <View className="flex-row items-center justify-between pt-1">
            
            <View className="flex-row items-center">
              
              {/* '+' BUTTON OPENS 'Add to Chat' BOTTOM SHEET MODAL */}
              <TouchableOpacity 
                onPress={() => setShowAddToChatModal(true)}
                style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.borderHairline }}
                className="w-8 h-8 rounded-full items-center justify-center mr-2 border shadow-sm active:opacity-80"
                activeOpacity={0.8}
              >
                <VectorIcon name="plus" size={16} color={colors.inkPrimary} />
              </TouchableOpacity>

              {/* Model & Thinking Switcher Pill */}
              <TouchableOpacity
                onPress={() => setShowModelsModal(true)}
                style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.borderHairline }}
                className="flex-row items-center px-3.5 py-1.5 rounded-full border shadow-sm active:opacity-80"
                activeOpacity={0.8}
              >
                <VectorIcon name={activeModelObj.icon} size={12} color={colors[activeModelObj.tone]} style={{ marginRight: 6 }} />
                <Text style={{ color: textPrimary }} className="text-xs font-semibold mr-1.5">
                  {activeModelObj.name}
                </Text>
                <VectorIcon name="chevron-down" size={10} color={colors.inkSecondary} />
              </TouchableOpacity>

            </View>

            <View className="flex-row items-center">
              
              {isIncognito && (
                <View className="px-2.5 py-1 bg-purple-950/80 rounded-full mr-2 flex-row items-center">
                  <VectorIcon name="ghost" size={12} color={colors.brandPrimary} style={{ marginRight: 4 }} />
                  <Text style={{ color: colors.brandPrimary }} className=" text-[10px] font-mono">Incognito</Text>
                </View>
              )}

              {/* Send Button (Dark circle) */}
              <TouchableOpacity
                onPress={() => void handleSend()}
                disabled={!hasInputText}
                style={{
                  backgroundColor: hasInputText ? colors.brandPrimary : (colors.inkMuted),
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
                  color={colors.canvasBase} 
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
          <View style={{ backgroundColor: bgCard, borderColor: colors.borderHairline }} className="rounded-t-[32px] p-5 pb-8 relative shadow-2xl border">
            
            <View className="items-center mb-4">
              <View style={{ backgroundColor: colors.inkMuted }} className="w-12 h-1.5 rounded-full opacity-60" />
            </View>

            <View className="flex-row items-center justify-between mb-5 px-1">
              <TouchableOpacity 
                onPress={() => setShowAddToChatModal(false)}
                style={{ backgroundColor: colors.surfaceStrong }}
                className="w-9 h-9 rounded-full items-center justify-center"
                activeOpacity={0.8}
              >
                <VectorIcon name="x" size={14} color={colors.inkPrimary} />
              </TouchableOpacity>
              
              <Text style={{ color: textPrimary }} className="text-base font-bold">Project</Text>
              <View className="w-9" />
            </View>

            {/* Ways into the project from the composer. Restore points used to
                have no entry point at all — the sheet existed but nothing
                opened it. A 2x2 grid rather than one row: four tiles across a
                phone leaves each one too narrow to read. */}
            <View className="flex-row flex-wrap justify-between mb-3">
              {([
                { key: "files", label: "Files", icon: "file-text", run: () => setShowFileModal(true) },
                { key: "preview", label: "Preview", icon: "eye", run: () => setShowPreviewModal(true) },
                { key: "restore", label: "Restore points", icon: "rotate-ccw", run: () => setShowCheckpointsModal(true) },
                { key: "export", label: "Download as zip", icon: "download", run: () => void handleExport() },
                {
                  key: "skills",
                  label: activeSkills.length ? `Skills · ${activeSkills.length} on` : "Skills",
                  icon: "sparkles",
                  run: () => setShowSkillsModal(true),
                },
              ] as const).map((action) => (
                <TouchableOpacity
                  key={action.key}
                  onPress={() => {
                    setShowAddToChatModal(false);
                    action.run();
                  }}
                  disabled={action.key === "export" && exporting}
                  style={{ backgroundColor: colors.surfaceMuted }}
                  className="w-[48%] py-5 mb-3 rounded-2xl items-center justify-center active:opacity-80 shadow-sm border border-black/5"
                >
                  <View style={{ backgroundColor: colors.surfaceStrong }} className="w-11 h-11 rounded-full items-center justify-center mb-2">
                    {action.key === "export" && exporting ? (
                      <ActivityIndicator size="small" color={colors.brandPrimary} />
                    ) : (
                      <VectorIcon name={action.icon} size={20} color={colors.inkPrimary} />
                    )}
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
              style={{ borderColor: colors.borderHairline,  backgroundColor: colors.surfaceRaised }}
              className="flex-row items-center px-3 py-1.5 rounded-2xl border active:opacity-80"
            >
              <View style={{ backgroundColor: colors.brandSoft }} className="w-7 h-7 rounded-full items-center justify-center mr-2">
                <VectorIcon name="user" size={14} color={colors.brandPrimary} />
              </View>
              <Text style={{ color: textPrimary }} className="text-sm font-bold tracking-wide mr-1.5" numberOfLines={1}>
                {displayName}
              </Text>
              <VectorIcon name="chevron-right" size={10} color={colors.inkSecondary} />
            </TouchableOpacity>

            <View className="flex-row items-center">
              {/* Theme toggle */}
              <TouchableOpacity 
                onPress={() => setMode(isLight ? "darkest" : "light")}
                style={{ borderColor: colors.borderHairline,  backgroundColor: colors.surfaceRaised }}
                className="w-9 h-9 rounded-full items-center justify-center mr-2 border active:opacity-80"
              >
                <VectorIcon name={isLight ? "moon" : "sun"} size={15} color={colors.warning} />
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setShowDrawerModal(false)}
                style={{ borderColor: colors.borderHairline,  backgroundColor: colors.surfaceRaised }}
                className="w-9 h-9 rounded-full items-center justify-center border"
              >
                <VectorIcon name="x" size={14} color={colors.inkPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView className="flex-1 px-5 py-3" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
            <TouchableOpacity 
              onPress={handleOpenProjectsFromDrawer}
              style={{ borderColor: colors.borderHairline,  backgroundColor: colors.surfaceRaised }}
              className="flex-row items-center py-3 px-3.5 rounded-2xl mb-2.5 border active:opacity-80"
            >
              <VectorIcon name="folder" size={18} color={colors.warning} style={{ marginRight: 12 }} />
              <Text style={{ color: textPrimary }} className="text-sm font-bold flex-1 text-left">Projects</Text>
              <VectorIcon name="chevron-right" size={12} color={colors.inkSecondary} />
            </TouchableOpacity>

            {/* PROJECT GROUPED CHAT SESSIONS TREE — real projects + sessions */}
            <View className="mb-6">
              <Text style={{ color: textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-4 px-1">
                Projects & Workspace Chats
              </Text>

              {projects.length === 0 ? (
                <View className="items-center py-8 px-4">
                  <VectorIcon name="folder" size={26} color={colors.inkMuted} style={{ marginBottom: 10 }} />
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
                          <VectorIcon name="folder" size={16} color={colors.warning} style={{ marginRight: 8 }} />
                          <Text
                            style={{ color: textPrimary, ...directionStyleFor(project.name) }}
                            className="text-sm font-bold"
                            numberOfLines={1}
                          >
                            {project.name}
                          </Text>
                        </View>

                        <View style={{ backgroundColor: colors.borderHairline }} className="px-2.5 py-1 rounded-lg">
                          <Text style={{ color: colors.brandPrimary }} className="text-[10px] font-mono font-bold">Open</Text>
                        </View>
                      </TouchableOpacity>

                      {/* Real sessions for this project */}
                      <View style={{ borderColor: colors.borderHairline }} className="pl-3 ml-2 border-l">
                        {sessions.length === 0 ? (
                          <Text style={{ color: textMuted }} className="text-[10px] py-2 text-left">
                            {drawerSessions[project.id] ? "No chats yet" : "Loading…"}
                          </Text>
                        ) : (
                          sessions.map((item) => (
                            <TouchableOpacity
                              key={item.id}
                              onPress={() => handleLoadSession(item, project)}
                              style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
                              className="p-3 rounded-xl mb-2 border active:opacity-80 shadow-sm"
                            >
                              <Text
                                style={{ color: textPrimary, ...directionStyleFor(item.title) }}
                                className="text-xs font-medium mb-1.5 font-sans"
                                numberOfLines={1}
                              >
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
                                        ? (colors.successSoft)
                                        : item.status === "failed"
                                          ? (colors.failedSoft)
                                          : (colors.surfaceMuted),
                                  }}
                                  className="px-2 py-0.5 rounded-full"
                                >
                                  <Text
                                    style={{
                                      color:
                                        item.status === "completed"
                                          ? (colors.success)
                                          : item.status === "failed"
                                            ? (colors.failed)
                                            : (colors.inkSecondary),
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
            <View style={{ backgroundColor: colors.surfaceRaised }} className="flex-1 flex-row items-center px-3.5 py-2.5 rounded-full mr-3">
              <VectorIcon name="search" size={14} color={colors.inkSecondary} style={{ marginRight: 8 }} />
              <TextInput
                value={drawerQuery}
                onChangeText={setDrawerQuery}
                placeholder="Search chats..."
                placeholderTextColor={colors.inkMuted}
                className="flex-1 text-xs text-left"
                style={{ color: colors.inkPrimary }}
              />
              {drawerQuery.length > 0 && (
                <TouchableOpacity onPress={() => setDrawerQuery("")} className="p-1">
                  <VectorIcon name="x" size={12} color={colors.inkSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={{ backgroundColor: colors.brandPrimary }} 
              onPress={handleNewChat}
              className="w-12 h-12 rounded-full items-center justify-center shadow-lg"
            >
              <VectorIcon name="edit" size={18} color={colors.canvasBase} />
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
              <View style={{ backgroundColor: colors.inkMuted }} className="w-12 h-1.5 rounded-full opacity-60" />
            </View>

            <View className="flex-row items-center justify-between mb-4 pb-2 px-1">
              <Text style={{ color: textPrimary }} className="text-xl font-bold">Projects</Text>
              
              <View className="flex-row items-center">
                <TouchableOpacity style={{ backgroundColor: colors.warningSoft }} 
                  onPress={() => setShowNewProjectModal(true)}
                  className="w-8 h-8 rounded-full items-center justify-center mr-2 active:/30"
                >
                  <VectorIcon name="plus" size={16} color={colors.warning} />
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setShowProjectsModal(false)}
                  style={{ backgroundColor: colors.surfaceStrong }}
                  className="w-8 h-8 rounded-full items-center justify-center"
                >
                  <VectorIcon name="x" size={14} color={colors.inkSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                onPress={() => {
                  setShowProjectsModal(false);
                  goTo("GlobalSearch");
                }}
                style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.borderHairline }}
                className="mb-3 p-3 rounded-2xl flex-row items-center border active:opacity-80"
              >
                <VectorIcon name="search" size={15} color={textSecondary} style={{ marginRight: 10 }} />
                <Text style={{ color: textSecondary }} className="text-xs text-left flex-1">
                  Search your projects and chats
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowNewProjectModal(true)}
                style={{ backgroundColor: colors.warningSoft }}
                className="mb-4 p-4 rounded-2xl flex-row items-center justify-between active:opacity-80"
              >
                <View className="flex-row items-center">
                  <View style={{ backgroundColor: colors.warningSoft }} className="w-10 h-10 rounded-xl items-center justify-center mr-3">
                    <VectorIcon name="sparkles" size={18} color={colors.warning} />
                  </View>
                  <View>
                    <Text style={{ color: colors.warning }} className="text-sm font-bold text-left mb-0.5">New Project</Text>
                    <Text style={{ color: colors.warning }} className="text-xs text-left">Create coding environment & build new app</Text>
                  </View>
                </View>
                <VectorIcon name="plus" size={18} color={colors.warning} />
              </TouchableOpacity>

              {projects.length === 0 ? (
                <View className="items-center py-10 px-4">
                  <VectorIcon name="folder" size={28} color={colors.inkMuted} style={{ marginBottom: 10 }} />
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
                    style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.borderHairline }}
                    className="mb-3.5 p-4 rounded-2xl border active:opacity-80 shadow-sm"
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <Text
                        style={{ color: textPrimary, ...directionStyleFor(proj.name) }}
                        className="text-base font-bold flex-1 mr-2"
                        numberOfLines={1}
                      >
                        {proj.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteProjectFromSheet(proj.id, proj.name)}
                        style={{ backgroundColor: colors.surfaceStrong }}
                        className="w-7 h-7 rounded-lg items-center justify-center"
                      >
                        <VectorIcon name="trash" size={12} color={colors.inkSecondary} />
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
                          style={{ backgroundColor: colors.surfaceStrong }}
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
          <View style={{ backgroundColor: colors.surfaceRaised }} className="p-5 rounded-[28px] shadow-2xl">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center">
                <VectorIcon name="sparkles" size={16} color={colors.warning} style={{ marginRight: 6 }} />
                <Text style={{ color: colors.inkPrimary }} className=" text-base font-bold">Create New Project</Text>
              </View>
              <TouchableOpacity onPress={() => setShowNewProjectModal(false)}>
                <VectorIcon name="x" size={14} color={colors.inkSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: colors.inkSecondary }} className=" text-xs mb-2 text-left">Project Name:</Text>
            <TextInput
              value={newProjectName}
              onChangeText={setNewProjectName}
              placeholder="e.g. AI Portfolio App..."
              placeholderTextColor={colors.inkMuted}
              className="p-3 rounded-xl text-xs mb-4 text-left"
              style={{ backgroundColor: colors.surfaceStrong, color: colors.inkPrimary }}
            />

            <Text style={{ color: colors.inkSecondary }} className=" text-xs mb-2 text-left">Start from a template:</Text>
            <View className="flex-row flex-wrap mb-4">
              {PROJECT_TEMPLATE_CHOICES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setNewProjectTemplate(t.id)}
                  className="px-3 py-2 rounded-xl mr-2 mb-2"
                  style={{ backgroundColor: newProjectTemplate === t.id ? colors.warning : colors.surfaceStrong }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: newProjectTemplate === t.id ? colors.canvasBase : colors.inkSecondary }}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleCreateNewProject}
              disabled={isCreatingProject}
              className=" py-3 rounded-xl items-center shadow-lg flex-row justify-center"
              style={{ backgroundColor: colors.warning,  opacity: isCreatingProject ? 0.6 : 1 }}
            >
              {isCreatingProject ? (
                <ActivityIndicator size="small" color={colors.canvasBase} />
              ) : (
                <>
                  <Text style={{ color: colors.canvasBase }} className=" text-xs font-bold mr-1.5">Create & Open Project</Text>
                  <VectorIcon name="arrow-right" size={14} color={colors.canvasBase} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL: CONNECT NETLIFY                                              */}
      {/* =================================================================== */}
      <Modal
        visible={showDeployModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDeployModal(false)}
      >
        <View className="flex-1 justify-end bg-black/80">
          <View style={{ backgroundColor: colors.surfaceRaised }} className="rounded-t-[32px] p-5 pb-8">
            <View className="items-center mb-4">
              <View className="w-12 h-1.5 rounded-full opacity-60" style={{ backgroundColor: colors.inkMuted }} />
            </View>

            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <VectorIcon name="cloud" size={18} color={colors.success} style={{ marginRight: 8 }} />
                <Text style={{ color: textPrimary }} className="text-xl font-bold">Publish to Netlify</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDeployModal(false)} className="px-3 py-2">
                <Text style={{ color: colors.inkSecondary }} className="text-sm font-semibold">Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: textSecondary }} className="text-xs leading-5 mb-4">
              Netlify's free tier hosts static sites at no cost. Paste a personal
              access token from your own Netlify account — it is used to publish and
              nothing else.
            </Text>

            {/* Said plainly rather than implied. The token is a credential for
                their account and they are entitled to know where it lives. */}
            <View
              className="p-3 rounded-xl mb-4"
              style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.borderHairline, borderWidth: 1 }}
            >
              <Text style={{ color: textSecondary }} className="text-[11px] leading-5 text-left">
                The token is stored {tokenStorageIsSecure()
                  ? "in this device's secure keystore"
                  : "in this browser's local storage, which any script on this page could read"}
                {" "}and is sent only to Netlify. It never reaches our servers.
              </Text>
            </View>

            <Text style={{ color: textPrimary }} className="text-xs font-bold text-left mb-2">
              Netlify personal access token
            </Text>
            <TextInput
              value={netlifyToken}
              onChangeText={setNetlifyToken}
              placeholder="nfp_..."
              placeholderTextColor={colors.inkMuted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              className="w-full p-4 rounded-2xl text-sm mb-2"
              style={{
                backgroundColor: colors.surfaceMuted,
                color: textPrimary,
                outlineStyle: "none",
                outlineWidth: 0,
              } as any}
            />
            <Text style={{ color: colors.inkMuted }} className="text-[10px] leading-4 mb-4 text-left">
              Netlify → User settings → Applications → Personal access tokens → New
              access token.
            </Text>

            <TouchableOpacity
              onPress={() => void handleSaveToken()}
              style={{ backgroundColor: colors.success }}
              className="w-full py-4 rounded-2xl items-center justify-center active:opacity-90"
              activeOpacity={0.9}
            >
              <Text style={{ color: colors.canvasBase }} className="text-sm font-bold">Connect</Text>
            </TouchableOpacity>

            {hasNetlifyToken && (
              <TouchableOpacity
                onPress={async () => {
                  await forgetNetlifyToken();
                  setHasNetlifyToken(false);
                  setDeployedUrl(null);
                  notify("Netlify disconnected", "The token has been removed from this device.");
                }}
                className="mt-3 self-center px-3 py-2"
              >
                <Text style={{ color: colors.failed }} className="text-xs font-semibold">
                  Remove the saved token
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL: SKILLS PICKER                                                */}
      {/* =================================================================== */}
      <Modal
        visible={showSkillsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSkillsModal(false)}
      >
        <View className="flex-1 justify-end bg-black/80">
          <View style={{ backgroundColor: colors.surfaceRaised }} className="max-h-[85%] rounded-t-[32px] p-5 pb-8">
            <View className="items-center mb-4">
              <View className="w-12 h-1.5 rounded-full opacity-60" style={{ backgroundColor: colors.inkMuted }} />
            </View>

            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <VectorIcon name="sparkles" size={18} color={colors.brandPrimary} style={{ marginRight: 8 }} />
                <Text style={{ color: textPrimary }} className="text-xl font-bold">Skills</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSkillsModal(false)} className="px-3 py-2">
                <Text style={{ color: colors.brandPrimary }} className="text-sm font-semibold">Done</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: textSecondary }} className="text-xs leading-5 mb-4">
              Extra instructions for what you are building. Only the ones you switch
              on are sent, and they never override what you actually ask for.
            </Text>

            <ScrollView className="max-h-[420px]" showsVerticalScrollIndicator={false}>
              {SKILLS.map((skill) => {
                const on = activeSkills.includes(skill.id);
                return (
                  <TouchableOpacity
                    key={skill.id}
                    onPress={() => {
                      selectionFeedback();
                      setActiveSkills((prev) =>
                        prev.includes(skill.id)
                          ? prev.filter((id) => id !== skill.id)
                          : [...prev, skill.id],
                      );
                    }}
                    style={{
                      backgroundColor: on ? colors.brandSoft : colors.surfaceMuted,
                      borderColor: on ? colors.brandPrimary : colors.borderHairline,
                      borderWidth: on ? 2 : 1,
                    }}
                    className="flex-row items-center p-4 rounded-2xl mb-2.5 active:opacity-80"
                    activeOpacity={0.8}
                  >
                    <View
                      style={{ backgroundColor: on ? colors.brandPrimary : colors.surfaceStrong }}
                      className="w-9 h-9 rounded-full items-center justify-center mr-3"
                    >
                      <VectorIcon
                        name={skill.icon}
                        size={16}
                        color={on ? colors.canvasBase : colors.inkSecondary}
                      />
                    </View>
                    <View className="flex-1 mr-2">
                      <Text style={{ color: textPrimary }} className="text-sm font-semibold text-left">
                        {skill.name}
                      </Text>
                      <Text style={{ color: textSecondary }} className="text-xs text-left mt-0.5 leading-4">
                        {skill.description}
                      </Text>
                    </View>
                    {/* A tick, not a switch: the whole row is the target, and a
                        switch beside a pressable row invites two different taps. */}
                    <View
                      style={{
                        borderColor: on ? colors.brandPrimary : colors.borderHairline,
                        backgroundColor: on ? colors.brandPrimary : "transparent",
                      }}
                      className="w-5 h-5 rounded-md border items-center justify-center"
                    >
                      {on ? <VectorIcon name="check" size={12} color={colors.canvasBase} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {activeSkills.length > 0 && (
              <TouchableOpacity
                onPress={() => { tapFeedback(); setActiveSkills([]); }}
                className="mt-3 self-start px-3 py-2 rounded-lg"
                style={{ backgroundColor: colors.surfaceMuted }}
              >
                <Text style={{ color: colors.inkSecondary }} className="text-xs font-semibold">
                  Turn all off
                </Text>
              </TouchableOpacity>
            )}
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
        <View style={{ backgroundColor: colors.canvasBase }} className="flex-1 bg-black">
          <View style={{ backgroundColor: colors.canvasBase }} className="flex-row items-center justify-between px-5 py-4">
            <TouchableOpacity onPress={() => setShowPreviewModal(false)} className="p-1 flex-row items-center">
              <VectorIcon name="x" size={14} color={colors.inkSecondary} style={{ marginRight: 6 }} />
              <Text style={{ color: colors.inkSecondary }} className=" text-sm font-semibold">Close</Text>
            </TouchableOpacity>
            <View className="flex-row items-center">
              <VectorIcon name="eye" size={16} color={colors.success} style={{ marginRight: 6 }} />
              <Text style={{ color: colors.inkPrimary }} className=" text-base font-bold">Live App Preview</Text>
            </View>
            <View className="flex-row items-center">
              {/* Share what is on screen. Placed here rather than in the chat so
                  "what you see is what you share" is literally true — this
                  publishes the document the surface below is rendering. */}
              <TouchableOpacity
                onPress={handleShareApp}
                disabled={publishing || previewLoading || !previewHtml}
                style={{ opacity: previewHtml && !previewLoading ? 1 : 0.4 }}
                className="p-1 flex-row items-center mr-4"
                activeOpacity={0.7}
              >
                {publishing ? (
                  <ActivityIndicator size="small" color={colors.brandPrimary} />
                ) : (
                  <>
                    <VectorIcon
                      name={publishedUrl ? "link" : "share-2"}
                      size={12}
                      color={colors.brandPrimary}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={{ color: colors.brandPrimary }} className=" text-xs font-bold">
                      {publishedUrl ? "Copy link" : "Share"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDeploy}
                disabled={deploying || previewLoading}
                style={{ opacity: previewLoading ? 0.4 : 1 }}
                className="p-1 flex-row items-center mr-4"
                activeOpacity={0.7}
              >
                {deploying ? (
                  <ActivityIndicator size="small" color={colors.success} />
                ) : (
                  <>
                    <VectorIcon
                      name={deployedUrl ? "globe" : "cloud"}
                      size={12}
                      color={colors.success}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={{ color: colors.success }} className=" text-xs font-bold">
                      {deployedUrl ? "Open site" : "Deploy"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={loadPreview} className="p-1 flex-row items-center">
                <VectorIcon name="rotate-ccw" size={12} color={colors.brandPrimary} style={{ marginRight: 4 }} />
                <Text style={{ color: colors.brandPrimary }} className=" text-xs font-bold">Refresh</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* No frame, no padding, no fake window buttons. This used to be dressed
              up as a desktop browser — two nested paddings, rounded corners and
              three traffic lights — which on a phone spent most of the width on
              decoration and made the preview itself a small box in the middle.
              The real app gets the whole surface; the controls it needs are in
              the header above. */}
          <View style={{ backgroundColor: colors.canvasBase }} className="flex-1">
            <View className="w-full h-full flex-col">
              {previewLoading ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator size="large" color={colors.brandPrimary} />
                  <Text style={{ color: colors.inkSecondary }} className=" text-xs mt-4">Building on-device preview…</Text>
                </View>
              ) : previewError ? (
                <View className="flex-1 items-center justify-center px-6">
                  <VectorIcon name="x" size={32} color={colors.failed} style={{ marginBottom: 12 }} />
                  <Text style={{ color: colors.inkPrimary }} className=" text-sm font-bold mb-2">Preview failed</Text>
                  <Text style={{ color: colors.inkSecondary }} className=" text-xs text-center leading-5">{previewError}</Text>
                </View>
              ) : previewHtml ? (
                <PreviewSurface html={previewHtml} />
              ) : (
                <View className="flex-1 items-center justify-center px-6">
                  <VectorIcon name="eye" size={36} color={colors.inkMuted} style={{ marginBottom: 12 }} />
                  <Text style={{ color: colors.inkSecondary }} className=" text-xs text-center leading-5">
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
          <View style={{ backgroundColor: colors.surfaceRaised }} className="max-h-[85%] rounded-t-[32px] p-5 pb-8">
            <View className="items-center mb-4">
              <View className="w-12 h-1.5 bg-zinc-700 rounded-full opacity-60" />
            </View>

            <View className="flex-row items-center justify-between mb-4 pb-3">
              <View className="flex-row items-center">
                <VectorIcon name="rotate-ccw" size={18} color={colors.brandPrimary} style={{ marginRight: 8 }} />
                <Text style={{ color: colors.inkPrimary }} className=" text-xl font-bold">Restore points</Text>
              </View>
              <TouchableOpacity style={{ backgroundColor: colors.surfaceStrong }} 
                onPress={() => setShowCheckpointsModal(false)}
                className="w-8 h-8 rounded-full items-center justify-center"
              >
                <VectorIcon name="x" size={14} color={colors.inkSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {checkpointsLoading ? (
                <View className="py-10 items-center">
                  <ActivityIndicator size="small" color={colors.brandPrimary} />
                  <Text style={{ color: colors.inkMuted }} className=" text-xs mt-3">Loading checkpoints…</Text>
                </View>
              ) : checkpoints.length === 0 ? (
                <View className="py-10 items-center px-6">
                  <VectorIcon name="rotate-ccw" size={26} color={colors.inkMuted} style={{ marginBottom: 10 }} />
                  <Text style={{ color: colors.inkSecondary }} className=" text-sm font-bold mb-2">No restore points yet</Text>
                  <Text style={{ color: colors.inkMuted }} className=" text-xs text-center leading-5 mb-4">
                    One is saved automatically before every run that can change your files.
                    Ask the agent to build something and it will show up here.
                  </Text>
                  <View className="w-full px-6">{saveRestorePointButton}</View>
                </View>
              ) : (
                <>
                  <Text style={{ color: colors.inkMuted }} className=" text-xs text-left leading-5 mb-3 px-1">
                    Each one is how the project looked before that run. Rolling back saves a
                    restore point first, so it can be undone.
                  </Text>
                  {saveRestorePointButton}
                  {checkpoints.map((cp) => (
                    <View style={{ backgroundColor: colors.surfaceMuted }} key={cp.id} className="mb-3 p-4 rounded-2xl">
                      <View className="flex-row items-center mb-1">
                        <View className="w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2" />
                        <Text style={{ color: colors.inkPrimary }} className=" text-sm font-bold text-left flex-1" numberOfLines={1}>
                          {cp.session_title ? `Before: ${cp.session_title}` : "Restore point"}
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-between mt-1">
                        <Text style={{ color: colors.inkSecondary }} className=" text-xs text-left font-mono">
                          {relativeTime(cp.created_at)} · {cp.id.slice(0, 7)}
                        </Text>
                        <TouchableOpacity style={{ backgroundColor: colors.surfaceStrong }}
                          onPress={() => handleRollback(cp.id, `on ${relativeTime(cp.created_at)}`)}
                          disabled={restoringCheckpointId !== null || isExecuting}
                          className="px-3 py-1.5 rounded-lg flex-row items-center"
                          activeOpacity={0.8}
                        >
                          {restoringCheckpointId === cp.id ? (
                            <ActivityIndicator size="small" color={colors.brandPrimary} />
                          ) : (
                            <>
                              <VectorIcon name="rotate-ccw" size={12} color={colors.brandPrimary} style={{ marginRight: 5 }} />
                              <Text style={{ color: colors.brandPrimary }} className=" text-xs font-semibold">Restore</Text>
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
                  <VectorIcon name="x" size={14} color={colors.inkSecondary} style={{ marginRight: 6 }} />
                  <Text style={{ color: textSecondary }} className="text-sm font-semibold">Close</Text>
                </TouchableOpacity>
                <Text style={{ color: textPrimary }} className="text-base font-bold">Settings</Text>
                <View className="w-9" />
              </View>

              <ScrollView className="flex-1 px-4 py-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
                {/* Profile Card */}
                <View style={{ backgroundColor: bgCard, borderColor: colors.borderHairline }} className="p-4 rounded-2xl mb-4 flex-row items-center justify-between shadow-sm border">
                  <View className="flex-row items-center flex-1 mr-2">
                    <View className="w-10 h-10 rounded-full bg-purple-950/40 items-center justify-center mr-3">
                      <VectorIcon name="user" size={18} color={colors.brandPrimary} />
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

                  <View style={{ backgroundColor: colors.inkPrimary }} className="px-3.5 py-1.5 rounded-full items-center justify-center">
                    <Text style={{ color: colors.canvasBase, fontWeight: "700", fontSize: 12 }}>
                      {(profile?.subscription_tier ?? "free").toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Upgrade Card */}
                <View style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.borderHairline }} className="p-5 rounded-2xl mb-6 shadow-sm border relative overflow-hidden">
                  <Text style={{ color: textPrimary }} className="text-base font-bold text-left mb-1">Want more Retro Code?</Text>
                  <Text style={{ color: textSecondary }} className="text-xs text-left mb-4 leading-5">
                    Upgrade for more usage and capabilities.
                  </Text>

                  <TouchableOpacity
                    onPress={() => goTo("Paywall", {})}
                    style={{ backgroundColor: colors.inkPrimary }}
                    className="px-6 py-2.5 rounded-2xl self-start active:opacity-90 shadow-md items-center justify-center"
                  >
                    <Text style={{ color: colors.canvasBase, fontWeight: "700", fontSize: 13 }}>Upgrade</Text>
                  </TouchableOpacity>
                </View>

                {/* Account & app screens (these live in the Profile stack) */}
                <View style={{ backgroundColor: bgCard, borderColor: colors.borderHairline }} className="rounded-2xl overflow-hidden mb-5 border shadow-sm">
                  {([
                    // Only an operator sees this. Hiding it is presentation —
                    // every admin action re-checks the flag server-side.
                    ...(profile?.is_admin
                      ? [{ label: "Admin", icon: "shield", target: "Admin", root: false } as const]
                      : []),
                    { label: "Account", icon: "user", target: "AccountSettings", root: false },
                    { label: "Preferences", icon: "settings", target: "Preferences", root: false },
                    { label: "Your AI providers", icon: "cpu", target: "Providers", root: false },
                    { label: "Shared links", icon: "link", target: "SharedLinks", root: false },
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
                        <VectorIcon name={row.icon} size={16} color={colors.inkSecondary} style={{ marginRight: 12 }} />
                        <Text style={{ color: textPrimary }} className="text-sm font-semibold text-left">{row.label}</Text>
                      </View>
                      <VectorIcon name="chevron-right" size={12} color={colors.inkSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ backgroundColor: bgCard, borderColor: colors.borderHairline }} className="rounded-2xl overflow-hidden mb-5 border shadow-sm">
                  <TouchableOpacity
                    onPress={() => setProfileSubScreen("usage")}
                    className="flex-row items-center justify-between p-4 active:opacity-80"
                  >
                    <View className="flex-row items-center">
                      <VectorIcon name="card" size={16} color={colors.inkSecondary} style={{ marginRight: 12 }} />
                      <Text style={{ color: textPrimary }} className="text-sm font-semibold">Usage & Billing</Text>
                    </View>
                    <VectorIcon name="chevron-right" size={12} color={colors.inkSecondary} />
                  </TouchableOpacity>
                </View>


                {/* Theme & Preferences */}
                <View style={{ backgroundColor: bgCard, borderColor: colors.borderHairline }} className="rounded-2xl overflow-hidden mb-6 border shadow-sm">
                  <TouchableOpacity 
                    onPress={() => setMode(NEXT_THEME_MODE[mode])}
                    className="flex-row items-center justify-between p-4 active:opacity-80"
                  >
                    <View className="flex-row items-center">
                      <VectorIcon name={isLight ? "sun" : "moon"} size={16} color={colors.warning} style={{ marginRight: 12 }} />
                      <View>
                        <Text style={{ color: textPrimary }} className="text-sm font-semibold text-left">Color mode</Text>
                        <Text style={{ color: colors.warning }} className="text-xs text-left font-medium">
                          {THEME_MODE_LABEL[mode]}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.brandPrimary }} className="text-xs font-bold">Tap to Switch ➔</Text>
                  </TouchableOpacity>

                </View>

                <TouchableOpacity
                  onPress={handleSignOut}
                  className="w-full py-3.5 rounded-full bg-red-500/10 items-center justify-center mb-8 active:opacity-80"
                >
                  <Text style={{ color: colors.failed }} className=" text-sm font-bold">Sign Out</Text>
                </TouchableOpacity>

              </ScrollView>
            </View>
          )}

          {/* SUB-SCREEN 2: PROFILE EDIT */}

          {/* SUB-SCREEN 5: USAGE AND CREDITS */}
          {profileSubScreen === "usage" && (
            <View style={{ backgroundColor: colors.canvasBase }} className="flex-1">
              <View className="flex-row items-center px-4 py-4">
                <TouchableOpacity style={{ backgroundColor: colors.surfaceRaised }} 
                  onPress={() => setProfileSubScreen("main")} 
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                >
                  <VectorIcon name="arrow-left" size={16} color={colors.canvasBase} />
                </TouchableOpacity>
                <Text style={{ color: colors.inkPrimary }} className=" text-lg font-bold">Usage and credits</Text>
              </View>

              <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
                {usageLoading ? (
                  <View className="py-12 items-center">
                    <ActivityIndicator size="small" color={colors.brandPrimary} />
                    <Text style={{ color: colors.inkMuted }} className=" text-xs mt-3">Loading usage…</Text>
                  </View>
                ) : usage ? (
                  <>
                    <View style={{ backgroundColor: colors.surfaceRaised }} className="p-4 rounded-2xl mb-4">
                      <View className="flex-row items-center justify-between mb-3">
                        <Text style={{ color: colors.inkSecondary }} className=" text-xs">Plan</Text>
                        <Text style={{ color: colors.inkPrimary }} className=" text-xs font-bold uppercase">{usage.tier}</Text>
                      </View>

                      <Text style={{ color: colors.inkSecondary }} className=" text-xs text-left mb-1">Tokens used this period</Text>
                      <Text style={{ color: colors.inkPrimary }} className=" text-2xl font-bold text-left mb-3">
                        {usage.tokensUsed.toLocaleString("en-US")}
                        {usage.tokenLimit ? (
                          <Text style={{ color: colors.inkMuted }} className=" text-sm font-medium"> / {usage.tokenLimit.toLocaleString("en-US")}</Text>
                        ) : null}
                      </Text>

                      {usage.tokenLimit > 0 && (
                        <View style={{ backgroundColor: colors.surfaceStrong }} className="h-2 rounded-full overflow-hidden mb-2">
                          <View
                            style={{
                              width: `${Math.min(100, Math.round((usage.tokensUsed / usage.tokenLimit) * 100))}%`,
                              backgroundColor: usage.remaining > 0 ? colors.brandPrimary : colors.failed,
                            }}
                            className="h-full rounded-full"
                          />
                        </View>
                      )}

                      <Text style={{ color: colors.inkMuted }} className=" text-[11px] text-left">
                        {usage.remaining > 0
                          ? `${usage.remaining.toLocaleString("en-US")} tokens remaining`
                          : "Limit reached — new agent runs are blocked until the period resets."}
                      </Text>
                    </View>

                    <View className="flex-row justify-between">
                      <View style={{ backgroundColor: colors.surfaceRaised }} className="w-[48%] p-3.5 rounded-2xl">
                        <Text style={{ color: colors.inkPrimary }} className=" text-xs font-bold mb-2">Agent runs</Text>
                        <Text style={{ color: colors.inkPrimary }} className=" text-xl font-bold text-left">{usage.requests.toLocaleString("en-US")}</Text>
                        <Text style={{ color: colors.inkMuted }} className=" text-[10px] text-left">this period</Text>
                      </View>
                      <View style={{ backgroundColor: colors.surfaceRaised }} className="w-[48%] p-3.5 rounded-2xl">
                        <Text style={{ color: colors.inkPrimary }} className=" text-xs font-bold mb-2">Resets</Text>
                        <Text style={{ color: colors.inkPrimary }} className=" text-sm font-bold text-left">
                          {usage.periodEnd ? new Date(usage.periodEnd).toLocaleDateString() : "—"}
                        </Text>
                        <Text style={{ color: colors.inkMuted }} className=" text-[10px] text-left">end of period</Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <View className="py-12 items-center px-6">
                    <Text style={{ color: colors.inkSecondary }} className=" text-xs text-center leading-5">
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
            style={{ backgroundColor: bgCard, borderColor: colors.borderHairline }} 
            className="h-[52%] rounded-t-[32px] px-5 pt-3 pb-4 shadow-2xl border flex-col"
          >
            {/* Top Drag Indicator Handle */}
            <View className="items-center mb-1.5">
              <View style={{ backgroundColor: colors.borderHairline }} className="w-10 h-1 rounded-full" />
            </View>

            {/* Header Row */}
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-baseline">
                <Text style={{ color: textPrimary }} className="text-lg font-bold mr-2">Models</Text>
                <Text style={{ color: textSecondary }} className="text-xs font-medium">Best AI Engines</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowModelsModal(false)}
                style={{ backgroundColor: colors.surfaceMuted }}
                className="w-7 h-7 rounded-full items-center justify-center border border-slate-200/50"
              >
                <VectorIcon name="x" size={13} color={colors.inkSecondary} />
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
                        ? (colors.surfaceMuted)
                        : (colors.surfaceMuted),
                      borderColor: isSelected
                        ? (colors.borderHairline)
                        : (colors.surfaceMuted)
                    }}
                    className="mb-2 p-3 rounded-2xl transition-all border"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <VectorIcon name={model.icon} size={15} color={colors[model.tone]} style={{ marginRight: 8 }} />
                        <Text style={{ color: textPrimary }} className="text-sm font-semibold mr-2">
                          {model.name}
                        </Text>
                        
                        {model.badge && (
                          <View className="bg-sky-500/20 px-1.5 py-0.5 rounded mr-1">
                            <Text style={{ color: colors.brandPrimary }} className=" text-[9px] font-mono uppercase">{model.badge}</Text>
                          </View>
                        )}
                      </View>

                      {isSelected && (
                        <VectorIcon name="check" size={15} color={colors.brandPrimary} />
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
          <View style={{ backgroundColor: colors.surfaceRaised }} className="h-3/4 p-4 rounded-t-[28px]">
            <View className="flex-row justify-between items-center mb-4 pb-3">
              <Text style={{ color: colors.inkPrimary }} className=" text-sm font-bold">Project Files</Text>
              <TouchableOpacity onPress={() => setShowFileModal(false)} className="p-1">
                <VectorIcon name="x" size={14} color={colors.inkSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1">
              {filesLoading ? (
                <View className="py-10 items-center">
                  <ActivityIndicator size="small" color={colors.brandPrimary} />
                  <Text style={{ color: colors.inkMuted }} className=" text-xs mt-3">Loading project files…</Text>
                </View>
              ) : fileEntries.length === 0 ? (
                <View className="py-10 items-center px-6">
                  <VectorIcon name="folder" size={28} color={colors.inkMuted} style={{ marginBottom: 10 }} />
                  <Text style={{ color: colors.inkSecondary }} className=" text-xs text-center leading-5">
                    {filesError ?? "No files yet — ask the agent to build something and they'll appear here."}
                  </Text>
                </View>
              ) : (
                fileEntries.map((entry) => (
                  <View
                    key={entry.path}
                    className="py-2.5 px-3 rounded-xl flex-row justify-between items-center mb-1.5"
                    style={{ backgroundColor: colors.surfaceMuted,  marginLeft: entry.depth * 12 }}
                  >
                    <View className="flex-row items-center flex-1 mr-2">
                      <VectorIcon name="file-text" size={13} color={colors.brandPrimary} style={{ marginRight: 6 }} />
                      <Text style={{ color: colors.inkSecondary }} numberOfLines={1} className=" text-xs font-mono">{entry.path}</Text>
                    </View>
                    <Text style={{ color: colors.inkMuted }} className=" text-[10px]">{entry.sizeLabel}</Text>
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
