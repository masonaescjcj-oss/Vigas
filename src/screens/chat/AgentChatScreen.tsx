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
import { getProjectFiles, toFileEntries, type ProjectFileEntry } from "../../services/fileService";
import { isUuid } from "../../services/formatting";
import { directionStyleFor } from "../../theme/direction";
import { fetchModelCatalog } from "../../services/modelCatalog";
import { AUTO_MODEL, type CatalogModel } from "../../core/models/tiering";
import { ClarifyCard } from "../../components/ClarifyCard";
import { PlanCard, TodoChecklist, type TodoItem } from "../../components/RunProgress";
import { PURCHASES } from "../../services/distributionChannel";
import { track } from "../../services/analytics";
import { durationBucket } from "../../core/analytics/events";
import {
  type ClarifyAnswer,
  type ClarifyRequest,
  formatAnswers,
} from "../../core/agent/clarify";
import { SKILLS } from "../../core/agent/skills/catalog";
import { deployProject } from "../../services/deployService";
import { forgetDeployToken, loadDeployToken, saveDeployToken, tokenStorageIsSecure, type DeployProvider } from "../../services/deployToken";
import { PROVIDER_LABEL } from "../../services/deployService";
import { looksLikeNetlifyToken } from "../../services/netlify";
import { looksLikeVercelToken } from "../../services/vercel";
import {
  classifySupabaseKey,
  forgetBackendTarget,
  isSupabaseUrl,
  loadBackendTarget,
  saveBackendTarget,
  type BackendTarget,
} from "../../services/backendTarget";
import { buildPreviewHtml } from "../../services/previewBuilder";
import { createShare } from "../../services/shareService";
import { exportProject, openDownload, readableSize } from "../../services/exportService";
import { shareLink } from "../../services/shareSheet";
import { type ToolRunStep } from "../../components/ToolRunRow";
import { RunLog } from "../../components/RunLog";
import { AgentMessageText } from "../../components/AgentMessageText";
import { ThinkingIndicator } from "../../components/ThinkingIndicator";
import { AnimatedAgentText } from "../../components/AnimatedAgentText";
import { PreviewSurface } from "../../components/PreviewSurface";
import { Icon as VectorIcon } from "../../components/Icon";
import { Button } from "../../components/Button";
import { SettingsRow } from "../../components/SettingsRow";
import { Card } from "../../components/ui/Card";
import { Sheet } from "../../components/ui/Sheet";
import { Input } from "../../components/ui/Input";
import { Pill } from "../../components/ui/Pill";
import { Led } from "../../components/ui/Led";
import { MatrixMark } from "../../components/ui/MatrixMark";
import { Monogram } from "../../components/ui/Monogram";
import { keyEdge, wellShadow } from "../../theme/device";
import { useBreakpoint, columnStyle, COLUMN_MAX, SIDEBAR_WIDTH } from "../../theme/breakpoints";

// ============================================================================
// 1. DATA MODELS & INITIAL STATE SCHEMAS
// ============================================================================

/**
 * The picker's contents come from the `models` table via fetchModelCatalog, so
 * what the admin marks free or premium is what a user sees. This is the list
 * shown until that read returns — Auto alone, because "server decides" is the
 * one entry that is always valid and never gated.
 */
const INITIAL_MODELS: CatalogModel[] = [AUTO_MODEL];

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


/**
 * What the empty Build screen offers to someone who has not decided yet. Each
 * one drops a real prompt into the composer — editable, not sent — so the
 * first message is theirs.
 */
const STARTERS = [
  { label: "Landing page", prompt: "Build a landing page for " },
  { label: "Todo app", prompt: "Build a todo app with local storage, filters and a clean minimal design." },
  { label: "Blog", prompt: "Build a small blog with a list of posts and a post page, content in markdown files." },
  { label: "Shop with backend", prompt: "Build a shop with a product list, a cart and checkout, using Supabase for products and orders." },
];


/**
 * chat | build as a two-position slide switch: a well, a key sitting in it on
 * the chosen side, and an LED that is lit on that side only.
 */
