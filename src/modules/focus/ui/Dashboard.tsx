import { useMemo, useState } from "react";
import { EmptyState, Segmented } from "../../../ui-kit/index.ts";
import { duration } from "../domain/engine.ts";
import {
  activeDays,
  bestHour,
  byDay,
  byMonth,
  byWeek,
  counted,
  distribution,
  heatmap,
  milestones,
  totals,
  type Bucket,
  type DayPart,
} from "../domain/stats.ts";
import { useFocus } from "./FocusProvider.tsx";

type Range = "day" | "week" | "month";

function hourText(h: number, hour12: boolean): string {
  const at = (x: number) =>
    new Date(2026, 0, 1, x % 24).toLocaleTimeString(undefined, { hour: "numeric", hour12 });
  return `${at(h)} to ${at(h + 1)}`;
}

function label(range: Range, key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  if (range === "month") return date.toLocaleDateString(undefined, { month: "short" });
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function BarChart({ buckets, range, name }: { buckets: Bucket[]; range: Range; name: string }) {
  const W = 320;
  const H = 150;
  const pad = { l: 34, r: 6, t: 10, b: 22 };
  const max = Math.max(60, ...buckets.map((b) => b.seconds));
  const niceMax = Math.ceil(max / 1800) * 1800; // round up to the next half hour
  const bw = (W - pad.l - pad.r) / buckets.length;
  const total = buckets.reduce((a, b) => a + b.seconds, 0);
  const every = Math.ceil(buckets.length / 6);
  const y = (s: number) => pad.t + (1 - s / niceMax) * (H - pad.t - pad.b);
  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${name}: ${duration(total)} in total across ${buckets.length} ${range === "day" ? "days" : range === "week" ? "weeks" : "months"}`}
        className="h-auto w-full"
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(niceMax * f)}
              y2={y(niceMax * f)}
              stroke="var(--lv-border)"
            />
            <text
              x={pad.l - 5}
              y={y(niceMax * f) + 3}
              textAnchor="end"
              fontSize="9"
              fill="var(--lv-text-muted)"
            >
              {f === 0 ? "0" : `${Math.round((niceMax * f) / 360) / 10}h`}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const h = b.seconds === 0 ? 0 : Math.max(2, H - pad.b - y(b.seconds));
          const last = i === buckets.length - 1;
          return (
            <g key={b.key}>
              <rect
                x={pad.l + i * bw + bw * 0.15}
                width={bw * 0.7}
                y={H - pad.b - h}
                height={h}
                rx="2"
                fill={last ? "var(--lv-accent)" : "var(--lv-chart-2)"}
                opacity={last ? 1 : 0.8}
              >
                <title>{`${label(range, b.key)}: ${duration(b.seconds)}`}</title>
              </rect>
              {i % every === 0 && (
                <text
                  x={pad.l + i * bw + bw / 2}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize="8.5"
                  fill="var(--lv-text-muted)"
                >
                  {label(range, b.key)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function Tile({ name, value, hint }: { name: string; value: string; hint?: string }) {
  return (
    <div className="rounded-control border border-line bg-surface-2 p-3">
      <p className="m-0 text-sm text-muted">{name}</p>
      <p className="m-0 mt-1 font-mono text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="m-0 mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const PARTS: { id: DayPart; name: string; hours: string }[] = [
  { id: "morning", name: "Morning", hours: "5 AM to noon" },
  { id: "afternoon", name: "Afternoon", hours: "noon to 5 PM" },
  { id: "evening", name: "Evening", hours: "5 to 10 PM" },
  { id: "night", name: "Night", hours: "10 PM to 5 AM" },
];

/** The study-time dashboard: numbers first, then the shape of the last weeks and months. */
export function Dashboard() {
  const { state } = useFocus();
  const { records, settings, loaded } = state;
  const [range, setRange] = useState<Range>("day");
  const today = useMemo(() => new Date(), []);
  const data = useMemo(() => {
    const t = totals(records, today);
    const weeks = byWeek(records, today, 2);
    return {
      t,
      series: {
        day: byDay(records, today, 14),
        week: byWeek(records, today, 12),
        month: byMonth(records, today, 12),
      },
      lastWeek: weeks[0]!.seconds,
      thisWeek: weeks[1]!.seconds,
      dist: distribution(records),
      best: bestHour(records),
      days7: activeDays(records, today, 7),
      days28: activeDays(records, today, 28),
      heat: heatmap(records, today, 12),
      miles: milestones(t.total),
    };
  }, [records, today]);

  if (!loaded && records.length === 0) {
    return (
      <div className="lv-card p-5 text-sm text-muted" role="status">
        Loading your study time…
      </div>
    );
  }
  if (counted(records).length === 0) {
    return (
      <div className="lv-card">
        <EmptyState
          title="No study time yet"
          description="Finish a focus session of a minute or more and your numbers appear here."
        />
      </div>
    );
  }

  const { t } = data;
  const dist = data.dist;
  const distMax = Math.max(1, ...Object.values(dist));
  const diff = data.thisWeek - data.lastWeek;
  const rangeName =
    range === "day" ? "Last 14 days" : range === "week" ? "Last 12 weeks" : "Last 12 months";

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Study time totals"
        className="lv-card grid grid-cols-2 gap-3 p-5 sm:grid-cols-4"
      >
        <Tile name="Today" value={duration(t.today)} hint={`${t.completedToday} completed`} />
        <Tile name="This week" value={duration(t.week)} />
        <Tile name="This month" value={duration(t.month)} />
        <Tile name="All time" value={duration(t.total)} />
        <Tile name="Focus sessions" value={String(t.sessions)} />
        <Tile name="Average session" value={duration(t.average)} />
      </section>

      <section aria-label="Insights" className="lv-card flex flex-col gap-2 p-5">
        <h2 className="m-0 text-lg font-semibold">What your numbers say</h2>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
          <li>
            You studied on <strong>{data.days7} of the last 7 days</strong> and {data.days28} of the
            last 28.
          </li>
          {data.lastWeek > 0 && (
            <li>
              This week is{" "}
              <strong>
                {diff === 0
                  ? "the same as"
                  : `${duration(Math.abs(diff))} ${diff > 0 ? "more than" : "less than"}`}
              </strong>{" "}
              last week so far ({duration(data.lastWeek)} last week).
            </li>
          )}
          {data.best !== null && (
            <li>
              Your most focused time is <strong>{hourText(data.best, settings.hour12)}</strong>.
            </li>
          )}
          {data.miles.next !== null && (
            <li>
              {data.miles.reached !== null && (
                <>You have passed {data.miles.reached} hours of study. </>
              )}
              {duration(data.miles.toNext)} to your {data.miles.next}-hour milestone.
            </li>
          )}
        </ul>
      </section>

      <section aria-label="Study time chart" className="lv-card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-lg font-semibold">{rangeName}</h2>
          <Segmented
            label="Chart range"
            hideLabel
            value={range}
            options={[
              { value: "day", label: "Daily" },
              { value: "week", label: "Weekly" },
              { value: "month", label: "Monthly" },
            ]}
            onChange={(v) => setRange(v as Range)}
          />
        </div>
        <BarChart buckets={data.series[range]} range={range} name={rangeName} />
      </section>

      <section aria-label="When you study" className="lv-card flex flex-col gap-3 p-5">
        <h2 className="m-0 text-lg font-semibold">When you study</h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {PARTS.map((p) => (
            <li
              key={p.id}
              className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3 text-sm"
            >
              <span>
                {p.name}
                <span className="block text-xs text-muted">{p.hours}</span>
              </span>
              <span className="h-2.5 overflow-hidden rounded-pill bg-surface-3" aria-hidden>
                <span
                  className="block h-full rounded-pill bg-accent"
                  style={{ width: `${(dist[p.id] / distMax) * 100}%` }}
                />
              </span>
              <span className="text-right font-mono tabular-nums">{duration(dist[p.id])}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Last 12 weeks" className="lv-card flex flex-col gap-3 p-5">
        <h2 className="m-0 text-lg font-semibold">Your last 12 weeks</h2>
        <div
          role="img"
          aria-label={`Study days in the last 12 weeks: ${data.heat.flat().filter((c) => c.seconds > 0).length} days with study`}
          className="grid grid-flow-col gap-1 overflow-x-auto"
          style={{ gridTemplateRows: "repeat(7, 1fr)" }}
        >
          {data.heat.flat().map((c) => (
            <span
              key={c.day}
              title={`${c.day}: ${duration(c.seconds)}`}
              className="block h-4 w-4 rounded-[4px] border border-line sm:h-5 sm:w-5"
              style={{
                background: `color-mix(in srgb, var(--lv-accent) ${c.level * 25}%, var(--lv-surface-2))`,
              }}
            />
          ))}
        </div>
        <p className="m-0 text-xs text-muted">
          Each square is a day, Monday to Sunday down each column. A stronger colour means more
          study.
        </p>
      </section>
    </div>
  );
}
