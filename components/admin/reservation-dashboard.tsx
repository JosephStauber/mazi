"use client";

import { useMemo, useState } from "react";
import {
  RECLAIM_FACTOR,
  RESERVATION_LIST_LIMIT,
  SURVEY_OPTIONS,
} from "@/lib/reserve/config";
import type { ReservationStats, ReservationRow } from "@/lib/queries/admin";

const reasonLabel = (id: string) =>
  SURVEY_OPTIONS.find((o) => o.id === id)?.label ?? id;

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export function ReservationDashboard({
  stats,
  rows,
  listError = false,
}: {
  stats: ReservationStats;
  rows: ReservationRow[];
  listError?: boolean;
}) {
  const reclaimHoursYear = Math.round(
    (stats.sum_minutes * RECLAIM_FACTOR * 365) / 60
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="brand text-3xl text-foreground">Reservations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pre-launch waitlist — who&rsquo;s in, what draws them, and who to reach.
          </p>
        </div>
        <CopyEmails rows={rows} />
      </header>

      {stats.total === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface p-10 text-center text-muted-foreground">
          No reservations yet. Share the <code>/reserve</code> link to start
          collecting signups.
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Stat label="Total reserved" value={stats.total} big />
            <Stat label="Last 7 days" value={stats.last7} accent />
            <Stat label="Today" value={stats.today} />
            <Stat
              label="Email confirmed"
              value={`${pct(stats.confirmed, stats.total)}%`}
              sub={`${stats.confirmed} of ${stats.total}`}
            />
            <Stat
              label="From referrals"
              value={`${pct(stats.referred, stats.total)}%`}
              sub={`${stats.referred} joined via invite`}
            />
            <Stat
              label="Avg time / day"
              value={stats.avg_minutes != null ? `${stats.avg_minutes}m` : "—"}
              sub={
                stats.median_minutes != null
                  ? `median ${stats.median_minutes}m`
                  : undefined
              }
            />
          </section>

          <section className="rounded-[var(--radius-lg)] border border-accent bg-accent-muted p-5 text-center">
            <div className="brand text-4xl text-accent">
              {reclaimHoursYear.toLocaleString()} hrs
            </div>
            <p className="mt-1 text-sm text-foreground">
              collective time these {stats.total} people could reclaim per year on
              Mazi (at {Math.round(RECLAIM_FACTOR * 100)}% less scrolling)
            </p>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Signups — last 30 days
            </h2>
            <DailyChart daily={stats.daily} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">
                What draws them
              </h2>
              <ReasonBars reasons={stats.reasons} total={stats.total} />
            </section>

            <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">
                Reported time on social / day
              </h2>
              <MinuteBuckets buckets={stats.minute_buckets} />
              {stats.top_referrers.length > 0 && (
                <>
                  <h2 className="mb-3 mt-6 text-sm font-semibold text-foreground">
                    Top referrers
                  </h2>
                  <ul className="space-y-1.5">
                    {stats.top_referrers.map((r) => (
                      <li
                        key={r.username}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-foreground">@{r.username}</span>
                        <span className="font-semibold text-accent">
                          {r.count} invited
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          <ReservationsTable
            rows={rows}
            total={stats.total}
            listError={listError}
          />
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  big,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  big?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`brand mt-1 ${big ? "text-4xl" : "text-2xl"} ${
          accent ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-subtle">{sub}</div>}
    </div>
  );
}

function DailyChart({ daily }: { daily: { day: string; count: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.count));
  return (
    <div className="flex h-32 gap-1">
      {daily.map((d) => (
        <div key={d.day} className="group relative flex flex-1 items-end">
          <div
            className="w-full rounded-t-sm bg-accent/80 transition-colors group-hover:bg-accent"
            style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 2 : 0 }}
          />
          <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background opacity-0 group-hover:opacity-100">
            {d.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReasonBars({
  reasons,
  total,
}: {
  reasons: Record<string, number>;
  total: number;
}) {
  const entries = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0)
    return <p className="text-sm text-muted-foreground">No responses yet.</p>;
  const max = Math.max(...entries.map(([, c]) => c));
  return (
    <div className="space-y-2.5">
      {entries.map(([id, count]) => (
        <div key={id}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-foreground">{reasonLabel(id)}</span>
            <span className="text-muted-foreground">
              {count} · {pct(count, total)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MinuteBuckets({
  buckets,
}: {
  buckets: { label: string; count: number }[];
}) {
  if (buckets.length === 0)
    return <p className="text-sm text-muted-foreground">No responses yet.</p>;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="flex h-32 gap-3">
      {buckets.map((b) => (
        <div key={b.label} className="flex flex-1 flex-col items-center">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-sm bg-foreground/70"
              style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count > 0 ? 2 : 0 }}
            />
          </div>
          <span className="mt-1.5 text-xs font-medium text-foreground">{b.count}</span>
          <span className="text-[11px] text-muted-foreground">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

function CopyEmails({ rows }: { rows: ReservationRow[] }) {
  const [copied, setCopied] = useState(false);
  const emails = useMemo(() => rows.map((r) => r.email).join(", "), [rows]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(emails);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={rows.length === 0}
      className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      {copied ? "Copied!" : `Copy ${rows.length} email${rows.length === 1 ? "" : "s"}`}
    </button>
  );
}

function ReservationsTable({
  rows,
  total,
  listError,
}: {
  rows: ReservationRow[];
  total: number;
  listError: boolean;
}) {
  const truncated = rows.length >= RESERVATION_LIST_LIMIT && total > rows.length;
  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {truncated
            ? `Reservations — showing first ${rows.length.toLocaleString()} of ${total.toLocaleString()}`
            : `All reservations (${rows.length.toLocaleString()})`}
        </h2>
        {listError && (
          <span className="text-xs font-medium text-danger">
            Couldn&rsquo;t load the list — try refreshing.
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-2.5 font-medium">Username</th>
              <th className="px-5 py-2.5 font-medium">Email</th>
              <th className="px-5 py-2.5 font-medium">Reasons</th>
              <th className="px-5 py-2.5 font-medium">Min/day</th>
              <th className="px-5 py-2.5 font-medium">Referrals</th>
              <th className="px-5 py-2.5 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.username}
                className="border-b border-border last:border-0 hover:bg-muted/40"
              >
                <td className="px-5 py-3 font-medium text-foreground">
                  @{r.username}
                  {r.referred_by && (
                    <span className="ml-1.5 text-xs text-subtle">↩ referred</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className="text-foreground">{r.email}</span>
                  <span
                    className={`ml-2 inline-block h-1.5 w-1.5 rounded-full ${
                      r.email_confirmed ? "bg-accent" : "bg-border-strong"
                    }`}
                    title={r.email_confirmed ? "Email confirmed" : "Unconfirmed"}
                  />
                </td>
                <td className="px-5 py-3 text-muted-foreground">
                  {r.reasons.map(reasonLabel).join(", ") || "—"}
                </td>
                <td className="px-5 py-3 text-foreground">
                  {r.daily_social_minutes ?? "—"}
                </td>
                <td className="px-5 py-3 text-foreground">{r.referral_count}</td>
                <td className="px-5 py-3 text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
