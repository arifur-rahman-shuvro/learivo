import { useState } from "react";
import { Button, ProgressBar } from "../../../ui-kit/index.ts";
import { daysUntil, studyPlan, type ExamTarget } from "../domain/examTarget.ts";
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
    <div className="lv-card p-4">
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  );
}

export function ExamLine({
  exam,
  total,
  seen,
  today,
}: {
  exam: ExamTarget;
  total: number;
  seen: number;
  today: Date;
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
      <p className="m-0 mt-1 text-sm">
        {plan.perDay
          ? `${plan.unseen.toLocaleString()} of your ${total.toLocaleString()} questions are not practised yet. About ${plan.perDay} a day finishes them in time.`
          : `You have practised every question. Use the days left to revise your mistakes.`}
      </p>
      <ProgressBar value={plan.coverage} label="Questions practised at least once" />
    </>
  );
}
