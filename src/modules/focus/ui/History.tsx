import { useMemo, useState } from "react";
import { Badge, Button, EmptyState } from "../../../ui-kit/index.ts";
import { duration, type FocusRecord } from "../domain/engine.ts";
import { MODE_LABEL, timeOfDay } from "../domain/settings.ts";
import { completion, dayKey, history } from "../domain/stats.ts";
import { useFocus } from "./FocusProvider.tsx";

const TONE = { completed: "success", interrupted: "warning", cancelled: "neutral" } as const;
const STATUS = {
  completed: "Completed",
  interrupted: "Stopped early",
  cancelled: "Under a minute",
} as const;

function Row({ r, waiting }: { r: FocusRecord; waiting: boolean }) {
  const { controller, state } = useFocus();
  const [ask, setAsk] = useState(false);
  const share = completion(r);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="m-0 font-semibold">
          {timeOfDay(r.startedAt, state.settings.hour12)} to{" "}
          {timeOfDay(r.endedAt, state.settings.hour12)}
        </p>
        <p className="m-0 text-sm text-muted">
          {MODE_LABEL[r.kind]} · {duration(r.focusSeconds)}
          {share !== null && r.status !== "completed"
            ? ` of ${duration(r.plannedSeconds ?? 0)} (${Math.round(share * 100)}%)`
            : ""}
          {r.status === "cancelled" && " · not counted"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {waiting && <Badge tone="accent">Waiting to sync</Badge>}
        <Badge tone={TONE[r.status]}>{STATUS[r.status]}</Badge>
        {ask ? (
          <>
            <Button size="sm" variant="danger" onClick={() => void controller.removeRecord(r.id)}>
              Delete session
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAsk(false)}>
              Keep
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Delete session at ${timeOfDay(r.startedAt, state.settings.hour12)}`}
            onClick={() => setAsk(true)}
          >
            Delete
          </Button>
        )}
      </div>
    </li>
  );
}

/** Every session, newest first, with a date filter. */
export function History() {
  const { state } = useFocus();
  const [day, setDay] = useState("");
  const list = useMemo(() => history(state.records, day || null), [state.records, day]);
  const waiting = useMemo(() => new Set(state.pendingIds), [state.pendingIds]);
  const groups = useMemo(() => {
    const m = new Map<string, FocusRecord[]>();
    for (const r of list) {
      const k = dayKey(r.startedAt);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()];
  }, [list]);

  return (
    <section aria-label="Session history" className="lv-card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold">Session history</h2>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="focus-day" className="text-sm font-semibold">
              Day
            </label>
            <input
              id="focus-day"
              type="date"
              className="lv-input"
              value={day}
              max={dayKey(new Date())}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
          {day && (
            <Button variant="ghost" size="sm" onClick={() => setDay("")}>
              Show all
            </Button>
          )}
        </div>
      </div>
      {state.error && (
        <p role="alert" className="m-0 text-sm text-danger">
          {state.error}
        </p>
      )}
      {groups.length === 0 ? (
        <EmptyState
          title={day ? "No sessions on that day" : "No sessions yet"}
          description={
            day ? "Pick another day, or show all." : "Your finished focus sessions are listed here."
          }
        />
      ) : (
        groups.map(([k, rows]) => (
          <div key={k}>
            <h3 className="m-0 text-sm font-semibold text-muted">
              {new Date(`${k}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {" · "}
              {duration(
                rows
                  .filter((r) => r.status !== "cancelled")
                  .reduce((a, r) => a + r.focusSeconds, 0),
              )}
            </h3>
            <ul className="m-0 list-none divide-y divide-line p-0">
              {rows.map((r) => (
                <Row key={r.id} r={r} waiting={waiting.has(r.id)} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
