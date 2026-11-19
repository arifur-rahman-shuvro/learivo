import { useGrown } from "../../../motion/index.ts";
import type { ActivityDay } from "../domain/insights.ts";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Cards due on each of the next days, so the student can see the week's revision load. */
export default function ForecastBars({ days }: { days: ActivityDay[] }) {
  const grown = useGrown();
  const max = Math.max(...days.map((d) => d.count), 1);
  const name = (d: ActivityDay, i: number) =>
    i === 0 ? "Today" : WEEKDAY[new Date(`${d.day}T00:00:00`).getDay()]!;
  const label = `Cards due in the next ${days.length} days: ${days
    .map((d, i) => `${name(d, i)} ${d.count}`)
    .join(", ")}.`;
  return (
    <figure className="m-0 flex flex-col gap-1">
      <div role="img" aria-label={label} className="flex items-end gap-2" style={{ height: 56 }}>
        {days.map((d, i) => (
          <div
            key={d.day}
            aria-hidden="true"
            className="flex-1 rounded-t-[6px]"
            style={{
              height: d.count === 0 ? 3 : `${grown ? (d.count / max) * 100 : 0}%`,
              transition: "height 600ms var(--lv-ease)",
              transitionDelay: `${i * 45}ms`,
              background: d.count === 0 ? "var(--lv-surface-3)" : "var(--lv-accent)",
              opacity: i === 0 ? 1 : 0.7,
            }}
          />
        ))}
      </div>
      <div aria-hidden="true" className="flex gap-2 text-center text-xs text-muted">
        {days.map((d, i) => (
          <span key={d.day} className={`flex-1 ${i === 0 ? "font-bold text-fg" : ""}`}>
            {name(d, i)}
          </span>
        ))}
      </div>
    </figure>
  );
}
