/** Sentry alert rule to provision in the project (kept version-controlled). */
export const agentRunErrorRateAlert = {
  name: "agent-run error rate > 5% in 5 minutes",
  environment: "production",
  query: "event.type:error transaction:agent-run",
  windowMinutes: 5,
  threshold: 0.05,
  metric: "error_rate",
  action: "page-on-call",
} as const;
