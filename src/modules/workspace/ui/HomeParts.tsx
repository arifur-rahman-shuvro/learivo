import { useState } from "react";
import { Button, ProgressBar } from "../../../ui-kit/index.ts";
import { daysUntil, studyPlan, type ExamTarget } from "../domain/examTarget.ts";
import type { PlanDay } from "../domain/weekPlan.ts";
import { openBackup } from "../../../core/dialogs/backup.ts";
import { shouldRemindBackup, snoozeBackupReminder } from "../../../core/backupReminder.ts";

/** A quiet reminder to save a backup file when it has been a while. */
export function BackupNudge({ total }: { total: number }) {
  const [hidden, setHidden] = useState(false);
  if (hidden || !shouldRemindBackup(total)) return null;
  return (
    <section
      aria-label="Backup reminder"
      className="lv-card flex flex-wrap items-center justify-between gap-3 p-4"
    >
      <p className="m-0 min-w-0 flex-1 text-sm">
        <span className="font-semibold">Save a backup.</span> You have not saved one in a while, and
        your {total.toLocaleString()} questions are worth keeping safe.
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={openBackup}>
          Back up now
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            snoozeBackupReminder();
            setHidden(true);
          }}
        >
          Later
        </Button>
      </div>
    </section>
  );
}

export function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-1 py-3 text-center">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}

export function ExamLine({
  exam,
  total,
  seen,
  today,
  subjectNames = [],
}: {
  exam: ExamTarget;
  total: number;
  seen: number;
  today: Date;
  /** Names of the subjects the exam covers; empty means all of them. */
  subjectNames?: string[];
}) {
  const days = daysUntil(exam.date!, today);
  const name = exam.title || "Your exam";
  if (days < 0)
    return (
      <p className="m-0">
        {name} was {-days} day{days === -1 ? "" : "s"} ago.
      </p>
    );
  if (days === 0) return <p className="m-0 text-xl font-bold">{name} is today.</p>;
  const plan = studyPlan(total, seen, days);
  return (
    <>
      <p className="m-0 text-3xl font-bold">
        {days} day{days === 1 ? "" : "s"}
      </p>
      <p className="m-0 text-sm text-muted">until {name}.</p>
      {subjectNames.length > 0 && (
        <p className="m-0 text-sm text-muted">Subjects: {subjectNames.join(", ")}.</p>
      )}
      <p className="m-0 mt-1 text-sm">
        {plan.perDay
          ? `${plan.unseen.toLocaleString()} of your ${total.toLocaleString()} questions ${subjectNames.length > 0 ? "in these subjects " : ""}are not practised yet. About ${plan.perDay} a day finishes them in time.`
          : `You have practised every question. Use the days left to revise your mistakes.`}
      </p>
      <ProgressBar value={plan.coverage} label="Questions practised at least once" />
    </>
  );
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The days up to the exam as a small calendar: new questions and revision for each day. */
export function WeekPlan({ days }: { days: PlanDay[] }) {
  if (days.length === 0) return null;
  const weekday = (day: string) => WEEKDAY[new Date(`${day}T00:00:00`).getDay()]!;
  return (
    <section aria-label="Study calendar" className="mt-2 flex flex-col gap-2">
      <h3 className="m-0 text-sm font-semibold">Your days until the exam</h3>
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-2 p-0">
        {days.map((d, i) => (
          <li
            key={d.day}
            aria-label={`${i === 0 ? "Today" : weekday(d.day)} ${d.day}: ${
              d.kind === "exam"
                ? "exam day"
                : `${d.fresh} new, ${d.revise} to revise${d.kind === "light" ? ", revision day" : ""}`
            }`}
            className={`flex flex-col gap-0.5 rounded-control border p-2 text-xs ${
              d.kind === "exam" ? "border-accent bg-surface-2" : "border-line"
            }`}
          >
            <span className={`font-bold ${i === 0 ? "text-fg" : "text-muted"}`}>
              {i === 0 ? "Today" : weekday(d.day)} {Number(d.day.slice(8))}
            </span>
            {d.kind === "exam" ? (
              <span className="font-semibold">Exam</span>
            ) : (
              <>
                <span>{d.fresh > 0 ? `${d.fresh} new` : "No new"}</span>
                <span className="text-muted">
                  {d.revise > 0 ? `${d.revise} to revise` : "Nothing due"}
                </span>
                {d.kind === "light" && <span className="text-muted">Revise only</span>}
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
