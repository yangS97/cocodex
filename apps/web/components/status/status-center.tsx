import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ShieldBan,
  Users,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@workspace/ui/components/hover-card";
import { cn } from "@workspace/ui/lib/utils";
import type { LocaleKey } from "@/locales";
import type {
  StatusCenterIssue,
  StatusCenterMetric,
  StatusCenterSnapshot,
} from "@/lib/features/status/status-center";

type TranslateFn = (key: LocaleKey) => string;

function getSeverityBadgeClass(severity: StatusCenterSnapshot["severity"]) {
  if (severity === "healthy") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300";
  }
  if (severity === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300";
  }
  if (severity === "degraded") {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300";
  }
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300";
}

function getIssueToneClass(tone: StatusCenterIssue["tone"]) {
  if (tone === "degraded") {
    return "border-rose-200 bg-rose-50/70 dark:border-rose-950 dark:bg-rose-950/20";
  }
  if (tone === "warning") {
    return "border-amber-200 bg-amber-50/70 dark:border-amber-950 dark:bg-amber-950/20";
  }
  return "border-sky-200 bg-sky-50/70 dark:border-sky-950 dark:bg-sky-950/20";
}

function getIssueIcon(tone: StatusCenterIssue["tone"]) {
  if (tone === "degraded") {
    return <ShieldBan className="size-4 text-rose-600" />;
  }
  if (tone === "warning") {
    return <AlertCircle className="size-4 text-amber-600" />;
  }
  return <CheckCircle2 className="size-4 text-sky-600" />;
}

function getCardToneClass(cardId: string) {
  if (cardId === "accounts") {
    return "hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20";
  }
  if (cardId === "requests") {
    return "hover:bg-cyan-50/40 dark:hover:bg-cyan-950/20";
  }
  if (cardId === "monitors") {
    return "hover:bg-violet-50/40 dark:hover:bg-violet-950/20";
  }
  return "hover:bg-muted/20";
}