const ModeSwitch = ({ mode, onSelect }: { mode: "chat" | "build"; onSelect: (m: "chat" | "build") => void }) => {
  const { colors, mode: themeMode } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Mode"
      style={[{ flexDirection: "row", padding: 4, borderRadius: 999, backgroundColor: colors.surfaceCode }, wellShadow(themeMode)]}
    >
      {(["chat", "build"] as const).map((m) => {
        const on = mode === m;
        return (
          <TouchableOpacity
            key={m}
            onPress={() => onSelect(m)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            activeOpacity={0.8}
            style={[
              { height: 36, paddingHorizontal: 16, borderRadius: 999, flexDirection: "row", alignItems: "center", backgroundColor: on ? colors.surfaceMuted : "transparent" },
              on ? keyEdge(colors.capEdge) : null,
            ]}
          >
            <Led on={on} size={6} style={{ marginRight: 8 }} />
            <Text variant="label" style={{ fontSize: 13, lineHeight: 17, color: on ? colors.inkPrimary : colors.inkMuted }}>{m}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
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
  // On a wide screen the drawer is a sidebar, always visible, and the
  // conversation sits in a column rather than spanning the window.
  const { wide } = useBreakpoint();
  // A round key: the header's controls stand up from the body like the
  // buttons on a radio.
  const roundKey = (size = 44) => [
    { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceRaised, alignItems: "center" as const, justifyContent: "center" as const },
    keyEdge(colors.capEdge),
  ];
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
  // Chat is the default: it answers anything and costs one call, where Build
  // queues an agent run against a project. Opening on the heavier of the two
  // asked every user to step down to the lighter one.
  const [activeMode, setActiveMode] = useState<"chat" | "build">("chat");

  // Anonymous / Incognito Mode: When true, sessions are not logged or saved to database
  const [isIncognito, setIsIncognito] = useState(false);

  // Selected Model & Thinking Reasoning Toggle State
  const defaultModel = useSettingsStore((s) => s.defaultModel);
  const [selectedModelId, setSelectedModelId] = useState<string>(defaultModel);
  const [models, setModels] = useState<CatalogModel[]>(INITIAL_MODELS);

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
  /**
   * agent-run rows whose closing message has already been shown.
   *
   * One request can span several jobs — a build too big for one turn queues its
   * own continuation — so "the newest finished run row" is no longer a reliable
   * once-only signal on its own.
   */
  const settledRunIdsRef = useRef<Set<string>>(new Set());
  const { projects, createProject, deleteProject } = useProjects();
  const { profile, user, signOut } = useAuthStore();
  // Every account has an email now that guest mode is gone, so the last
  // fallback only covers the moment before the profile arrives — it must not
  // name a kind of user that no longer exists.
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Account";

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
  // Which host the Deploy button uses. Netlify by default because it takes the whole
  // archive; Vercel inlines text files only.
  const [deployProvider, setDeployProvider] = useState<DeployProvider>("netlify");
  const [deployTokenInput, setDeployTokenInput] = useState("");
  const [connected, setConnected] = useState<Record<DeployProvider, boolean>>({ netlify: false, vercel: false });

  // The user's own Supabase project, for skills that build against a backend.
  const [backend, setBackend] = useState<BackendTarget | null>(null);
  const [showBackendModal, setShowBackendModal] = useState(false);
  const [backendUrl, setBackendUrl] = useState("");
  const [backendKey, setBackendKey] = useState("");

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

  // Modal Visibility Controllers
  const [showDrawerModal, setShowDrawerModal] = useState(false);        // Drawer Dashboard
  const [showAddToChatModal, setShowAddToChatModal] = useState(false);  // '+' Add to Chat Sheet
  const [showProjectsModal, setShowProjectsModal] = useState(false);    // Projects List Sheet
  const [showNewProjectModal, setShowNewProjectModal] = useState(false); // New Project Dialog
  const [showModelsModal, setShowModelsModal] = useState(false);        // Models Selector Sheet
  const [showFileModal, setShowFileModal] = useState(false);          // File Tree Sheet
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

  // User Profile Settings Form States

  // Projects Form Search State
  const [newProjectName, setNewProjectName] = useState("");

  // Active Model Helper Object
  // You.com's agents answer and search; they cannot call the tools Build runs
  // on, so Build never offers them. Chat offers everything.
  const isYoucom = (id: string) => id.startsWith("youcom-");
  const modeModels = activeMode === "build" ? models.filter((m) => !isYoucom(m.id)) : models;
  // In Chat, Auto means You.com's web search whenever the server offers it
  // (see chooseChatEngine), so the catalogue's "Default" is Build's default
  // there, and saying so in Chat would be wrong.
  const chatSearches = activeMode === "chat" && models.some((m) => isYoucom(m.id));
  const activeModelObj = modeModels.find(m => m.id === selectedModelId) || modeModels[0] || AUTO_MODEL;

  // The catalogue depends on the plan, so a subscription that changes mid-session
  // has to re-read it — otherwise a model just paid for stays locked.
  const tier = profile?.subscription_tier ?? "free";
  // A Play build may say a plan exists but must not tap through to buying
  // one: the tap is the link-out Play regulates, not the sentence.
  const canBuy = PURCHASES.canLinkOut;
  useEffect(() => {
    let cancelled = false;
    fetchModelCatalog(tier).then((loaded) => {
      if (cancelled) return;
      setModels(loaded);
      // A model that became gated while it was selected must not stay selected —
      // the run would be refused with MODEL_REQUIRES_UPGRADE on send.
      const current = loaded.find((entry) => entry.id === selectedModelId);
      if (current?.locked) setSelectedModelId(AUTO_MODEL.id);
    });
    return () => { cancelled = true; };
  }, [tier]);

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
    // Blank, not "landing".
    //
    // This runs when someone just starts typing without picking a project, so
    // it is the common path. Seeding a static landing page here decided what
    // the app was before reading the request: someone asking for a Python
    // trading bot got a project already containing index.html and styles.css,
    // and the agent — reasonably — built onto the web project it found.
    //
    // Measured both ways against the deployed stack: from a blank project the
    // same request produces crypto_bot.py, a test and a README, and no HTML at
    // all. The bias was here, not in the model.
    const created = await createProject({ name: activeProjectName || "My First App", template: "blank" });
    setActiveProjectId(created.id);
    setActiveProjectName(created.name);
    return created.id;
  };

  // Whether an account is already connected decides what the deploy button says.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadDeployToken("netlify"), loadDeployToken("vercel")]).then(([netlify, vercel]) => {
      if (cancelled) return;
      setConnected({ netlify: !!netlify, vercel: !!vercel });
      // Open on whichever is already connected, so the common case is one press.
      if (!netlify && vercel) setDeployProvider("vercel");
    });
    void loadBackendTarget().then((target) => {
      if (!cancelled) setBackend(target);
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

  /**
   * Load real chat sessions for every project whenever the list is on screen:
   * when the drawer opens on a phone, and always on a wide screen, where the
   * same list is a sidebar that never "opens" — it read "Loading…" forever
   * because this only listened for the drawer. Reloads when a chat starts so
   * the new one appears in the list without a refresh.
   */
  useEffect(() => {
    if ((!showDrawerModal && !wide) || projects.length === 0) return;
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
  }, [showDrawerModal, wide, projects.length, activeSessionId]);


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
      settledRunIdsRef.current.clear();
      const res = await agentService.startAgentRun(projectId, userPromptText, {
        title: userPromptText.slice(0, 48),
        sessionId: activeSessionId ?? undefined,
        model: selectedModelId,
        ...(activeSkills.length ? { skills: activeSkills } : {}),
        // Only when the Supabase skill asked for it. Otherwise the project URL
        // would sit in every stored transcript for no reason.
        ...(activeSkills.includes("supabase-backend") && backend ? { backend } : {}),
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
    <Button
      label="Save a restore point now"
      icon="plus"
      tone="neutral"
      size="sm"
      block
      className="mb-4"
      loading={savingCheckpoint}
      disabled={isExecuting}
      onPress={handleSaveRestorePoint}
    />
  );

  /**
   * Roll the project's files back to a snapshot.
   *
   * This overwrites the working files, so it asks first. The backend snapshots
   * the current state before swapping, which is why the confirmation can
   * honestly say the rollback is itself undoable.
   */
  /**
   * Send the user's choices back as the next turn.
   *
   * Not a new mechanism: the agent's turn ended when it asked, so this is an
   * ordinary run on the same session. The transcript already holds the question,
   * and the answers arrive as a user message — which is why the agent treats
   * them as instructions rather than as tool output it might argue with.
   */
  const handleClarifyAnswers = async (
    messageId: string,
    request: ClarifyRequest,
    answers: ClarifyAnswer[],
  ) => {
    // Recorded on the message first, so the card switches to its answered state
    // immediately rather than after the round trip.
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, clarifyAnswers: answers } : m)),
    );
    setIsExecuting(true);
    try {
      const projectId = await ensureProjectId();
      runStartedAtRef.current = new Date().toISOString();
      settledRunIdsRef.current.clear();
      const res = await agentService.startAgentRun(projectId, formatAnswers(request, answers), {
        sessionId: activeSessionId ?? undefined,
        model: selectedModelId,
        ...(activeSkills.length ? { skills: activeSkills } : {}),
        ...(activeSkills.includes("supabase-backend") && backend ? { backend } : {}),
      });
      setActiveSessionId(res.session_id);
    } catch (e) {
      setIsExecuting(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          role: "assistant",
          content: `⚠️ Could not send your answer: ${e instanceof Error ? e.message : String(e)}`,
          isError: true,
          createdAt: Date.now(),
        },
      ]);
    }
  };

  const handleRollback = async (checkpointId: string, description: string) => {
    if (restoringCheckpointId) return;
    const confirmed = await confirmAction(
      "Roll back the project?",
      `Every file goes back to how it was ${description}. A restore point is saved first, so you can undo this too.`,
      { destructive: true, confirmLabel: "Roll back" },
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
      const result = await deployProject(projectId, activeProjectName || "Retro app", deployProvider);

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
      notify(`Live on ${PROVIDER_LABEL[deployProvider]}`, result.url);
    } catch (e) {
      errorFeedback();
      notify("Could not deploy", e instanceof Error ? e.message : String(e));
    } finally {
      setDeploying(false);
    }
  };

  const handleSaveBackend = async () => {
    if (!isSupabaseUrl(backendUrl)) {
      notify("That is not a project URL", "It should look like https://abcdefgh.supabase.co with nothing after it.");
      return;
    }
    const kind = classifySupabaseKey(backendKey);
    if (kind === "service_role") {
      // The whole reason this check exists. The key ends up inside a page that
      // gets published, and a service role key there is the entire database.
      notify(
        "That is the secret key",
        "Paste the anon / publishable key instead. The secret key would end up inside the published page and give anyone full access to your database.",
      );
      return;
    }
    if (kind === "unknown") {
      notify("That key was not recognised", "Copy the anon (publishable) key from Supabase → Project Settings → API.");
      return;
    }

    const target = { url: backendUrl.trim(), anonKey: backendKey.trim() };
    await saveBackendTarget(target);
    setBackend(target);
    setBackendUrl("");
    setBackendKey("");
    setShowBackendModal(false);
    // Switching the skill on is the point of connecting, so it is done for them.
    setActiveSkills((prev) => (prev.includes("supabase-backend") ? prev : [...prev, "supabase-backend"]));
    successFeedback();
    notify("Supabase connected", "The Connect Supabase skill is on, so builds can use it now.");
  };

  const handleSaveToken = async () => {
    const label = PROVIDER_LABEL[deployProvider];
    const plausible = deployProvider === "vercel"
      ? looksLikeVercelToken(deployTokenInput)
      : looksLikeNetlifyToken(deployTokenInput);
    if (!plausible) {
      notify("That does not look like a token", `Paste the access token from ${label} — it has no spaces.`);
      return;
    }
    await saveDeployToken(deployProvider, deployTokenInput);
    // Cleared from state immediately: it does not need to sit in a React tree.
    setDeployTokenInput("");
    setConnected((prev) => ({ ...prev, [deployProvider]: true }));
    setShowDeployModal(false);
    successFeedback();
    notify(`${label} connected`, "Press Deploy again to publish this project.");
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
   * (or the error) and ends the run. Polling rather than Realtime because it
   * works against the local gateway too, where LOCAL_DEV_BYPASS means there is
   * no real JWT and so no RLS-visible rows for Realtime to push.
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

      // The plan, and the checklist as it stands *now*. todo_write is called
      // repeatedly and each call replaces the list, so only the last one is
      // shown — rendering every version would stack five checklists for a
      // five-item task.
      const plan = fresh
        .filter((t) => t.tool_input?.detail?.kind === "plan")
        .map((t) => String(t.tool_input!.detail!.plan ?? ""))
        .filter(Boolean)
        .at(-1);
      const todos = fresh
        .filter((t) => t.tool_input?.detail?.kind === "todos")
        .map((t) => t.tool_input!.detail!.todos as TodoItem[])
        .at(-1);

      const execId = `exec_${since ?? activeSessionId}`;
      setMessages((prev) => {
        const withoutExec = prev.filter((m) => m.id !== execId);
        if (steps.length === 0) return withoutExec;
        return [
          ...withoutExec,
          { id: execId, role: "assistant", content: "", createdAt: Date.now(), steps, plan, todos },
        ];
      });

      const runRow = [...fresh].reverse().find((t) => t.tool_name === "agent-run");
      if (runRow && (runRow.status === "success" || runRow.status === "failed")) {
        // Between one leg finishing and the next being claimed, this row is
        // still the newest one — without a guard its message would be appended
        // on every poll until the next leg starts.
        if (settledRunIdsRef.current.has(runRow.id)) return;
        settledRunIdsRef.current.add(runRow.id);
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
            // The agent asked rather than guessed. The message carries the
            // question so the card renders inline with the turn it belongs to,
            // and stays in the transcript once answered.
            pendingQuestion: (runRow.tool_output?.pending_question ?? null) as ClarifyRequest | null,
          },
        ]);
        // A big build does not fit in one turn. When the worker has already
        // queued the next leg, this turn ending is not the run ending — so the
        // spinner stays and the poller keeps watching, or the user would be
        // left staring at a half-built project with nothing happening.
        const continuing = runRow.status === "success" && runRow.tool_output?.continued === true;
        if (continuing) {
          // Deliberately not advancing runStartedAtRef: the next leg's own row
          // can appear before the next poll, and a moved cut-off would hide it
          // for good — a spinner that never stops. Leaving it means the steps
          // accumulate into one list, which is what the build actually is.
        } else {
          setIsExecuting(false);
          if (runRow.status === "success") successFeedback();
          else errorFeedback();
        }
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
    // A chat-only model does not follow you into Build.
    if (mode === "build" && isYoucom(selectedModelId)) setSelectedModelId(AUTO_MODEL.id);
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
  // The Profile tab is the settings screen; the chat no longer keeps a copy.
  const handleOpenProfileFromDrawer = () => {
    setShowDrawerModal(false);
    goTo("ProfileTab");
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
    // Every sheet this screen owns, not just the drawer. Leaving one open put
    // it over the screen we just navigated to — the Projects sheet in
    // particular, since its rows are how you reach the project screens.
    setShowDrawerModal(false);
    setShowProjectsModal(false);
    setShowAddToChatModal(false);
    setShowModelsModal(false);
    setShowFileModal(false);
    setShowCheckpointsModal(false);
    setShowSkillsModal(false);
    (navigation as unknown as { navigate: (n: string, p?: object) => void }).navigate(screen, params);
  };

  const goToProfile = (screen: string, params?: object) =>
    goTo("ProfileTab", { screen, params });

  const goToProject = (screen: string, params?: object) =>
    goTo("ProjectsTab", { screen, params });

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
      { destructive: true, confirmLabel: "Delete" },
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

  /**
   * The drawer's contents — account, projects, every chat. On a phone this is
   * a modal that slides over the conversation; on a wide screen it is the
   * left column, always there, and the button that opened it is gone.
   */
  const chatsPanel = (inline: boolean) => (
    <View style={{ flex: 1, backgroundColor: bgCanvas }}>
      <View className="flex-row items-center px-4" style={{ minHeight: 68 }}>
        {inline ? null : (
          <TouchableOpacity
            onPress={() => setShowDrawerModal(false)}
            accessibilityLabel="Close"
            accessibilityRole="button"
            style={[roundKey(40), { marginRight: 12 }]}
            activeOpacity={0.7}
          >
            <VectorIcon name="x" size={17} color={colors.inkPrimary} />
          </TouchableOpacity>
        )}
        {/* On the web the sidebar is the app's masthead, so it carries the
            wordmark; on a phone the drawer is a list and says so. */}
        {inline ? (
          <Text variant="h1" style={{ flex: 1, fontSize: 26, lineHeight: 30, letterSpacing: -1.2 }}>
            retro<Text variant="h1" style={{ fontSize: 26, lineHeight: 30, color: colors.brandPrimary }}>.</Text>
          </Text>
        ) : (
          <Text variant="h2" style={{ flex: 1 }}>Chats</Text>
        )}
        <TouchableOpacity
          onPress={() => setMode(isLight ? "darkest" : "light")}
          accessibilityRole="button"
          accessibilityLabel={isLight ? "Switch to dark" : "Switch to light"}
          style={[roundKey(40), { marginRight: 8 }]}
          activeOpacity={0.7}
        >
          <VectorIcon name={isLight ? "moon" : "sun"} size={16} color={colors.inkSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleNewChat}
          accessibilityRole="button"
          accessibilityLabel="New chat"
          style={[
            { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
            keyEdge(colors.brandEdge, 3),
          ]}
          activeOpacity={0.75}
        >
          <VectorIcon name="edit" size={16} color={colors.canvasBase} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="flex-row items-center px-3 mb-4"
          style={[{ backgroundColor: colors.surfaceCode, borderRadius: 14, minHeight: 46 }, wellShadow(mode)]}
        >
          <VectorIcon name="search" size={15} color={colors.inkMuted} style={{ marginRight: 8 }} />
          <TextInput
            value={drawerQuery}
            onChangeText={setDrawerQuery}
            placeholder="Search chats"
            placeholderTextColor={colors.inkMuted}
            className="flex-1 text-sm"
            style={{ color: colors.inkPrimary, outlineStyle: "none", outlineWidth: 0 } as any}
          />
          {drawerQuery.length > 0 && (
            <TouchableOpacity onPress={() => setDrawerQuery("")} className="p-1" accessibilityLabel="Clear search">
              <VectorIcon name="x" size={13} color={colors.inkSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <Card flush>
          <TouchableOpacity
            onPress={handleOpenProfileFromDrawer}
            accessibilityRole="button"
            accessibilityLabel={`Account: ${displayName}`}
            className="flex-row items-center px-3.5 py-3"
            style={{ borderBottomWidth: 1, borderBottomColor: colors.borderHairline }}
            activeOpacity={0.6}
          >
            <Monogram name={displayName} size={40} />
            <View className="flex-1 ml-3">
              <Text style={{ fontSize: 15, lineHeight: 20 }} className="font-medium" numberOfLines={1}>{displayName}</Text>
              {user?.email ? (
                <Text variant="label" numberOfLines={1} style={{ fontSize: 11, textTransform: "none" }}>{user.email}</Text>
              ) : null}
            </View>
            <VectorIcon name="chevron-right" size={16} color={colors.inkMuted} />
          </TouchableOpacity>
          <SettingsRow
            label="Projects"
            hint={projects.length ? `${projects.length} project${projects.length === 1 ? "" : "s"}` : undefined}
            icon="folder"
            onPress={handleOpenProjectsFromDrawer}
            last
          />
        </Card>

        {projects.length === 0 ? (
          <Text style={{ color: textSecondary }} className="text-xs text-center leading-5 py-10 px-4">
            No projects yet. Create one to start building.
          </Text>
        ) : (
          projects.map((project) => {
            const sessions = (drawerSessions[project.id] ?? []).filter((s) =>
              !drawerQuery.trim() ||
              (s.title ?? "").toLowerCase().includes(drawerQuery.trim().toLowerCase()),
            );
            return (
              <View key={project.id}>
                <TouchableOpacity
                  onPress={() => handleOpenProjectFolder(project.id, project.name)}
                  accessibilityRole="button"
                  className="flex-row items-center px-1 mt-6 mb-2"
                  activeOpacity={0.6}
                >
                  <VectorIcon name="folder" size={15} color={colors.inkSecondary} style={{ marginRight: 8 }} />
                  <Text
                    style={{ color: textPrimary, fontSize: 14, ...directionStyleFor(project.name) }}
                    className="font-medium flex-1"
                    numberOfLines={1}
                  >
                    {project.name}
                  </Text>
                  <VectorIcon name="chevron-right" size={14} color={colors.inkMuted} />
                </TouchableOpacity>
                <Card flush>
                  {sessions.length === 0 ? (
                    <Text style={{ color: textMuted }} className="text-xs px-4 py-3">
                      {drawerSessions[project.id] ? "No chats yet" : "Loading…"}
                    </Text>
                  ) : (
                    sessions.map((item, index) => (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => handleLoadSession(item, project)}
                        className="px-4 py-3"
                        style={{
                          borderBottomWidth: index === sessions.length - 1 ? 0 : 1,
                          borderBottomColor: colors.borderHairline,
                        }}
                        activeOpacity={0.6}
                      >
                        <View className="flex-row items-center">
                          {/* The chat you are in has its light on. */}
                          <Led on={item.id === activeSessionId} size={7} style={{ marginRight: 12 }} />
                          <Text
                            style={{ color: textPrimary, fontSize: 15, ...directionStyleFor(item.title) }}
                            className="flex-1 mr-2"
                            numberOfLines={1}
                          >
                            {item.title || "Untitled chat"}
                          </Text>
                          {/* Only failure is worth a badge: "active" is
                              every unfinished chat, so marking it marks
                              almost every row. */}
                          {item.status === "failed" ? (
                            <Pill tone="failed">failed</Pill>
                          ) : (
                            <Text variant="label" style={{ fontSize: 11, textTransform: "none" }}>
                              {relativeTime(item.updated_at ?? item.created_at)}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </Card>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  const isChatActive = messages.length > 0;
  const hasInputText = inputText.trim().length > 0;

  return (
    <SafeAreaView style={{ backgroundColor: bgCanvas }} className="flex-1 flex-row">
      {wide ? (
        <View style={{ width: SIDEBAR_WIDTH, borderRightWidth: 1, borderRightColor: colors.borderHairline }}>
          {chatsPanel(true)}
        </View>
      ) : null}

      <View className="flex-1">

      {/* =================================================================== */}
      {/* 1. TOP HEADER (LIGHT MODE & CLAUDE PARITY READY)                   */}
      {/* =================================================================== */}
      {!isChatActive ? (
        /* INITIAL HEADER STATE (Profile button, Segmented Chat/Build mode, Incognito Ghost) */
        <View style={{ backgroundColor: bgCanvas, zIndex: 50, elevation: 10 }} className="flex-row items-center justify-between px-4 py-3 z-50">

          {/* Profile Avatar / Drawer Trigger */}
          {wide ? (
            <View className="w-10" />
          ) : (
            <TouchableOpacity
              onPress={() => setShowDrawerModal(true)}
              style={roundKey()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Chats"
            >
              <VectorIcon name="menu" size={18} color={colors.inkPrimary} />
            </TouchableOpacity>
          )}

          {/* Chat asks the model directly; Build queues an agent run with tools. */}
          {isIncognito ? (
            <View className="flex-row items-center">
              <Led color={colors.incognito} size={6} style={{ marginRight: 8 }} />
              <Text variant="label" style={{ fontSize: 13, color: colors.incognito }}>incognito</Text>
            </View>
          ) : (
            <ModeSwitch mode={activeMode} onSelect={handleSelectMode} />
          )}

          {/* Top-right incognito toggle */}
          <TouchableOpacity
            onPress={handleToggleIncognito}
            style={[roundKey(), isIncognito ? { backgroundColor: colors.incognitoSoft } : null]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isIncognito ? "Turn incognito off" : "Incognito chat"}
          >
            <VectorIcon name="ghost" size={18} color={isIncognito ? colors.incognito : colors.inkSecondary} />
          </TouchableOpacity>

        </View>
      ) : (
        /* ACTIVE THREAD HEADER STATE */
        <View style={{ backgroundColor: bgCanvas, zIndex: 50, elevation: 10 }} className="flex-row items-center justify-between px-4 py-3 z-50">

          <View className="flex-row items-center flex-1 mr-2">
            {wide ? null : (
              <TouchableOpacity
                onPress={() => setShowDrawerModal(true)}
                style={[roundKey(40), { marginRight: 12 }]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Chats"
              >
                <VectorIcon name="menu" size={17} color={colors.inkPrimary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setShowDrawerModal(true)}
              className="flex-row items-center flex-1"
              activeOpacity={0.8}
            >
              {/* A thread's title is whatever the user asked, so it is Persian
                  as often as not. `text-left` truncated it from the wrong end. */}
              <View className="flex-1">
                <Text
                  style={{ color: textPrimary, fontSize: 15, lineHeight: 20, ...directionStyleFor(headerTitle) }}
                  className="font-medium"
                  numberOfLines={1}
                >
                  {headerTitle}
                </Text>
                <Text variant="label" numberOfLines={1} style={{ fontSize: 11, textTransform: "none" }}>
                  {isIncognito ? "incognito" : `${activeProjectName || "chat"} · ${activeMode}`}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={handleToggleIncognito}
              style={[roundKey(40), { marginRight: 8 }, isIncognito ? { backgroundColor: colors.incognitoSoft } : null]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={isIncognito ? "Turn incognito off" : "Incognito chat"}
            >
              <VectorIcon name="ghost" size={17} color={isIncognito ? colors.incognito : colors.inkSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNewChat}
              style={roundKey(40)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="New chat"
            >
              <VectorIcon name="edit" size={16} color={colors.inkPrimary} />
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
              <VectorIcon name="ghost" size={28} color={colors.inkMuted} style={{ marginBottom: 16 }} />

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
            <ScrollView className="flex-1 px-5 py-4" contentContainerStyle={{ paddingBottom: 160, ...columnStyle(wide, COLUMN_MAX) }} showsVerticalScrollIndicator={false}>
              {/* The project's name is the heading; the way to pick another
                  sits beside it. It was a card with a folder icon and a
                  sentence of instructions. */}
              <View className="flex-row items-center justify-between mb-4 px-1">
                <View className="flex-1 mr-3">
                  <Text
                    style={{ color: textPrimary, ...directionStyleFor(activeProjectName) }}
                    className="text-xl font-semibold"
                    numberOfLines={1}
                  >
                    {activeProjectName}
                  </Text>
                  <Text style={{ color: textMuted }} className="text-xs mt-0.5">
                    Pick a conversation, or type below to start one
                  </Text>
                </View>
                <Button
                  label="Change"
                  tone="neutral"
                  size="sm"
                  onPress={() => {
                    setActiveProjectName("");
                    setThreadTitle("");
                  }}
                />
              </View>

              {(activeProjectId ? drawerSessions[activeProjectId] ?? [] : []).length === 0 ? (
                <Text style={{ color: textSecondary }} className="text-xs text-center leading-5 py-8 px-4">
                  No conversations in this project yet. Type below to start one.
                </Text>
              ) : (
                <Card flush>
                  {(drawerSessions[activeProjectId!] ?? []).map((item, index, all) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() =>
                        handleLoadSession(item, { id: activeProjectId!, name: activeProjectName })
                      }
                      className="px-4 py-3"
                      style={{
                        borderBottomWidth: index === all.length - 1 ? 0 : 1,
                        borderBottomColor: colors.borderHairline,
                      }}
                      activeOpacity={0.6}
                    >
                      <Text
                        style={{ color: textPrimary, ...directionStyleFor(item.title) }}
                        className="text-sm"
                        numberOfLines={1}
                      >
                        {item.title || "Untitled chat"}
                      </Text>
                      <Text style={{ color: textMuted }} className="text-xs mt-0.5">
                        {relativeTime(item.updated_at ?? item.created_at)}
                        {item.token_usage_total ? ` · ${item.token_usage_total.toLocaleString("en-US")} tokens` : ""}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </Card>
              )}
            </ScrollView>
          ) : (
            /* PURE WHITE LIGHT MODE WATERMARK CANVAS */
            <View className="flex-1 items-center justify-center select-none px-4 pb-28">
              {/* A watermark, not a headline. It names which of the two modes
                  you are in — "retro" for chat, "retro build" for the agent —
                  and it is set one step off the canvas so it sits behind the
                  screen rather than on it. An empty screen's loudest element
                  should not be the app telling you its own name. */}
              {/* The logo, faint, over the name: the r lit only one step
                  above the resting dots, so it reads up close and disappears
                  from across the room. */}
              <View style={{ marginBottom: 18 }}>
                <MatrixMark size={86} dim={colors.surfaceMuted} ink={colors.surfaceStrong} accent={colors.surfaceStrong} />
              </View>
              <Text variant="h1" style={{ fontSize: 46, lineHeight: 50, letterSpacing: -2, color: colors.surfaceStrong }}>
                {activeMode === "build" ? "retro build" : "retro"}
              </Text>

              {/* Only the mode is worth saying, and only quietly — as the
                  legend under a control. */}
              <Text variant="label" style={{ marginTop: 12 }}>
                {activeMode === "build" ? "describe what to build" : "ask anything"}
              </Text>

              {activeMode === "build" ? (
                <View className="flex-row flex-wrap justify-center mt-7 px-2">
                  {STARTERS.map((starter) => (
                    <TouchableOpacity
                      key={starter.label}
                      onPress={() => { selectionFeedback(); handleInputChange(starter.prompt); }}
                      style={[{ backgroundColor: colors.surfaceRaised, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginRight: 6, marginBottom: 8 }, keyEdge(colors.capEdge)]}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: textSecondary, fontSize: 13 }}>{starter.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          )
        ) : (
          /* ACTIVE STREAM CONVERSATION MESSAGES */
          <ScrollView
            ref={scrollViewRef}
            className="flex-1 px-4 py-3"
            contentContainerStyle={{ paddingBottom: 160, ...columnStyle(wide, COLUMN_MAX) }}
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
                    <View style={{ backgroundColor: colors.bubbleUser, borderBottomRightRadius: 6 }} className="max-w-[88%] px-4 py-2.5 rounded-2xl">
                      {/* Direction from the text itself. `text-left` here was
                          left-aligning Persian, so a user's own message ran the
                          opposite way to the answer below it. */}
                      <Text
                        style={{ color: textPrimary, ...directionStyleFor(msg.content) }}
                        className="text-sm leading-6"
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
                            <Text style={{ color: textMuted }} className="text-[11px]">
                              Branch from here
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
                  {/* What the agent decided to do, and how far through it is.
                      Above the tool log because it is the summary the log is
                      the detail of. */}
                  {msg.plan ? <PlanCard plan={msg.plan} /> : null}
                  {msg.todos?.length ? <TodoChecklist todos={msg.todos} /> : null}

                  {/* Terminal-style execution log: one panel per agent turn */}
                  {/* animate follows the same rule as the text reveal: only a
                      run that arrived while mounted. Scrolling back through an
                      old conversation must not replay it. */}
                  <RunLog steps={toolRunSteps} isLight={isLight} animate={msg.animate === true} />

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
                    <View className="mt-3">
                      {/* One row that says the app is ready to look at. It was
                          two loud chips — green "Preview App", bordered "Undo". */}
                      <TouchableOpacity
                        onPress={() => setShowPreviewModal(true)}
                        style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline, borderWidth: 1, borderRadius: 20, paddingVertical: 10, paddingLeft: 16, paddingRight: 10 }}
                        className="flex-row items-center"
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel="Preview ready. Open the app"
                      >
                        <Led color={colors.success} size={8} style={{ marginRight: 12 }} />
                        <View className="flex-1">
                          <Text style={{ color: textPrimary, fontSize: 14 }} className="font-medium">Preview ready</Text>
                          <Text variant="label" style={{ fontSize: 11, textTransform: "none" }}>
                            {activeProjectName ? `${activeProjectName} · live` : "live"}
                          </Text>
                        </View>
                        <View style={[{ backgroundColor: colors.brandPrimary, borderRadius: 999, paddingHorizontal: 18, height: 38, justifyContent: "center" }, keyEdge(colors.brandEdge, 3)]}>
                          <Text style={{ color: colors.canvasBase, fontSize: 14 }} className="font-semibold">Open</Text>
                        </View>
                      </TouchableOpacity>

                      {/* Undo this turn — the worker snapshotted the project
                          right before it ran, so this restores that exact state. */}
                      {msg.checkpointId && (
                        <TouchableOpacity
                          onPress={() => handleRollback(msg.checkpointId, "before this change")}
                          disabled={restoringCheckpointId !== null || isExecuting}
                          className="flex-row items-center mt-2 px-1 py-1"
                          activeOpacity={0.6}
                        >
                          {restoringCheckpointId === msg.checkpointId ? (
                            <ActivityIndicator size="small" color={textSecondary} />
                          ) : (
                            <>
                              <Text variant="label" style={{ textTransform: "none" }}>restore point saved · </Text>
                              <Text variant="label" style={{ textTransform: "none", color: colors.brandPrimary }}>undo this change</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* The agent asked instead of guessing. Answering starts the
                      next turn on this same session, so the run continues with
                      the answers in its transcript. */}
                  {msg.pendingQuestion && (
                    <ClarifyCard
                      request={msg.pendingQuestion}
                      answers={msg.clarifyAnswers}
                      onSubmit={(answers) => handleClarifyAnswers(msg.id, msg.pendingQuestion!, answers)}
                    />
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
        <View className="absolute bottom-3 left-3 right-3 items-center" style={{ pointerEvents: "box-none" }}>
        <View
          style={{
            backgroundColor: bgCard,
            borderColor: colors.borderHairline,
            width: "100%",
            ...(wide ? { maxWidth: COLUMN_MAX } : {}),
            borderRadius: 26,
            paddingTop: 16,
            paddingHorizontal: 14,
            paddingBottom: 12,
          }}
          className="border"
        >

          {/* '@' FILE PICKER — real files from the active project */}
          {showMentionsPopup && (
            <View style={{ backgroundColor: colors.surfaceMuted }} className="mb-2 p-2 rounded-2xl max-h-56">
              <Text style={{ color: textMuted }} className="text-[11px] px-2 py-1">
                Attach a project file
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
                      <VectorIcon name="file-text" size={14} color={colors.inkSecondary} style={{ marginRight: 8 }} />
                      <Text style={{ color: textPrimary }} numberOfLines={1} className="text-xs font-mono flex-1 text-left">
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
            <View style={{ backgroundColor: colors.surfaceMuted }} className="mb-2 p-2 rounded-2xl">
              <Text style={{ color: textMuted }} className="text-[11px] px-2 py-1">Prompt shortcuts</Text>
              {SLASH_COMMANDS.map((item) => (
                <TouchableOpacity
                  key={item.cmd}
                  onPress={() => handleSelectSlashCommand(item.cmd)}
                  style={{ backgroundColor: colors.surfaceRaised }}
                  className="flex-row items-center p-2 rounded-xl active:opacity-80 my-0.5"
                >
                  <VectorIcon name={item.icon} size={14} color={colors.inkSecondary} style={{ marginRight: 8 }} />
                  <Text style={{ color: textPrimary }} className="text-xs font-mono mr-2">{item.cmd}</Text>
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
            placeholder={isIncognito ? "Ask in Incognito — nothing is saved…" : (activeMode === "build" ? "Ask or build… (Type @ for files, / for commands)" : "Ask anything…")}
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
                style={[{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center", marginRight: 8 }, keyEdge(colors.capEdge)]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Project actions"
              >
                <VectorIcon name="plus" size={18} color={colors.inkPrimary} />
              </TouchableOpacity>

              {/* Model & Thinking Switcher Pill */}
              <TouchableOpacity
                onPress={() => setShowModelsModal(true)}
                style={[{ height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.surfaceMuted, flexDirection: "row", alignItems: "center" }, keyEdge(colors.capEdge)]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Model: ${activeModelObj.name}`}
              >
                <Text variant="label" style={{ fontSize: 11, marginRight: 8 }}>model</Text>
                <Text style={{ color: textPrimary, fontSize: 14 }} className="font-medium mr-1.5">
                  {activeModelObj.name}
                </Text>
                <VectorIcon name="chevron-down" size={12} color={colors.inkSecondary} />
              </TouchableOpacity>

            </View>

            <View className="flex-row items-center">

              {isIncognito && (
                <View className="flex-row items-center mr-3">
                  <Led color={colors.incognito} size={6} style={{ marginRight: 6 }} />
                  <Text variant="label" style={{ fontSize: 11, color: colors.incognito }}>incognito</Text>
                </View>
              )}

              {/* Send Button (Dark circle) */}
              {/* `handleSend` also refuses while a run is in progress, and the
                  button used to stay brand-coloured and fully tappable through
                  all of it — pressing did nothing, with no explanation. Whatever
                  stops the press has to be visible in the button. */}
              {isExecuting ? (
                <Text variant="label" style={{ fontSize: 11, marginRight: 10 }}>{isAsking ? "thinking" : "building"}</Text>
              ) : null}
              <TouchableOpacity
                onPress={() => void handleSend()}
                disabled={!hasInputText || isExecuting}
                accessibilityRole="button"
                accessibilityLabel="Send"
                accessibilityState={{ disabled: !hasInputText || isExecuting }}
                style={[
                  {
                    backgroundColor: hasInputText && !isExecuting ? colors.brandPrimary : colors.surfaceMuted,
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  // The send key is the one lit key: raised in the signal colour
                  // when there is something to send, flat and dark when not.
                  hasInputText && !isExecuting ? keyEdge(colors.brandEdge, 3) : null,
                ]}
                activeOpacity={0.8}
              >
                <VectorIcon
                  name="arrow-up"
                  size={18}
                  color={hasInputText && !isExecuting ? colors.canvasBase : colors.inkMuted}
                />
              </TouchableOpacity>

            </View>
          </View>
        </View>
        </View>
      </View>
      </View>

      <Sheet
        visible={showAddToChatModal}
        onClose={() => setShowAddToChatModal(false)}
        title={activeProjectName || "Project"}
        subtitle="Files, preview, restore points"
      >
        {/* Ways into the project from the composer. Rows in one group rather
            than a 2x2 grid of tiles — the same shape as every list in the app. */}
        <Card flush>
          {([
            { key: "files", label: "Files", icon: "file-text", hint: undefined, run: () => setShowFileModal(true) },
            { key: "preview", label: "Preview", icon: "eye", hint: undefined, run: () => setShowPreviewModal(true) },
            { key: "restore", label: "Restore points", icon: "rotate-ccw", hint: "Saved before every run that changes files", run: () => setShowCheckpointsModal(true) },
            { key: "export", label: exporting ? "Preparing the zip…" : "Download as zip", icon: "download", hint: undefined, run: () => void handleExport() },
            {
              key: "skills",
              label: "Skills",
              icon: "sparkles",
              hint: activeSkills.length ? `${activeSkills.length} on` : undefined,
              run: () => setShowSkillsModal(true),
            },
          ] as const).map((action, index, all) => (
            <SettingsRow
              key={action.key}
              label={action.label}
              icon={action.icon}
              hint={action.hint}
              last={index === all.length - 1}
              onPress={() => {
                if (action.key === "export" && exporting) return;
                setShowAddToChatModal(false);
                action.run();
              }}
            />
          ))}
        </Card>
      </Sheet>

      {/* Chats — on a phone. On a wide screen the same panel is the sidebar. */}
      <Modal
        visible={showDrawerModal && !wide}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowDrawerModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: bgCanvas }}>{chatsPanel(false)}</SafeAreaView>
      </Modal>

      {/* Projects — the list, a way to make one, and the ways into each. */}
      <Sheet
        visible={showProjectsModal}
        onClose={() => setShowProjectsModal(false)}
        title="Projects"
        subtitle={projects.length ? `${projects.length} project${projects.length === 1 ? "" : "s"}` : undefined}
        height={0.85}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          <View className="flex-row mb-4">
            <Button label="New project" icon="plus" size="sm" onPress={() => setShowNewProjectModal(true)} />
            <View style={{ width: 8 }} />
            <Button
              label="Search"
              icon="search"
              tone="neutral"
              size="sm"
              onPress={() => {
                setShowProjectsModal(false);
                goTo("GlobalSearch");
              }}
            />
          </View>

          {projects.length === 0 ? (
            <Text style={{ color: textSecondary }} className="text-xs text-center leading-5 py-10 px-4">
              No projects yet. Make one above.
            </Text>
          ) : (
            projects.map((proj) => (
              <Card key={proj.id} className="mb-3">
                <TouchableOpacity
                  onPress={() => {
                    setShowProjectsModal(false);
                    handleOpenProjectFolder(proj.id, proj.name);
                  }}
                  activeOpacity={0.6}
                >
                  <View className="flex-row items-center">
                    <Text
                      style={{ color: textPrimary, ...directionStyleFor(proj.name) }}
                      className="text-base font-medium flex-1 mr-2"
                      numberOfLines={1}
                    >
                      {proj.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteProjectFromSheet(proj.id, proj.name)}
                      accessibilityLabel={`Delete ${proj.name}`}
                      className="w-8 h-8 rounded-full items-center justify-center"
                      activeOpacity={0.6}
                    >
                      <VectorIcon name="trash" size={14} color={colors.inkMuted} />
                    </TouchableOpacity>
                  </View>
                  {proj.description ? (
                    <Text style={{ color: textSecondary }} className="text-xs mt-1 leading-5" numberOfLines={2}>
                      {proj.description}
                    </Text>
                  ) : null}
                  <Text style={{ color: textMuted }} className="text-xs mt-1">
                    Created {relativeTime(proj.created_at)}
                  </Text>
                </TouchableOpacity>

                {/* Entry points into the project screens */}
                <View className="flex-row flex-wrap mt-3">
                  {([
                    { label: "Details", target: "ProjectDetail" },
                    { label: "Files", target: "FileTree" },
                    { label: "History", target: "SessionHistory" },
                    { label: "Restore points", target: "CheckpointList" },
                    { label: "Settings", target: "ProjectSettings" },
                  ] as const).map((entry) => (
                    <Button
                      key={entry.target}
                      label={entry.label}
                      tone="neutral"
                      size="sm"
                      className="mr-1.5 mb-1.5"
                      onPress={() => goToProject(entry.target, { projectId: proj.id })}
                    />
                  ))}
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      </Sheet>

      {/* New project. A centred dialog: one field, a template, one button. */}
      <Modal
        visible={showNewProjectModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowNewProjectModal(false)}
      >
        <View className="flex-1 justify-center items-center px-6" style={{ backgroundColor: colors.scrim }}>
          <View
            className="rounded-sheet p-5"
            style={{ backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderHairline, width: "100%", maxWidth: 480 }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: colors.inkPrimary }} className="text-lg font-semibold">New project</Text>
              <TouchableOpacity
                onPress={() => setShowNewProjectModal(false)}
                accessibilityLabel="Close"
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.surfaceMuted }}
                activeOpacity={0.6}
              >
                <VectorIcon name="x" size={14} color={colors.inkSecondary} />
              </TouchableOpacity>
            </View>

            <Input
              label="Name"
              value={newProjectName}
              onChangeText={setNewProjectName}
              placeholder="e.g. Portfolio"
              autoCapitalize="sentences"
              autoFocus
            />

            <Text variant="label" className="mb-2">Start from</Text>
            <View className="flex-row flex-wrap mb-3">
              {PROJECT_TEMPLATE_CHOICES.map((t) => {
                const on = newProjectTemplate === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => { selectionFeedback(); setNewProjectTemplate(t.id); }}
                    className="px-3 py-1.5 rounded-full mr-1.5 mb-1.5"
                    style={{ backgroundColor: on ? colors.inkPrimary : colors.surfaceMuted }}
                    activeOpacity={0.7}
                  >
                    <Text className="text-xs font-medium" style={{ color: on ? colors.canvasBase : colors.inkSecondary }}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Button label="Create" block loading={isCreatingProject} onPress={handleCreateNewProject} />
          </View>
        </View>
      </Modal>

      {/* Connect Supabase — the user's own backend for sign-in and saved data. */}
      <Sheet
        visible={showBackendModal}
        onClose={() => setShowBackendModal(false)}
        title="Connect Supabase"
        subtitle="Your own backend for sign-in and saved data"
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
          {/* The warning that matters. The anon key is meant to be public; the
              secret key inside a published page is the whole database. */}
          <View className="p-3 rounded-card mb-4" style={{ backgroundColor: colors.warningSoft }}>
            <Text style={{ color: colors.warning }} className="text-xs font-medium mb-1">Use the anon key, never the secret one</Text>
            <Text style={{ color: textSecondary }} className="text-xs leading-5">
              The anon key is designed to be public and ends up inside the page you publish. A service role
              key there would hand anyone full access to your database — this screen refuses one if you paste it.
            </Text>
          </View>

          <Input
            label="Project URL"
            value={backendUrl}
            onChangeText={setBackendUrl}
            placeholder="https://abcdefgh.supabase.co"
            keyboardType="url"
          />
          <Input
            label="Anon / publishable key"
            hint="Supabase → Project Settings → API. Both values are on that page."
            value={backendKey}
            onChangeText={setBackendKey}
            placeholder="sb_publishable_… or eyJ…"
          />

          <Button label="Connect" block onPress={() => void handleSaveBackend()} />

          {backend && (
            <Button
              label="Remove the saved project"
              tone="ghost"
              block
              className="mt-2"
              onPress={async () => {
                await forgetBackendTarget();
                setBackend(null);
                notify("Supabase disconnected", "The project has been removed from this device.");
              }}
            />
          )}
        </ScrollView>
      </Sheet>

      {/* Publish — a token from the user's own hosting account. */}
      <Sheet
        visible={showDeployModal}
        onClose={() => setShowDeployModal(false)}
        title={`Publish to ${PROVIDER_LABEL[deployProvider]}`}
        subtitle="Free static hosting on your own account"
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
          {/* Both hosts, so the choice is visible rather than a setting to find. */}
          <View className="flex-row mb-4">
            {(["netlify", "vercel"] as const).map((option) => {
              const active = deployProvider === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => { selectionFeedback(); setDeployProvider(option); setDeployTokenInput(""); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  className="flex-1 p-3 rounded-card mr-2"
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: active ? colors.brandPrimary : colors.borderHairline,
                  }}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center justify-between">
                    <Text style={{ color: textPrimary }} className="text-sm font-medium">{PROVIDER_LABEL[option]}</Text>
                    {connected[option] ? <Pill tone="success">Connected</Pill> : null}
                  </View>
                  <Text style={{ color: textMuted }} className="text-[11px] mt-1 leading-4">
                    {option === "netlify" ? "Whole archive, images included" : "Text files only, no images"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Said plainly rather than implied. The token is a credential for
              their account and they are entitled to know where it lives. */}
          <Text style={{ color: textSecondary }} className="text-xs leading-5 mb-4">
            Paste an access token from your own {PROVIDER_LABEL[deployProvider]} account. It is stored{" "}
            {tokenStorageIsSecure()
              ? "in this device's secure keystore"
              : "in this browser's local storage, which any script on this page could read"}
            , sent only to {PROVIDER_LABEL[deployProvider]}, and never reaches our servers.
          </Text>

          <Input
            label={`${PROVIDER_LABEL[deployProvider]} access token`}
            hint={deployProvider === "vercel"
              ? "Vercel → Account Settings → Tokens → Create Token"
              : "Netlify → User settings → Applications → Personal access tokens"}
            value={deployTokenInput}
            onChangeText={setDeployTokenInput}
            placeholder={deployProvider === "vercel" ? "Vercel token" : "nfp_…"}
            secureTextEntry
          />

          <Button label="Connect" block onPress={() => void handleSaveToken()} />

          {connected[deployProvider] && (
            <Button
              label="Remove the saved token"
              tone="ghost"
              block
              className="mt-2"
              onPress={async () => {
                await forgetDeployToken(deployProvider);
                setConnected((prev) => ({ ...prev, [deployProvider]: false }));
                setDeployedUrl(null);
                notify(
                  `${PROVIDER_LABEL[deployProvider]} disconnected`,
                  "The token has been removed from this device.",
                );
              }}
            />
          )}
        </ScrollView>
      </Sheet>

      {/* Skills — extra instructions, on or off. Rows with a tick, not cards
          with a two-pixel brand border. */}
      <Sheet
        visible={showSkillsModal}
        onClose={() => setShowSkillsModal(false)}
        title="Skills"
        subtitle="Extra instructions, sent only while switched on"
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
          <Card flush>
            {SKILLS.map((skill, index) => {
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
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  className="flex-row items-center px-4 py-3"
                  style={{
                    borderBottomWidth: index === SKILLS.length - 1 ? 0 : 1,
                    borderBottomColor: colors.borderHairline,
                  }}
                  activeOpacity={0.6}
                >
                  <VectorIcon
                    name={skill.icon}
                    size={18}
                    color={on ? colors.brandPrimary : colors.inkSecondary}
                    style={{ marginRight: 14 }}
                  />
                  <View className="flex-1 mr-3">
                    <Text style={{ color: textPrimary }} className="text-sm">{skill.name}</Text>
                    <Text style={{ color: textMuted }} className="text-xs mt-0.5 leading-4">{skill.description}</Text>
                  </View>
                  {/* A tick, not a switch: the whole row is the target, and a
                      switch beside a pressable row invites two different taps. */}
                  <View
                    className="w-[22px] h-[22px] rounded-md items-center justify-center"
                    style={{
                      backgroundColor: on ? colors.brandPrimary : "transparent",
                      borderWidth: 1.5,
                      borderColor: on ? colors.brandPrimary : colors.inkMuted,
                    }}
                  >
                    {on ? <VectorIcon name="check" size={13} color={colors.canvasBase} /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </Card>

          {/* Shown where the Supabase skill is switched on, because that is the
              moment it becomes relevant that a project is needed. */}
          {activeSkills.includes("supabase-backend") && (
            <Card flush className="mt-3">
              <SettingsRow
                label={backend ? "Supabase project connected" : "No Supabase project connected"}
                hint={backend ? backend.url : "Add your project URL and anon key"}
                icon={backend ? "check" : "alert"}
                onPress={() => setShowBackendModal(true)}
                last
              />
            </Card>
          )}

          {activeSkills.length > 0 && (
            <Button label="Turn all off" tone="ghost" size="sm" className="mt-3" onPress={() => setActiveSkills([])} />
          )}
        </ScrollView>
      </Sheet>

      {/* Preview — the built app, full screen. The header holds the three
          things you do with it: share, deploy, refresh. */}
      <Modal
        visible={showPreviewModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvasBase }}>
          <View
            className="flex-row items-center px-3"
            style={{ height: 56, borderBottomWidth: 1, borderBottomColor: colors.borderHairline }}
          >
            <TouchableOpacity
              onPress={() => setShowPreviewModal(false)}
              accessibilityLabel="Close"
              accessibilityRole="button"
              className="w-10 h-10 items-center justify-center mr-1"
              activeOpacity={0.6}
            >
              <VectorIcon name="x" size={20} color={colors.inkPrimary} />
            </TouchableOpacity>
            <View className="flex-1">
              <Text style={{ color: colors.inkPrimary }} className="text-base font-semibold" numberOfLines={1}>Preview</Text>
              {activeProjectName ? (
                <Text style={{ color: colors.inkMuted, ...directionStyleFor(activeProjectName) }} className="text-[11px]" numberOfLines={1}>
                  {activeProjectName}
                </Text>
              ) : null}
            </View>

            {/* Share what is on screen. Placed here rather than in the chat so
                "what you see is what you share" is literally true — this
                publishes the document the surface below is rendering. */}
            <TouchableOpacity
              onPress={handleShareApp}
              disabled={publishing || previewLoading || !previewHtml}
              accessibilityLabel={publishedUrl ? "Copy link" : "Share"}
              className="w-10 h-10 rounded-full items-center justify-center mr-1.5"
              style={{ backgroundColor: colors.surfaceMuted, opacity: previewHtml && !previewLoading ? 1 : 0.4 }}
              activeOpacity={0.6}
            >
              {publishing ? (
                <ActivityIndicator size="small" color={colors.inkPrimary} />
              ) : (
                <VectorIcon name={publishedUrl ? "link" : "share-2"} size={16} color={colors.inkPrimary} />
              )}
            </TouchableOpacity>

            {/* Not gated on previewLoading. Deploy publishes the project's files,
                not the previewed document — so a preview that is slow or stuck has
                nothing to do with whether the project can ship. */}
            <TouchableOpacity
              onPress={handleDeploy}
              disabled={deploying}
              accessibilityLabel={deployedUrl ? "Open site" : "Deploy"}
              className="w-10 h-10 rounded-full items-center justify-center mr-1.5"
              style={{ backgroundColor: colors.surfaceMuted, opacity: deploying ? 0.5 : 1 }}
              activeOpacity={0.6}
            >
              {deploying ? (
                <ActivityIndicator size="small" color={colors.inkPrimary} />
              ) : (
                <VectorIcon name={deployedUrl ? "globe" : "cloud"} size={16} color={colors.inkPrimary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={loadPreview}
              accessibilityLabel="Refresh"
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.surfaceMuted }}
              activeOpacity={0.6}
            >
              <VectorIcon name="rotate-ccw" size={16} color={colors.inkPrimary} />
            </TouchableOpacity>
          </View>

          {/* No frame, no padding, no fake window buttons: the real app gets the
              whole surface. */}
          <View style={{ backgroundColor: colors.canvasBase }} className="flex-1">
            {previewLoading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="small" color={colors.inkMuted} />
                <Text style={{ color: colors.inkSecondary }} className="text-xs mt-4">Building the preview…</Text>
              </View>
            ) : previewError ? (
              <View className="flex-1 items-center justify-center px-6">
                <Text style={{ color: colors.inkPrimary }} className="text-sm font-medium mb-2">Preview failed</Text>
                <Text style={{ color: colors.inkSecondary }} className="text-xs text-center leading-5">{previewError}</Text>
              </View>
            ) : previewHtml ? (
              <PreviewSurface html={previewHtml} />
            ) : (
              <View className="flex-1 items-center justify-center px-6">
                <Text style={{ color: colors.inkSecondary }} className="text-xs text-center leading-5">
                  Nothing to preview yet — ask the agent to build something.
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Restore points — how the project looked before each run. */}
      <Sheet
        visible={showCheckpointsModal}
        onClose={() => setShowCheckpointsModal(false)}
        title="Restore points"
        subtitle="One is saved before every run that can change files"
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
          {checkpointsLoading ? (
            <ActivityIndicator size="small" color={colors.inkMuted} style={{ marginVertical: 24 }} />
          ) : checkpoints.length === 0 ? (
            <View className="py-4">
              <Text style={{ color: colors.inkSecondary }} className="text-xs text-center leading-5 mb-4 px-4">
                Nothing saved yet. Ask the agent to build something and one appears here — or save one now.
              </Text>
              {saveRestorePointButton}
            </View>
          ) : (
            <>
              <Text style={{ color: colors.inkMuted }} className="text-xs leading-5 mb-3 px-1">
                Rolling back saves a restore point first, so it can be undone too.
              </Text>
              {saveRestorePointButton}
              <Card flush>
                {checkpoints.map((cp, index) => (
                  <View
                    key={cp.id}
                    className="flex-row items-center px-4 py-3"
                    style={{
                      borderBottomWidth: index === checkpoints.length - 1 ? 0 : 1,
                      borderBottomColor: colors.borderHairline,
                    }}
                  >
                    <View className="flex-1 mr-3">
                      <Text style={{ color: colors.inkPrimary }} className="text-sm" numberOfLines={1}>
                        {cp.session_title ? `Before “${cp.session_title}”` : "Restore point"}
                      </Text>
                      <Text style={{ color: colors.inkMuted }} className="text-xs mt-0.5">
                        {relativeTime(cp.created_at)} · {cp.id.slice(0, 7)}
                      </Text>
                    </View>
                    <Button
                      label="Restore"
                      tone="neutral"
                      size="sm"
                      loading={restoringCheckpointId === cp.id}
                      disabled={restoringCheckpointId !== null || isExecuting}
                      onPress={() => handleRollback(cp.id, `on ${relativeTime(cp.created_at)}`)}
                    />
                  </View>
                ))}
              </Card>
            </>
          )}
        </ScrollView>
      </Sheet>

      {/* Model — one group of rows, the chosen one ticked. */}
      <Sheet
        visible={showModelsModal}
        onClose={() => setShowModelsModal(false)}
        title="Model"
        subtitle={activeMode === "build" ? "Used for every build in this chat" : "Used for every answer in this chat"}
        height={0.55}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
          <Card flush>
            {modeModels.map((model, index) => {
              const isSelected = selectedModelId === model.id;
              return (
                <TouchableOpacity
                  key={model.id}
                  // A locked model goes to the payment screen instead of being
                  // selected. Selecting it would only produce a refused run.
                  onPress={() => {
                    if (model.locked) {
                      track("model_locked_tapped", { required_tier: model.minTier ?? "unknown" });
                      setShowModelsModal(false);
                      if (!canBuy) {
                        // Naming the plan is allowed; tapping through to buy
                        // it is the link-out. So say which plan it needs and
                        // leave the user to it.
                        notify(
                          `${model.name} needs ${model.badge.toLowerCase()}`,
                          "Paid plans are managed from your account on the Retro Code website.",
                        );
                        return;
                      }
                      navigation.getParent()?.navigate("Paywall", {
                        lockedModel: model.name,
                        requiredTier: model.minTier ?? undefined,
                      });
                      return;
                    }
                    selectionFeedback();
                    setSelectedModelId(model.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  activeOpacity={0.6}
                  className="flex-row items-center px-4 py-3"
                  style={{
                    borderBottomWidth: index === modeModels.length - 1 ? 0 : 1,
                    borderBottomColor: colors.borderHairline,
                    opacity: model.locked ? 0.6 : 1,
                  }}
                >
                  <VectorIcon
                    name={model.locked ? "lock" : model.icon}
                    size={18}
                    color={model.locked ? colors.inkMuted : colors[model.tone]}
                    style={{ marginRight: 14 }}
                  />
                  <View className="flex-1 mr-3">
                    <View className="flex-row items-center">
                      <Text
                        style={{ color: model.locked ? textSecondary : textPrimary }}
                        className="text-sm mr-2"
                        numberOfLines={1}
                      >
                        {model.name}
                      </Text>
                      {/* No badge at all when nothing is for sale — see
                          decorateModels, which leaves it empty. */}
                      {model.badge ? <Pill tone={model.minTier ? "warning" : "success"}>{model.badge}</Pill> : null}
                      {model.isDefault && !chatSearches ? <View style={{ width: 4 }} /> : null}
                      {model.isDefault && !chatSearches ? <Pill tone="muted">Default</Pill> : null}
                    </View>
                    <Text style={{ color: textMuted }} className="text-xs mt-0.5" numberOfLines={1}>
                      {chatSearches && model.id === AUTO_MODEL.id ? "Searches the web and cites sources" : model.description}
                    </Text>
                  </View>
                  {isSelected && !model.locked ? (
                    <VectorIcon name="check" size={18} color={colors.brandPrimary} />
                  ) : null}
                  {model.locked ? (
                    <Text style={{ color: colors.warning }} className="text-xs font-medium">Upgrade</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </Card>
        </ScrollView>
      </Sheet>

      {/* Files — the project's tree, indented by depth. */}
      <Sheet
        visible={showFileModal}
        onClose={() => setShowFileModal(false)}
        title="Files"
        subtitle={fileEntries.length ? `${fileEntries.length} file${fileEntries.length === 1 ? "" : "s"}` : undefined}
        height={0.75}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
          {filesLoading ? (
            <ActivityIndicator size="small" color={colors.inkMuted} style={{ marginVertical: 24 }} />
          ) : fileEntries.length === 0 ? (
            <Text style={{ color: colors.inkSecondary }} className="text-xs text-center leading-5 py-8 px-4">
              {filesError ?? "No files yet — ask the agent to build something and they will appear here."}
            </Text>
          ) : (
            <Card flush>
              {fileEntries.map((entry, index) => (
                <View
                  key={entry.path}
                  className="flex-row items-center py-2.5 pr-4"
                  style={{
                    paddingLeft: 16 + entry.depth * 14,
                    borderBottomWidth: index === fileEntries.length - 1 ? 0 : 1,
                    borderBottomColor: colors.borderHairline,
                  }}
                >
                  <VectorIcon name="file-text" size={14} color={colors.inkSecondary} style={{ marginRight: 10 }} />
                  <Text style={{ color: colors.inkPrimary }} numberOfLines={1} className="text-xs font-mono flex-1">
                    {entry.path}
                  </Text>
                  <Text style={{ color: colors.inkMuted }} className="text-[11px] ml-2">{entry.sizeLabel}</Text>
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      </Sheet>

    </SafeAreaView>
  );
};

