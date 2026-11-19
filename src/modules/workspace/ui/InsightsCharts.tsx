export function LineChart({
  points,
  label,
}: {
  points: { label: string; value: number }[];
  label: string;
}) {
  const W = 320;
  const H = 130;
  const pad = { l: 30, r: 8, t: 8, b: 20 };
  const x = (i: number) =>
    points.length === 1
      ? (pad.l + W - pad.r) / 2
      : pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1);
  const y = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--lv-border)"
              strokeWidth="1"
            />
            <text
              x={pad.l - 6}
              y={y(v) + 3}
              textAnchor="end"
              fontSize="9"
              fill="var(--lv-text-muted)"
            >
              {v}%
            </text>
          </g>
        ))}
        {points.length > 1 && (
          <path
            d={path}
            fill="none"
            stroke="var(--lv-accent)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r="3.5" fill="var(--lv-accent)" />
        ))}
        {[0, points.length - 1].map((i, k) =>
          points[i] && (k === 0 || points.length > 1) ? (
            <text
              key={k}
              x={x(i)}
              y={H - 4}
              textAnchor={k === 0 ? "start" : "end"}
              fontSize="9"
              fill="var(--lv-text-muted)"
            >
              {points[i]!.label}
            </text>
          ) : null,
        )}
      </svg>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer font-semibold">View as table</summary>
        <table className="mt-2 w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="border-b border-line py-1 pr-3 font-semibold">Date</th>
              <th className="border-b border-line py-1 font-semibold">Result</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td className="py-1 pr-3">{p.label}</td>
                <td className="py-1">{p.value}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
