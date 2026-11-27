import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Button, PageHeader } from "../../../ui-kit/index.ts";
import type { GameProps } from "../types.ts";
import {
  BALLS,
  WICKETS,
  WINDOWS,
  innings,
  judge,
  newBall,
  verdict,
  type BallPlan,
  type Result,
} from "./rules.ts";
import "./cricket.css";

type Phase = "idle" | "wait" | "bowl" | "result" | "done";

const BEST_KEY = "learivo.cricket.best";
/** After the ball has passed by this much and no swing came, it counts as not swinging. */
const GIVE_UP_MS = WINDOWS.edge + 25;

function readBest(): number {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0; // storage can be blocked; the game works without it
  }
}
function saveBest(n: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* ignore */
  }
}

/** Where the ball flies after a shot, in percent of the field. */
function flight(r: Result): { x: number; y: number; s: number } {
  const dir = r.side === "leg" ? -1 : r.side === "off" ? 1 : 0;
  switch (r.kind) {
    case "six":
      return { x: 50 + dir * 30, y: -15, s: 2.4 };
    case "four":
      return { x: 50 + (dir || 1) * 46, y: 34, s: 0.9 };
    case "two":
      return { x: 50 + (dir || 1) * 32, y: 52, s: 0.9 };
    case "single":
    case "caught":
      return { x: 50 + (dir || 1) * 18, y: 62, s: 0.9 };
    default:
      return { x: 50, y: 100, s: 2 };
  }
}

