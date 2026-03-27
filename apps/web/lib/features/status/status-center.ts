import "server-only";

import {
  ensureDatabaseSchema,
  getOpenAIAccountStats,
  getPortalUserAccountStats,
  getPortalUserUsageStats,
  getRecentRequestHealthSummary,
  getRecentRequestHealthSummaryByOwnerUserId,
  getServiceStatusOverview,
  type OpenAIAccountStats,
  type PortalUserAccountStats,
  type PortalUserRole,
  type PortalUserUsageStats,
  type RecentRequestHealthSummary,
  type ServiceStatusMonitorSnapshot,
} from "@workspace/database";
import type { AppLocale, LocaleKey } from "@/locales";
import { formatTokenCompact } from "@/lib/format/number-format";

const RECENT_WINDOW_MINUTES = 15;
const SLOW_REQUEST_THRESHOLD_MS = 8_000;
const WARNING_FAILURE_RATE = 0.2;
const DEGRADED_FAILURE_RATE = 0.5;
const WARNING_ACCOUNT_PRESSURE_RATE = 0.3;
const WARNING_SLOW_REQUEST_RATE = 0.3;
const MIN_REQUEST_SAMPLE_SIZE = 8;

type TranslateFn = (key: LocaleKey) => string;

type SessionLike = {
  sub: string;
  role: PortalUserRole;
};

type AccountStatsLike = Pick<
  OpenAIAccountStats | PortalUserAccountStats,
  "total" | "active" | "coolingDown" | "disabled"
>;

type UsageStatsLike = Pick<
  OpenAIAccountStats | PortalUserUsageStats,
  | "dailyRequestCount"
  | "totalRequestCount"
  | "dailyRequestTokens"
  | "totalTokens"
  | "dailyRequestCost"
  | "totalCost"
  | "rpm5m"
  | "tpm5m"
>;

export type StatusCenterSeverity =
  | "healthy"
  | "warning"
  | "degraded"
  | "unknown";

export type StatusCenterIssueTone = "info" | "warning" | "degraded";

export type StatusCenterAction = {
  href: string;
  label: string;
};

export type StatusCenterMetric = {
  label: string;
  value: string;
};

export type StatusCenterCard = {
  id: string;
  title: string;
  value: string;
  description: string;
  metrics: StatusCenterMetric[];
  action?: StatusCenterAction;
};

export type StatusCenterIssue = {
  id: string;
  tone: StatusCenterIssueTone;
  title: string;
  description: string;
  metrics: StatusCenterMetric[];
  action?: StatusCenterAction;
};

export type StatusCenterMonitorItem = ServiceStatusMonitorSnapshot & {
  displayName: string;
};

export type StatusCenterMonitorGroup = {
  key: "system" | "model";
  title: string;
  monitors: StatusCenterMonitorItem[];
};

export type StatusCenterSnapshot = {
  severity: StatusCenterSeverity;
  severityLabel: string;
  modeLabel: string;
  summary: string;
  heroMetrics: StatusCenterMetric[];
  cards: StatusCenterCard[];
  issues: StatusCenterIssue[];
  stableActions: StatusCenterAction[];
  monitorGroups: StatusCenterMonitorGroup[];
  fallbackTitle: string;
  fallbackDescription: string;
  fallbackSources: string[];
  fallbackAction?: StatusCenterAction;
  hasLiveMonitors: boolean;
  generatedAt: string;
};

