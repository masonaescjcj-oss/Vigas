/**
 * supabase/types.ts
 * ---------------------------------------------------------------------------
 * Hand-written database types to start from. Once the migrations are applied,
 * regenerate the canonical version with:
 *
 *   supabase gen types typescript --local > src/core/agent/db.types.ts
 *
 * The shape below matches what supabase-js expects (Database["public"]...), so
 * `createClient<Database>(url, key)` is fully typed today.
 * ---------------------------------------------------------------------------
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type SubscriptionTier = "free" | "pro" | "team";
export type SessionStatus = "active" | "paused" | "completed" | "failed" | "error" | "archived";
export type TaskStatus = "pending" | "running" | "success" | "failed";
export type SubscriptionStatus = "active" | "canceled" | "expired" | "grace_period";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          subscription_tier: SubscriptionTier;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          subscription_tier?: SubscriptionTier;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [{ foreignKeyName: "profiles_id_fkey"; columns: ["id"]; referencedRelation: "users"; referencedColumns: ["id"] }];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          sandbox_path: string;
          last_opened_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          sandbox_path: string;
          last_opened_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
        Relationships: [{ foreignKeyName: "projects_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      agent_sessions: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          status: SessionStatus;
          model_provider: string;
          token_usage_total: number;
          title: string | null;
          parent_id: string | null;
          forked_from_index: number | null;
          profile: string;
          usage: Json;
          transcript: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          status?: SessionStatus;
          model_provider?: string;
          token_usage_total?: number;
          title?: string | null;
          parent_id?: string | null;
          forked_from_index?: number | null;
          profile?: string;
          usage?: Json;
          transcript?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["agent_sessions"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "agent_sessions_project_id_fkey"; columns: ["project_id"]; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "agent_sessions_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      agent_tasks: {
        Row: {
          id: string;
          session_id: string;
          tool_name: string;
          tool_input: Json;
          tool_output: Json | null;
          status: TaskStatus;
          duration_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          tool_name: string;
          tool_input?: Json;
          tool_output?: Json | null;
          status?: TaskStatus;
          duration_ms?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["agent_tasks"]["Insert"]>;
        Relationships: [{ foreignKeyName: "agent_tasks_session_id_fkey"; columns: ["session_id"]; referencedRelation: "agent_sessions"; referencedColumns: ["id"] }];
      };
      checkpoints: {
        Row: {
          id: string;
          project_id: string;
          session_id: string | null;
          snapshot_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          session_id?: string | null;
          snapshot_path: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["checkpoints"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "checkpoints_project_id_fkey"; columns: ["project_id"]; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "checkpoints_session_id_fkey"; columns: ["session_id"]; referencedRelation: "agent_sessions"; referencedColumns: ["id"] },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          revenuecat_customer_id: string | null;
          plan_id: string | null;
          status: SubscriptionStatus;
          current_period_end: string | null;
          grace_expires_at: string | null;
          last_event_at: string | null;
          last_event_id: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          revenuecat_customer_id?: string | null;
          plan_id?: string | null;
          status?: SubscriptionStatus;
          current_period_end?: string | null;
          grace_expires_at?: string | null;
          last_event_at?: string | null;
          last_event_id?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
        Relationships: [{ foreignKeyName: "subscriptions_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      usage_metering: {
        Row: {
          id: string;
          user_id: string;
          period_start: string;
          period_end: string;
          tokens_used: number;
          requests_count: number;
          plan_limit_tokens: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          period_start: string;
          period_end: string;
          tokens_used?: number;
          requests_count?: number;
          plan_limit_tokens?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["usage_metering"]["Insert"]>;
        Relationships: [{ foreignKeyName: "usage_metering_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      revenuecat_webhook_events: {
        Row: {
          event_id: string;
          event_type: string;
          event_timestamp: string;
          payload: Json;
          received_at: string;
          processed_at: string | null;
        };
        Insert: {
          event_id: string;
          event_type: string;
          event_timestamp: string;
          payload: Json;
          received_at?: string;
          processed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["revenuecat_webhook_events"]["Insert"]>;
        Relationships: [];
      };
      edge_rate_limits: {
        Row: {
          endpoint: string;
          rate_key: string;
          window_started_at: string;
          request_count: number;
        };
        Insert: {
          endpoint: string;
          rate_key: string;
          window_started_at: string;
          request_count?: number;
        };
        Update: Partial<Database["public"]["Tables"]["edge_rate_limits"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_edge_rate_limit: {
        Args: { p_endpoint: string; p_rate_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      record_agent_usage: {
        Args: { p_user_id: string; p_tokens: number };
        Returns: undefined;
      };
      reset_free_usage_daily: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: {
      subscription_tier: SubscriptionTier;
      session_status: SessionStatus;
      task_status: TaskStatus;
      subscription_status: SubscriptionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

// Convenience row aliases.
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type AgentSessionRow = Database["public"]["Tables"]["agent_sessions"]["Row"];
export type AgentTaskRow = Database["public"]["Tables"]["agent_tasks"]["Row"];
export type CheckpointRow = Database["public"]["Tables"]["checkpoints"]["Row"];
export type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];
export type UsageMeteringRow = Database["public"]["Tables"]["usage_metering"]["Row"];
export type RevenueCatWebhookEventRow = Database["public"]["Tables"]["revenuecat_webhook_events"]["Row"];
