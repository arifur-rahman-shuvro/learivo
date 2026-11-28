import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Button, Dialog, PageHeader } from "../../../ui-kit/index.ts";
import type { GameProps } from "../types.ts";
import { buzz, Sound } from "./audio.ts";
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  MODES,
  MODE_ORDER,
  type Difficulty,
  type ModeId,
} from "./config.ts";
import { CricketEngine, type GameEvent } from "./engine.ts";
import { describe as describeOutcome } from "./fielding.ts";
import { chaseVerdict, overs, verdict } from "./match.ts";
import { H, W, draw } from "./render.ts";
import {
  loadBest,
  loadSettings,
  saveBest,
  saveSettings,
  type Quality,
  type Settings,
} from "./storage.ts";
import { TIMING_WORD } from "./timing.ts";
import "./cricket.css";

/** Home, How to play, Settings and the match itself. All the cricket lives in engine.ts and fielding.ts. */
export default function Cricket({ onExit, onFinish }: GameProps) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<"home" | "match">("home");
  const [matchId, setMatchId] = useState(0);
  const [panel, setPanel] = useState<"help" | "settings" | null>(null);
  const sound = useRef<Sound | null>(null);
  if (!sound.current) sound.current = new Sound(settings.sound);

  useEffect(() => () => sound.current?.dispose(), []);

  const change = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      sound.current?.setEnabled(next.sound);
      return next;
    });
  }, []);

  function play() {
    sound.current?.unlock();
    sound.current?.play("click");
    setMatchId((n) => n + 1);
    setScreen("match");
  }

  if (screen === "match") {
    return (
      <Match
        key={matchId}
        mode={settings.mode}
        difficulty={settings.difficulty}
        settings={settings}
        sound={sound.current}
        onMenu={() => setScreen("home")}
        onAgain={() => setMatchId((n) => n + 1)}
        onExit={onExit}
        onFinish={onFinish}
      />
    );
  }

  const best = loadBest(settings.mode, settings.difficulty);
  return (
    <div className="cri-wrap flex flex-col gap-4">
      <PageHeader title="Mini cricket" onBack={onExit} backLabel="Break Room" />
      <div className="cri-hero" aria-hidden>
        <div className="cri-hero-rope" />
        <div className="cri-hero-pitch" />
        <div className="cri-hero-ball" />
      </div>
      <p className="m-0 text-center text-muted">One tap. Time it right. Hit it big.</p>

      <Segmented
        label="Game mode"
        value={settings.mode}
        options={MODE_ORDER.map((m) => ({ value: m, label: MODES[m].label, hint: MODES[m].blurb }))}
        onChange={(m) => change({ mode: m })}
        stacked
      />
      <Segmented
        label="Difficulty"
        value={settings.difficulty}
        options={DIFFICULTY_ORDER.map((d) => ({ value: d, label: DIFFICULTIES[d].label }))}
        onChange={(d) => change({ difficulty: d })}
      />
      <p className="m-0 text-center text-sm text-muted" data-testid="best">
        {best > 0 ? `Your best here: ${best}` : "No best score yet"}
      </p>

      <Button size="lg" onClick={play}>
        Play
      </Button>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" onClick={() => setPanel("help")}>
          How to play
        </Button>
        <Button variant="secondary" onClick={() => setPanel("settings")}>
          Settings
        </Button>
        <Button
          variant="secondary"
          aria-pressed={settings.sound}
          onClick={() => {
            sound.current?.unlock();
            change({ sound: !settings.sound });
          }}
        >
          Sound: {settings.sound ? "on" : "off"}
        </Button>
      </div>

      <Dialog
        open={panel === "help"}
        title="How to play"
        onClose={() => setPanel(null)}
        variant="modal"
      >
        <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
          <li>
            The bowler runs in and bowls by himself. Tap anywhere on the pitch as the ball reaches
            the dashed ring.
          </li>
          <li>The closer your timing, the stronger the shot: PERFECT, GOOD, AVERAGE or POOR.</li>
          <li>
            Dead on the ring goes high and straight for six. A little early is driven along the
            ground to the left; a little late is lofted to the right.
          </li>
          <li>Tap to the left or right of the screen to aim the ball a little that way.</li>
          <li>
            Fielders chase the ball. A high shot that lands near a fielder can be caught. Runs
            depend on where the ball goes and who stops it.
          </li>
          <li>Miss the ball and you can be bowled. Do not swing at all and you are bowled.</li>
        </ul>
      </Dialog>
      <Dialog
        open={panel === "settings"}
        title="Settings"
        onClose={() => setPanel(null)}
        variant="modal"
      >
        <div className="flex flex-col gap-4">
          <Segmented
            label="Sound"
            value={settings.sound ? "on" : "off"}
            options={[
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
            ]}
            onChange={(v) => change({ sound: v === "on" })}
          />
          <Segmented
            label="Vibration"
            value={settings.vibration ? "on" : "off"}
            options={[
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
            ]}
            onChange={(v) => change({ vibration: v === "on" })}
          />
          <Segmented<Quality>
            label="Animation quality"
            value={settings.quality}
            options={[
              { value: "high", label: "High" },
              { value: "low", label: "Low (saves battery)" },
            ]}
            onChange={(q) => change({ quality: q })}
          />
          <Segmented
            label="Difficulty"
            value={settings.difficulty}
            options={DIFFICULTY_ORDER.map((d) => ({
              value: d,
              label: DIFFICULTIES[d].label,
              hint: DIFFICULTIES[d].blurb,
            }))}
            onChange={(d) => change({ difficulty: d })}
            stacked
          />
        </div>
      </Dialog>
    </div>
  );
}

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  stacked,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  stacked?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <div className={`flex gap-2 ${stacked ? "flex-col" : ""}`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className="cri-seg"
          >
            <span className="font-semibold">{o.label}</span>
            {o.hint && <span className="text-xs text-muted">{o.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

interface MatchProps {
  mode: ModeId;
  difficulty: Difficulty;
  settings: Settings;
  sound: Sound;
  onMenu: () => void;
  onAgain: () => void;
  onExit: () => void;
  onFinish: GameProps["onFinish"];
}

function Match({
  mode,
  difficulty,
  settings,
  sound,
  onMenu,
  onAgain,
  onExit,
  onFinish,
}: MatchProps) {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const startedAt = useRef(Date.now());
  const reported = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [newBest, setNewBest] = useState(false);

  const [engine] = useState(
    () =>
      new CricketEngine({
        mode,
        difficulty,
        onEvent: (e: GameEvent) => {
          const vib = settingsRef.current.vibration;
          switch (e) {
            case "deliver":
              sound.play("bowl");
              break;
            case "hit":
              if (engine.outcome?.flight) {
                sound.play("hit");
                buzz(20, vib);
              }
              break;
            case "four":
              sound.play("four");
              buzz(40, vib);
              break;
            case "six":
              sound.play("six");
              buzz([40, 30, 60], vib);
              break;
            case "wicket":
              sound.play("wicket");
              buzz(90, vib);
              break;
          }
        },
      }),
  );
  useSyncExternalStore(engine.subscribe.bind(engine), () => engine.version);

  // Start, and run the frame loop.
  useEffect(() => {
    engine.start();
    sound.startCrowd();
    const cv = canvas.current;
    const ctx = cv?.getContext("2d") ?? null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv) {
      cv.width = W * dpr;
      cv.height = H * dpr;
    }
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf = 0;
    const frame = () => {
      engine.update();
      if (ctx) draw(ctx, engine.view(), settingsRef.current.quality, Date.now());
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      sound.stopCrowd();
    };
  }, [engine, sound]);

  // A hidden tab pauses the match so nothing is lost.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") engine.pause();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [engine]);

  const phase = engine.phase;
  const tally = engine.tally;

  // Report the finished innings once and keep the best score.
  useEffect(() => {
    if (phase !== "over" || reported.current) return;
    reported.current = true;
    setNewBest(saveBest(mode, difficulty, tally.runs));
    finishRef.current({
      gameId: "cricket",
      score: tally.runs,
      durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
      finishedAt: new Date().toISOString(),
    });
  }, [phase, mode, difficulty, tally.runs]);

  function tap(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const aim = r.width > 0 ? ((e.clientX - r.left) / r.width - 0.5) * 2 : 0;
    engine.swing(aim);
  }
  function key(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      engine.swing(0);
    } else if (e.key === "Escape" || e.key === "p") {
      e.preventDefault();
      engine.pause();
    }
  }

  const m = MODES[mode];
  const o = engine.outcome;
  const showFeedback = o !== null && (phase === "play" || phase === "result" || phase === "swung");
  const status =
    phase === "ready"
      ? "Get ready…"
      : phase === "bowling"
        ? "Swing now!"
        : phase === "result" && o
          ? describeOutcome(o)
          : phase === "paused"
            ? "Paused"
            : "";
  const detail =
    o && engine.offsetMs !== null && o.timing !== "miss"
      ? `${Math.round(Math.abs(engine.offsetMs))} ms ${engine.offsetMs < 0 ? "early" : "late"}`
      : "";
  const best = loadBest(mode, difficulty);
  const last = tally.results.slice(-6);

  if (phase === "over") {
    return (
      <div className="cri-wrap flex flex-col gap-4">
        <PageHeader title="Innings over" />
        <div className="lv-card flex flex-col items-center gap-2 p-5 text-center">
          <p role="status" className="m-0 text-5xl font-bold tabular-nums" data-testid="final">
            {tally.runs} runs
          </p>
          <p className="m-0 text-lg font-semibold" data-testid="verdict">
            {engine.target !== null
              ? chaseVerdict(tally, engine.target)
              : verdict(tally.runs, mode)}
          </p>
          <p className="m-0 text-sm text-muted">
            {tally.balls} balls, {tally.wickets} {tally.wickets === 1 ? "wicket" : "wickets"} lost
          </p>
          <p className="m-0 text-sm text-muted" data-testid="best-final">
            {newBest ? "New best score!" : `Best: ${Math.max(best, tally.runs)}`} ({m.label},{" "}
            {DIFFICULTIES[difficulty].label})
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button onClick={onAgain}>Play again</Button>
            <Button variant="secondary" onClick={onMenu}>
              Home
            </Button>
            <Button variant="secondary" onClick={onExit}>
              Back to Break Room
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cri-wrap flex flex-col gap-3">
      <div className="cri-hud lv-card">
        <div className="flex flex-col">
          <span className="text-3xl font-bold leading-none tabular-nums">
            <span data-testid="runs">{tally.runs}</span>/
            <span data-testid="wickets">{tally.wickets}</span>
          </span>
          <span className="text-xs text-muted">{m.label}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-lg font-semibold tabular-nums" data-testid="balls">
            {m.balls === Infinity ? `Balls ${tally.balls}` : `${tally.balls}/${m.balls} balls`}
          </span>
          <span className="text-xs text-muted" data-testid="need">
            {engine.target !== null
              ? `Target ${engine.target}, need ${Math.max(0, engine.target - tally.runs)}`
              : `${overs(tally.balls)} ov`}
          </span>
        </div>
        <ol className="cri-chips" aria-label="Recent balls" data-testid="chips">
          {last.map((r, i) => (
            <li
              key={i}
              className={r.out ? "cri-chip cri-out" : r.runs >= 4 ? "cri-chip cri-big" : "cri-chip"}
            >
              {r.out ? "W" : r.runs === 0 ? "•" : r.runs}
            </li>
          ))}
        </ol>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => engine.pause()}
          disabled={phase === "paused"}
        >
          Pause
        </Button>
      </div>

      <div
        className="cri-stage"
        role="button"
        tabIndex={0}
        aria-label="Swing the bat. Tap anywhere on the pitch as the ball reaches the ring."
        onPointerDown={tap}
        onKeyDown={key}
      >
        <canvas ref={canvas} className="cri-canvas" width={W} height={H} aria-hidden />
        {showFeedback && o && (
          <div
            className="cri-feedback"
            aria-hidden
            data-testid="feedback"
            key={tally.balls + String(phase === "result")}
          >
            <span className="cri-word">{TIMING_WORD[o.timing]}</span>
            {detail && <span className="cri-detail">{detail}</span>}
            {phase === "result" && (
              <span className={`cri-label ${o.out ? "cri-label-out" : ""}`}>
                {o.out ? `OUT! ${o.label}` : o.label}
              </span>
            )}
          </div>
        )}
        {phase === "paused" && (
          <div className="cri-pause" role="dialog" aria-label="Paused">
            <p className="m-0 text-2xl font-bold">Paused</p>
            <Button autoFocus onClick={() => engine.resume()}>
              Resume
            </Button>
            <Button variant="secondary" onClick={onAgain}>
              Restart
            </Button>
            <Button variant="secondary" onClick={onMenu}>
              Home
            </Button>
            <Button variant="secondary" onClick={onExit}>
              Back to Break Room
            </Button>
          </div>
        )}
      </div>
      <p
        role="status"
        aria-live="polite"
        className="m-0 text-center text-lg font-semibold"
        data-testid="status"
      >
        {status}
      </p>
      <p className="m-0 text-center text-xs text-muted">
        Tap as the ball reaches the ring. Tap left or right to aim.
      </p>
    </div>
  );
}