function formatNumber(locale: AppLocale, value: number) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat(locale).format(value)
    : "-";
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function formatMs(locale: AppLocale, value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat(locale).format(Math.round(value))}ms`;
}

function formatRpm(locale: AppLocale, value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getSeverityLabel(severity: StatusCenterSeverity, t: TranslateFn) {
  switch (severity) {
    case "healthy":
      return t("status.healthy");
    case "warning":
      return t("status.warning");
    case "degraded":
      return t("status.degraded");
    default:
      return t("status.unknown");
  }
}

function getMonitorLabel(t: TranslateFn, slug: string, fallback: string) {
  switch (slug) {
    case "sys-db-connection":
      return t("status.sys.db");
    case "sys-db-self-check":
      return t("status.sys.integrity");
    case "sys-signup-queue":
      return t("status.sys.queue");
    case "sys-billing-sanity":
      return t("status.sys.billing");
    case "sys-auth-config":
      return t("status.sys.auth");
    default:
      return fallback;
  }
}

function getFailureRate(summary: RecentRequestHealthSummary | null) {
  if (!summary || summary.requestCount <= 0) return 0;
  return summary.failedCount / summary.requestCount;
}

function getSlowRate(summary: RecentRequestHealthSummary | null) {
  if (!summary || summary.requestCount <= 0) return 0;
  return summary.slowCount / summary.requestCount;
}

function getAccountPressureRate(stats: AccountStatsLike | null) {
  if (!stats || stats.total <= 0) return 0;
  return (stats.coolingDown + stats.disabled) / stats.total;
}

function buildModeLabel(
  hasLiveMonitors: boolean,
  hasDerivedSignals: boolean,
  t: TranslateFn,
) {
  if (hasLiveMonitors && hasDerivedSignals) return t("status.modeHybrid");
  if (hasLiveMonitors) return t("status.modeLive");
  return t("status.modeDerived");
}

function buildSummary(
  severity: StatusCenterSeverity,
  hasLiveMonitors: boolean,
  t: TranslateFn,
) {
  if (severity === "degraded") return t("status.summaryDegraded");
  if (severity === "warning") return t("status.summaryWarning");
  if (severity === "healthy") {
    return hasLiveMonitors
      ? t("status.summaryHealthyLive")
      : t("status.summaryHealthyDerived");
  }
  return t("status.summaryUnknown");
}

function createAction(
  t: TranslateFn,
  kind: "accounts" | "logs" | "failedLogs" | "settings",
): StatusCenterAction {
  switch (kind) {
    case "accounts":
      return { href: "/accounts", label: t("status.viewAccounts") };
    case "failedLogs":
      return { href: "/logs?status=failed", label: t("status.viewFailedLogs") };
    case "settings":
      return { href: "/settings", label: t("status.openSettings") };
    default:
      return { href: "/logs", label: t("status.viewLogs") };
  }
}

function buildMonitorGroups(
  overview: Awaited<ReturnType<typeof getServiceStatusOverview>> | null,
  t: TranslateFn,
): StatusCenterMonitorGroup[] {
  if (!overview) return [];

  const systemMonitors = overview.monitors
    .filter((monitor) => monitor.slug.startsWith("sys-"))
    .map((monitor) => ({
      ...monitor,
      displayName: getMonitorLabel(t, monitor.slug, monitor.name),
    }));
  const modelMonitors = overview.monitors
    .filter((monitor) => monitor.slug.startsWith("model-"))
    .map((monitor) => ({
      ...monitor,
      displayName: getMonitorLabel(t, monitor.slug, monitor.name),
    }));

  return [
    {
      key: "system" as const,
      title: t("status.systemFunctions"),
      monitors: systemMonitors,
    },
    {
      key: "model" as const,
      title: t("status.modelLatency"),
      monitors: modelMonitors,
    },
  ].filter((group) => group.monitors.length > 0);
}

function sortIssues(issues: StatusCenterIssue[]) {
  const rank: Record<StatusCenterIssueTone, number> = {
    degraded: 0,
    warning: 1,
    info: 2,
  };
  return [...issues].sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 3);
}

export async function buildStatusCenterSnapshot(input: {
  session: SessionLike;
  locale: AppLocale;
  t: TranslateFn;
}): Promise<StatusCenterSnapshot> {
  const { session, locale, t } = input;
  await ensureDatabaseSchema();

  const monitorResult = await Promise.allSettled([
    getServiceStatusOverview({
      limitPerMonitor: 100,
      enabledOnly: true,
    }),
  ]);
  const monitorOverview =
    monitorResult[0]?.status === "fulfilled" ? monitorResult[0].value : null;

  let accountStats: AccountStatsLike | null = null;
  let usageStats: UsageStatsLike | null = null;
  let requestHealth: RecentRequestHealthSummary | null = null;
  let derivedError = false;

  if (session.role === "admin") {
    const [accountSummaryResult, requestHealthResult] =
      await Promise.allSettled([
        getOpenAIAccountStats(),
        getRecentRequestHealthSummary(
          RECENT_WINDOW_MINUTES,
          SLOW_REQUEST_THRESHOLD_MS,
        ),
      ]);

    if (accountSummaryResult.status === "fulfilled") {
      accountStats = accountSummaryResult.value;
      usageStats = accountSummaryResult.value;
    } else {
      derivedError = true;
    }

    if (requestHealthResult.status === "fulfilled") {
      requestHealth = requestHealthResult.value;
    } else {
      derivedError = true;
    }
  } else {
    const [accountSummaryResult, usageSummaryResult, requestHealthResult] =
      await Promise.allSettled([
        getPortalUserAccountStats(session.sub),
        getPortalUserUsageStats(session.sub),
        getRecentRequestHealthSummaryByOwnerUserId(
          session.sub,
          RECENT_WINDOW_MINUTES,
          SLOW_REQUEST_THRESHOLD_MS,
        ),
      ]);

    if (accountSummaryResult.status === "fulfilled") {
      accountStats = accountSummaryResult.value;
    } else {
      derivedError = true;
    }

    if (usageSummaryResult.status === "fulfilled") {
      usageStats = usageSummaryResult.value;
    } else {
      derivedError = true;
    }

    if (requestHealthResult.status === "fulfilled") {
      requestHealth = requestHealthResult.value;
    } else {
      derivedError = true;
    }
  }

  const hasLiveMonitors = Boolean(monitorOverview?.monitors.length);
  const hasDerivedSignals = Boolean(
    accountStats || usageStats || requestHealth,
  );
  const monitorGroups = buildMonitorGroups(monitorOverview, t);
  const failureRate = getFailureRate(requestHealth);
  const slowRate = getSlowRate(requestHealth);
  const accountPressureRate = getAccountPressureRate(accountStats);
  const degradedMonitorCount =
    monitorOverview?.monitors.filter((monitor) => monitor.level === "degraded")
      .length ?? 0;

  const issues: StatusCenterIssue[] = [];

  if (degradedMonitorCount > 0) {
    issues.push({
      id: "monitor-degraded",
      tone: "degraded",
      title: t("status.issueMonitorFailures"),
      description: t("status.issueMonitorFailuresHint"),
      metrics: [
        {
          label: t("status.activeMonitors"),
          value: `${formatNumber(locale, degradedMonitorCount)} / ${formatNumber(
            locale,
            monitorOverview?.monitors.length ?? 0,
          )}`,
        },
      ],
      action: createAction(t, "logs"),
    });
  }

  if (accountStats?.total === 0) {
    issues.push({
      id: "no-accounts",
      tone: "warning",
      title: t("status.issueNoAccounts"),
      description: t("status.issueNoAccountsHint"),
      metrics: [
        {
          label: t("stats.totalAccounts"),
          value: formatNumber(locale, accountStats.total),
        },
      ],
      action: createAction(t, "accounts"),
    });
  } else if ((accountStats?.active ?? 0) === 0) {
    issues.push({
      id: "no-active-accounts",
      tone: "degraded",
      title: t("status.issueNoActiveAccounts"),
      description: t("status.issueNoActiveAccountsHint"),
      metrics: [
        {
          label: t("stats.activeAccounts"),
          value: formatNumber(locale, accountStats?.active ?? 0),
        },
        {
          label: t("stats.disabledAccounts"),
          value: formatNumber(locale, accountStats?.disabled ?? 0),
        },
      ],
      action: createAction(t, "accounts"),
    });
  } else if (accountPressureRate >= WARNING_ACCOUNT_PRESSURE_RATE) {
    issues.push({
      id: "account-pressure",
      tone: "warning",
      title: t("status.issueAccountPressure"),
      description: t("status.issueAccountPressureHint"),
      metrics: [
        {
          label: t("status.capacityPressure"),
          value: formatPercent(accountPressureRate),
        },
        {
          label: t("stats.activeAccounts"),
          value: formatNumber(locale, accountStats?.active ?? 0),
        },
      ],
      action: createAction(t, "accounts"),
    });
  }

  if ((requestHealth?.requestCount ?? 0) >= MIN_REQUEST_SAMPLE_SIZE) {
    if (failureRate >= DEGRADED_FAILURE_RATE) {
      issues.push({
        id: "high-failure-rate",
        tone: "degraded",
        title: t("status.issueHighFailureRate"),
        description: t("status.issueHighFailureRateHint"),
        metrics: [
          {
            label: t("status.recentRequests"),
            value: formatNumber(locale, requestHealth?.requestCount ?? 0),
          },
          {
            label: t("status.failureRate"),
            value: formatPercent(failureRate),
          },
        ],
        action: createAction(t, "failedLogs"),
      });
    } else if (failureRate >= WARNING_FAILURE_RATE) {
      issues.push({
        id: "elevated-failure-rate",
        tone: "warning",
        title: t("status.issueHighFailureRate"),
        description: t("status.issueHighFailureRateHint"),
        metrics: [
          {
            label: t("status.recentRequests"),
            value: formatNumber(locale, requestHealth?.requestCount ?? 0),
          },
          {
            label: t("status.failureRate"),
            value: formatPercent(failureRate),
          },
        ],
        action: createAction(t, "failedLogs"),
      });
    }

    if (slowRate >= WARNING_SLOW_REQUEST_RATE) {
      issues.push({
        id: "high-latency",
        tone: failureRate >= WARNING_FAILURE_RATE ? "warning" : "warning",
        title: t("status.issueHighLatency"),
        description: t("status.issueHighLatencyHint"),
        metrics: [
          {
            label: t("status.slowRequests"),
            value: formatPercent(slowRate),
          },
          {
            label: t("status.avgLatency"),
            value: formatMs(locale, requestHealth?.averageLatencyMs ?? null),
          },
        ],
        action: createAction(t, "logs"),
      });
    }
  }

  if (!hasLiveMonitors) {
    issues.push({
      id: "no-live-monitors",
      tone: "info",
      title: t("status.issueNoMonitors"),
      description: t("status.issueNoMonitorsHint"),
      metrics: [
        {
          label: t("status.activeMonitors"),
          value: formatNumber(locale, 0),
        },
      ],
      action:
        session.role === "admin" ? createAction(t, "settings") : undefined,
    });
  }

  if (monitorResult[0]?.status === "rejected") {
    issues.push({
      id: "monitor-data-unavailable",
      tone: "warning",
      title: t("status.issueMonitorDataUnavailable"),
      description: t("status.issueMonitorDataUnavailableHint"),
      metrics: [],
    });
  }

  if (derivedError) {
    issues.push({
      id: "derived-data-unavailable",
      tone: "info",
      title: t("status.issueDerivedDataUnavailable"),
      description: t("status.issueDerivedDataUnavailableHint"),
      metrics: [],
    });
  }

  let severity: StatusCenterSeverity = "unknown";
  if (issues.some((issue) => issue.tone === "degraded")) {
    severity = "degraded";
  } else if (issues.some((issue) => issue.tone === "warning")) {
    severity = "warning";
  } else if (hasLiveMonitors || hasDerivedSignals) {
    severity = "healthy";
  }

  if (
    !hasLiveMonitors &&
    !hasDerivedSignals &&
    !issues.some(
      (issue) => issue.tone === "degraded" || issue.tone === "warning",
    )
  ) {
    severity = "unknown";
  }

  const summary = buildSummary(severity, hasLiveMonitors, t);
  const cards: StatusCenterCard[] = [
    {
      id: "accounts",
      title: t("status.accountHealth"),
      value: accountStats
        ? `${formatNumber(locale, accountStats.active)} / ${formatNumber(
            locale,
            accountStats.total,
          )}`
        : "-",
      description: accountStats
        ? t("status.accountHealthHint")
        : t("status.issueDerivedDataUnavailableHint"),
      metrics: [
        {
          label: t("stats.coolingDownAccounts"),
          value: formatNumber(locale, accountStats?.coolingDown ?? 0),
        },
        {
          label: t("stats.disabledAccounts"),
          value: formatNumber(locale, accountStats?.disabled ?? 0),
        },
      ],
      action: createAction(t, "accounts"),
    },
    {
      id: "requests",
      title: t("status.requestHealth"),
      value:
        requestHealth && requestHealth.requestCount > 0
          ? formatPercent(
              requestHealth.successCount /
                Math.max(1, requestHealth.requestCount),
            )
          : t("status.noRecentRequests"),
      description:
        requestHealth && requestHealth.requestCount > 0
          ? t("status.requestHealthHint")
          : t("status.noRecentRequestsHint"),
      metrics: [
        {
          label: t("status.recentRequests"),
          value: formatNumber(locale, requestHealth?.requestCount ?? 0),
        },
        {
          label: t("status.avgLatency"),
          value: formatMs(locale, requestHealth?.averageLatencyMs ?? null),
        },
        {
          label: t("stats.rpmTpm5m"),
          value: usageStats
            ? `${formatRpm(locale, usageStats.rpm5m)} / ${formatTokenCompact(
                usageStats.tpm5m,
              )}`
            : "-",
        },
      ],
      action:
        failureRate >= WARNING_FAILURE_RATE
          ? createAction(t, "failedLogs")
          : createAction(t, "logs"),
    },
    {
      id: "monitors",
      title: t("status.monitorCoverage"),
      value: hasLiveMonitors
        ? formatNumber(locale, monitorOverview?.monitors.length ?? 0)
        : t("status.derivedActive"),
      description: hasLiveMonitors
        ? t("status.monitorCoverageHint")
        : t("status.noMonitorCoverage"),
      metrics: [
        {
          label: t("status.activeMonitors"),
          value: formatNumber(locale, monitorOverview?.monitors.length ?? 0),
        },
        {
          label: t("status.dataMode"),
          value: buildModeLabel(hasLiveMonitors, hasDerivedSignals, t),
        },
      ],
      action: hasLiveMonitors
        ? undefined
        : session.role === "admin"
          ? createAction(t, "settings")
          : undefined,
    },
  ];

  const stableActions = [createAction(t, "accounts"), createAction(t, "logs")];

  const heroMetrics: StatusCenterMetric[] = [
    {
      label: t("stats.activeAccounts"),
      value: formatNumber(locale, accountStats?.active ?? 0),
    },
    {
      label: t("status.recentRequests"),
      value: formatNumber(locale, requestHealth?.requestCount ?? 0),
    },
    {
      label: t("status.successRate"),
      value:
        requestHealth && requestHealth.requestCount > 0
          ? formatPercent(
              requestHealth.successCount / requestHealth.requestCount,
            )
          : "-",
    },
    {
      label: t("status.activeMonitors"),
      value: formatNumber(locale, monitorOverview?.monitors.length ?? 0),
    },
  ];

  return {
    severity,
    severityLabel: getSeverityLabel(severity, t),
    modeLabel: buildModeLabel(hasLiveMonitors, hasDerivedSignals, t),
    summary,
    heroMetrics,
    cards,
    issues: sortIssues(issues),
    stableActions,
    monitorGroups,
    fallbackTitle: t("status.fallbackTitle"),
    fallbackDescription:
      monitorResult[0]?.status === "rejected"
        ? t("status.issueMonitorDataUnavailableHint")
        : t("status.fallbackDescription"),
    fallbackSources: [
      t("status.fallbackSourceAccounts"),
      t("status.fallbackSourceRequests"),
      t("status.fallbackSourceUsage"),
    ],
    fallbackAction:
      session.role === "admin" && !hasLiveMonitors
        ? createAction(t, "settings")
        : undefined,
    hasLiveMonitors,
    generatedAt:
      monitorOverview?.generatedAt ??
      requestHealth?.latestRequestAt ??
      new Date().toISOString(),
  };
}