function getSampleColorClass(
  sample: {
    statusCode: number | null;
    latencyMs: number | null;
  } | null,
  isModelLatency: boolean,
) {
  if (!sample) return "bg-muted";
  if (!isModelLatency) {
    return sample.statusCode === 200 ? "bg-emerald-500/80" : "bg-rose-500/85";
  }
  if (sample.statusCode !== 200) return "bg-rose-500/85";
  if (typeof sample.latencyMs === "number" && sample.latencyMs > 5_000) {
    return "bg-amber-500/85";
  }
  return "bg-emerald-500/80";
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function MetricList({ metrics }: { metrics: StatusCenterMetric[] }) {
  return (
    <dl className="grid gap-2 text-sm text-muted-foreground">
      {metrics.map((metric) => (
        <div
          key={`${metric.label}-${metric.value}`}
          className="flex items-center justify-between gap-3"
        >
          <dt>{metric.label}</dt>
          <dd className="font-medium text-foreground">{metric.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatusIssues({
  snapshot,
  t,
}: {
  snapshot: StatusCenterSnapshot;
  t: TranslateFn;
}) {
  if (snapshot.issues.length === 0) {
    return (
      <section className="rounded-xl border bg-background p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold">
              {t("status.priorityIssues")}
            </h2>
            <p className="text-sm text-foreground">{t("status.noIssues")}</p>
            <p className="text-sm text-muted-foreground">
              {t("status.noIssuesHint")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {snapshot.stableActions.map((action) => (
              <Button key={action.href} asChild variant="outline">
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("status.priorityIssues")}</h2>
        <Badge variant="outline">{snapshot.issues.length}</Badge>
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        {snapshot.issues.map((issue) => (
          <article
            key={issue.id}
            className={cn(
              "rounded-xl border p-4",
              getIssueToneClass(issue.tone),
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  {getIssueIcon(issue.tone)}
                  <h3 className="font-medium">{issue.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {issue.description}
                </p>
              </div>
            </div>

            {issue.metrics.length > 0 ? (
              <div className="mt-4">
                <MetricList metrics={issue.metrics} />
              </div>
            ) : null}

            {issue.action ? (
              <div className="mt-4">
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={issue.action.href}
                    className="inline-flex items-center gap-1.5"
                  >
                    {issue.action.label}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function StatusMonitorSections({
  snapshot,
  t,
}: {
  snapshot: StatusCenterSnapshot;
  t: TranslateFn;
}) {
  if (!snapshot.hasLiveMonitors) {
    return (
      <section className="rounded-xl border bg-background p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">{snapshot.fallbackTitle}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {snapshot.fallbackDescription}
            </p>
            <ul className="grid gap-2 text-sm text-foreground">
              {snapshot.fallbackSources.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {snapshot.fallbackAction ? (
            <Button asChild variant="outline">
              <Link href={snapshot.fallbackAction.href}>
                {snapshot.fallbackAction.label}
              </Link>
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {snapshot.monitorGroups.map((group) => (
        <section key={group.key} className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
            <h2 className="text-lg font-semibold">{group.title}</h2>
            <span className="text-sm text-muted-foreground">
              {group.monitors.length}{" "}
              {group.key === "model"
                ? t("status.models")
                : t("status.components")}
            </span>
          </div>
          <div className="space-y-2">
            {group.monitors.map((monitor) => {
              const latestWindow = monitor.samples.slice(0, 100).reverse();
              const bars = Array.from(
                { length: 100 },
                (_, index) => latestWindow[index] ?? null,
              );
              const uptimeLevel =
                monitor.uptimePercent > 95
                  ? "good"
                  : monitor.uptimePercent > 20
                    ? "warn"
                    : "bad";

              return (
                <div
                  key={monitor.id}
                  className="rounded-xl border bg-background px-3 py-3 sm:px-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {uptimeLevel === "good" ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      ) : uptimeLevel === "warn" ? (
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                      )}
                      <p className="truncate text-sm leading-normal sm:text-base">
                        {monitor.displayName}
                      </p>
                    </div>
                    <div className="whitespace-nowrap text-[11px] text-muted-foreground sm:text-sm">
                      {monitor.uptimePercent.toFixed(2)}%{" "}
                      <span className="hidden sm:inline">
                        {t("status.uptime")}
                      </span>
                    </div>
                  </div>

                  <div className="grid w-full gap-0.5 [grid-template-columns:repeat(50,minmax(0,1fr))] sm:gap-1 xl:[grid-template-columns:repeat(100,minmax(0,1fr))]">
                    {bars.map((sample, index) => (
                      <HoverCard
                        key={`${monitor.id}-bar-${index}`}
                        openDelay={80}
                        closeDelay={30}
                      >
                        <HoverCardTrigger asChild>
                          <span
                            className={cn(
                              "h-4 min-w-0 rounded-[2px] transition-transform duration-150 ease-out hover:scale-110 hover:brightness-90 sm:h-5 sm:rounded-[3px]",
                              getSampleColorClass(
                                sample,
                                group.key === "model",
                              ),
                            )}
                          />
                        </HoverCardTrigger>
                        <HoverCardContent className="w-52">
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground">
                              {sample
                                ? formatTimestamp(sample.checkedAt)
                                : t("status.noDataPoint")}
                            </p>
                            <div className="text-sm">
                              <span className="text-muted-foreground">
                                {t("common.status")}:{" "}
                              </span>
                              {sample
                                ? sample.statusCode === 200
                                  ? `200 ${t("status.ok")}`
                                  : `${t("status.error")} ${sample.statusCode ?? "-"}`
                                : "-"}
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">
                                {t("status.latestLatency")}:{" "}
                              </span>
                              {sample?.latencyMs == null
                                ? "-"
                                : `${sample.latencyMs}ms`}
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function StatusCenterView({
  snapshot,
  t,
}: {
  snapshot: StatusCenterSnapshot;
  t: TranslateFn;
}) {
  return (
    <main className="flex w-full flex-col gap-5 px-3 py-3 sm:gap-6 sm:px-4 sm:py-4 lg:px-5">
      <section className="rounded-2xl border bg-gradient-to-br from-background via-background to-muted/40 p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={getSeverityBadgeClass(snapshot.severity)}
              >
                {snapshot.severityLabel}
              </Badge>
              <Badge variant="outline">{snapshot.modeLabel}</Badge>
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold">{t("page.status")}</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {snapshot.summary}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[520px]">
            {snapshot.heroMetrics.map((metric, index) => (
              <div
                key={`${metric.label}-${metric.value}`}
                className="rounded-xl border bg-background/80 p-3"
              >
                <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                  {index === 0 ? (
                    <Users className="size-4" />
                  ) : index === 1 ? (
                    <Activity className="size-4" />
                  ) : index === 2 ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Clock3 className="size-4" />
                  )}
                  <span className="text-xs uppercase tracking-wide">
                    {metric.label}
                  </span>
                </div>
                <div className="text-xl font-semibold">{metric.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {snapshot.cards.map((card) => (
          <article
            key={card.id}
            className={cn(
              "rounded-xl border bg-background p-5 transition-colors",
              getCardToneClass(card.id),
            )}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {card.title}
              </div>
              {card.id === "accounts" ? (
                <Users className="size-4 text-emerald-600" />
              ) : card.id === "requests" ? (
                <Activity className="size-4 text-cyan-600" />
              ) : (
                <Clock3 className="size-4 text-violet-600" />
              )}
            </div>

            <div className="mt-3 text-3xl font-bold tracking-tight">
              {card.value}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {card.description}
            </p>

            <div className="mt-4">
              <MetricList metrics={card.metrics} />
            </div>

            {card.action ? (
              <div className="mt-4">
                <Button asChild variant="outline" size="sm">
                  <Link href={card.action.href}>{card.action.label}</Link>
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <StatusIssues snapshot={snapshot} t={t} />
      <StatusMonitorSections snapshot={snapshot} t={t} />
    </main>
  );
}