export default function Cricket({ onExit, onFinish }: GameProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<Result[]>([]);
  const [plan, setPlan] = useState<BallPlan | null>(null);
  const [shown, setShown] = useState<Result | null>(null);
  const [swung, setSwung] = useState(false);
  const [best, setBest] = useState(readBest);
  const arriveAt = useRef(0);
  const startedAt = useRef(Date.now());
  const reported = useRef(false);

  const inn = innings(results);

  const bowlNext = useCallback((count: number) => {
    setPlan(newBall(count, Math.random));
    setShown(null);
    setSwung(false);
    setPhase("wait");
  }, []);

  // The bowler waits a moment, then lets the ball go.
  useEffect(() => {
    if (phase !== "wait" || !plan) return;
    const t = window.setTimeout(() => {
      arriveAt.current = Date.now() + plan.speedMs;
      setPhase("bowl");
    }, plan.delayMs);
    return () => window.clearTimeout(t);
  }, [phase, plan]);

  const resolve = useCallback((offset: number | null) => {
    const r = judge(offset, Math.random);
    setResults((rs) => [...rs, r]);
    setShown(r);
    setPhase("result");
  }, []);

  // No swing at all: the ball goes by and the batter is bowled.
  useEffect(() => {
    if (phase !== "bowl" || !plan) return;
    const t = window.setTimeout(() => resolve(null), plan.speedMs + GIVE_UP_MS);
    return () => window.clearTimeout(t);
  }, [phase, plan, resolve]);

  // If the tab is hidden the clock keeps running, which would be unfair: bowl that ball again later.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        setPhase((p) => {
          if (p === "wait" || p === "bowl") {
            setPlan(newBall(results.length, Math.random));
            setSwung(false);
            return "wait";
          }
          return p;
        });
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [results.length]);

  // The innings is over once; report it once and keep the best score.
  useEffect(() => {
    if (phase !== "done" || reported.current) return;
    reported.current = true;
    if (inn.runs > best) {
      setBest(inn.runs);
      saveBest(inn.runs);
    }
    onFinish({
      gameId: "cricket",
      score: inn.runs,
      durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
      finishedAt: new Date().toISOString(),
    });
  }, [phase, inn.runs, best, onFinish]);

  function swing() {
    if (phase !== "bowl" || swung) return;
    setSwung(true);
    resolve(Date.now() - arriveAt.current);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      swing();
    }
  }

  function next() {
    if (inn.over) setPhase("done");
    else bowlNext(results.length);
  }

  function again() {
    setResults([]);
    reported.current = false;
    startedAt.current = Date.now();
    bowlNext(0);
  }

  const hit =
    shown &&
    shown.runs + (shown.kind === "single" ? 0 : 0) >= 0 &&
    !["bowled", "dot"].includes(shown.kind);
  const f = shown ? flight(shown) : null;
  const ballMode = phase === "bowl" ? "bowl" : phase === "result" ? (hit ? "hit" : "miss") : "off";
  const fieldStyle = {
    "--dur": `${plan?.speedMs ?? 1000}ms`,
    "--hx": `${f?.x ?? 50}%`,
    "--hy": `${f?.y ?? 50}%`,
    "--hs": `${f?.s ?? 1}`,
  } as CSSProperties;

  if (phase === "done") {
    const isBest = inn.runs > 0 && inn.runs >= best;
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Mini cricket" onBack={onExit} backLabel="Break Room" />
        <div className="lv-card flex flex-col items-center gap-2 p-5 text-center">
          <p role="status" className="m-0 text-4xl font-bold" data-testid="final">
            {inn.runs} runs
          </p>
          <p className="m-0 text-lg font-semibold">{verdict(inn.runs)}</p>
          <p className="m-0 text-sm text-muted">
            {inn.wickets} out, {inn.balls} balls.{" "}
            {isBest ? "New best on this phone!" : `Best on this phone: ${best}`}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button onClick={again}>Play again</Button>
            <Button variant="secondary" onClick={onExit}>
              Back to Break Room
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const statusText =
    phase === "idle"
      ? "Six balls, two wickets. Swing when the ball reaches the ring."
      : phase === "wait"
        ? "Get ready…"
        : phase === "bowl"
          ? "Swing now!"
          : (shown?.label ?? "");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Mini cricket"
        help="Time your swing. The closer to the ring, the bigger the shot."
        onBack={onExit}
        backLabel="Break Room"
      />

      <div className="lv-card flex items-center justify-between gap-3 p-3">
        <div className="flex flex-col">
          <span className="text-3xl font-bold tabular-nums" data-testid="runs">
            {inn.runs}
          </span>
          <span className="text-xs text-muted">
            runs, <span data-testid="wickets">{inn.wickets}</span>/{WICKETS} out
          </span>
        </div>
        <ol className="m-0 flex list-none gap-1.5 p-0" aria-label="Balls">
          {Array.from({ length: BALLS }, (_, i) => {
            const r = results[i];
            return (
              <li
                key={i}
                className={`grid h-8 w-8 place-items-center rounded-full border-2 text-sm font-bold ${
                  !r
                    ? "border-line"
                    : r.out
                      ? "border-danger text-danger"
                      : r.runs >= 4
                        ? "border-accent bg-accent text-on-accent"
                        : "border-line"
                }`}
              >
                {r ? (r.out ? "W" : r.runs === 0 ? "•" : r.runs) : ""}
              </li>
            );
          })}
        </ol>
      </div>

      <button
        type="button"
        className="cri-field"
        style={fieldStyle}
        data-swing={swung}
        aria-label={phase === "bowl" ? "Swing the bat now" : "Swing the bat"}
        onPointerDown={(e) => {
          e.preventDefault();
          swing();
        }}
        onKeyDown={onKey}
      >
        <div className="cri-pitch" />
        <div className="cri-stumps" />
        <div className="cri-bowler" />
        <div className="cri-ring" />
        <div className="cri-batter" aria-hidden>
          <div className="cri-bat" />
        </div>
        <div
          key={`${results.length}-${phase}`}
          className="cri-ball"
          data-mode={ballMode}
          aria-hidden
        />
      </button>

      <div className="flex flex-col items-center gap-3">
        <p
          role="status"
          aria-live="polite"
          className={`m-0 text-center ${phase === "result" ? "text-2xl font-bold" : "text-lg font-semibold"}`}
          data-testid="status"
        >
          {statusText}
        </p>
        {phase === "idle" && <Button onClick={() => bowlNext(0)}>Start</Button>}
        {phase === "result" && (
          <Button onClick={next}>{inn.over ? "See score" : "Next ball"}</Button>
        )}
      </div>
    </div>
  );
}
