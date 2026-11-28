import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Button, Dialog, PageHeader } from "../../../ui-kit/index.ts";
import type { GameProps } from "../types.ts";
import { buzz, Sound } from "./audio.ts";
import {
  BEST_OF,
  LEVELS,
  LEVEL_ORDER,
  TARGETS,
  THEMES,
  THEME_ORDER,
  type Level,
  type Mode,
  type PracticeSpeed,
  type Rules,
  type ThemeId,
} from "./config.ts";
import { KEY_SPEED, Touches } from "./controls.ts";
import { Game, type GameEvent, type View } from "./game.ts";
import { H, W, draw, tableX } from "./render.ts";
import {
  loadRecord,
  loadSettings,
  recordMatch,
  resetRecord,
  saveSettings,
  type Quality,
  type Records,
  type Settings,
} from "./storage.ts";
import "./pingpong.css";

const MODE_INFO: Record<Mode, { label: string; hint: string }> = {
  ai: { label: "Vs Computer", hint: "One thumb, four levels" },
  local: { label: "2 Players", hint: "Share the phone, one thumb each" },
  practice: { label: "Practice", hint: "Rally against the wall, no score" },
};
const MODE_ORDER: readonly Mode[] = ["ai", "local", "practice"];

/** Home, Statistics, How to play, Settings and the match. The game itself lives in game.ts. */
export default function PingPong({ onExit, onFinish }: GameProps) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<"home" | "match">("home");
  const [matchId, setMatchId] = useState(0);
  const [panel, setPanel] = useState<"help" | "settings" | "stats" | null>(null);
  const sound = useRef<Sound | null>(null);
  if (!sound.current) sound.current = new Sound(settings.sound, settings.volume);

  useEffect(() => () => sound.current?.dispose(), []);

  const change = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      sound.current?.setEnabled(next.sound);
      sound.current?.setVolume(next.volume);
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
        settings={settings}
        sound={sound.current}
        change={change}
        onMenu={() => setScreen("home")}
        onAgain={() => setMatchId((n) => n + 1)}
        onExit={onExit}
        onFinish={onFinish}
      />
    );
  }

  const m = settings.mode;
  return (
    <div className="pp-wrap flex flex-col gap-4">
      <PageHeader title="Mini table tennis" onBack={onExit} backLabel="Break Room" />
      <div className="pp-hero" aria-hidden>
        <div className="pp-hero-table">
          <div className="pp-hero-net" />
          <div className="pp-hero-paddle pp-hero-top" />
          <div className="pp-hero-paddle pp-hero-bottom" />
          <div className="pp-hero-ball" />
        </div>
      </div>
      <p className="m-0 text-center text-muted">Slide your paddle. Hit the middle. Win by two.</p>

      <Segmented<Mode>
        label="Game mode"
        value={m}
        options={MODE_ORDER.map((x) => ({
          value: x,
          label: MODE_INFO[x].label,
          hint: MODE_INFO[x].hint,
        }))}
        onChange={(x) => change({ mode: x })}
      />
      {m === "ai" && (
        <Segmented<Level>
          label="Computer level"
          value={settings.level}
          options={LEVEL_ORDER.map((l) => ({ value: l, label: LEVELS[l].label }))}
          onChange={(l) => change({ level: l })}
          hint={LEVELS[settings.level].blurb}
        />
      )}
      {m === "practice" && (
        <Segmented<PracticeSpeed>
          label="Ball speed"
          value={settings.practiceSpeed}
          options={[
            { value: "slow", label: "Slow" },
            { value: "normal", label: "Normal" },
            { value: "fast", label: "Fast" },
          ]}
          onChange={(s) => change({ practiceSpeed: s })}
        />
      )}
      {m !== "practice" && (
        <>
          <Segmented<string>
            label="First to"
            value={String(settings.target)}
            options={TARGETS.map((t) => ({ value: String(t), label: String(t) }))}
            onChange={(t) => change({ target: Number(t) as Rules["target"] })}
          />
          <Segmented<string>
            label="Match"
            value={String(settings.bestOf)}
            options={BEST_OF.map((b) => ({
              value: String(b),
              label: b === 1 ? "Single set" : `Best of ${b}`,
            }))}
            onChange={(b) => change({ bestOf: Number(b) as Rules["bestOf"] })}
          />
        </>
      )}

      <Button size="lg" onClick={play}>
        Play
      </Button>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" onClick={() => setPanel("stats")}>
          Statistics
        </Button>
        <Button variant="secondary" onClick={() => setPanel("help")}>
          How to play
        </Button>
        <Button variant="secondary" onClick={() => setPanel("settings")}>
          Settings
        </Button>
      </div>

      <Dialog
        open={panel === "help"}
        title="How to play"
        onClose={() => setPanel(null)}
        variant="modal"
      >
        <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
          <li>Slide a finger left and right to move your paddle. Your paddle is at the bottom.</li>
          <li>Return the ball. If it gets past your paddle, your opponent scores.</li>
          <li>
            Hit with the middle of the paddle for a perfect hit: faster and straighter. Hit near the
            edge to send the ball sideways. Move the paddle fast as you hit for a smash.
          </li>
          <li>The ball speeds up every hit. A long rally gets quick, so stay centred.</li>
          <li>
            First to 11 wins, and you must win by two points. Deuce means both are one point away.
          </li>
          <li>
            2 Players: the lower half of the screen is player 1 and the upper half is player 2. Each
            finger keeps its own paddle, so you can both play at once.
          </li>
          <li>On a keyboard use the left and right arrows (player 1) and A and D (player 2).</li>
        </ul>
      </Dialog>
      <Dialog
        open={panel === "settings"}
        title="Settings"
        onClose={() => setPanel(null)}
        variant="modal"
      >
        <SettingsForm settings={settings} change={change} />
      </Dialog>
      <Dialog
        open={panel === "stats"}
        title="Statistics"
        onClose={() => setPanel(null)}
        variant="modal"
      >
        {panel === "stats" && <StatsView />}
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
  hint,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  stacked?: boolean;
  hint?: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <div className={`flex flex-wrap gap-2 ${stacked ? "flex-col" : ""}`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className="pp-seg"
          >
            <span className="font-semibold">{o.label}</span>
            {o.hint && <span className="text-xs text-muted">{o.hint}</span>}
          </button>
        ))}
      </div>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

function SettingsForm({
  settings,
  change,
}: {
  settings: Settings;
  change: (p: Partial<Settings>) => void;
}) {
  const onOff = (v: boolean) => (v ? "on" : "off");
  const toggles = [
    { value: "on", label: "On" },
    { value: "off", label: "Off" },
  ];
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Sound"
        value={onOff(settings.sound)}
        options={toggles}
        onChange={(v) => change({ sound: v === "on" })}
      />
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Volume: {Math.round(settings.volume * 100)}%
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(settings.volume * 100)}
          aria-label="Volume"
          onChange={(e) => change({ volume: Number(e.target.value) / 100 })}
        />
      </label>
      <Segmented
        label="Vibration"
        value={onOff(settings.vibration)}
        options={toggles}
        onChange={(v) => change({ vibration: v === "on" })}
      />
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Paddle sensitivity: {settings.sensitivity.toFixed(2)}
        <input
          type="range"
          min={90}
          max={150}
          step={5}
          value={Math.round(settings.sensitivity * 100)}
          aria-label="Paddle sensitivity"
          onChange={(e) => change({ sensitivity: Number(e.target.value) / 100 })}
        />
        <span className="text-xs font-normal text-muted">
          Higher means a short slide moves the paddle further.
        </span>
      </label>
      <Segmented<ThemeId>
        label="Table colours"
        value={settings.theme}
        options={THEME_ORDER.map((t) => ({ value: t, label: THEMES[t]!.label }))}
        onChange={(t) => change({ theme: t })}
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
    </div>
  );
}

function StatsView() {
  const [rec, setRec] = useState<Records>(loadRecord);
  const [sure, setSure] = useState(false);
  const mins = Math.floor(rec.seconds / 60);
  return (
    <div className="flex flex-col gap-3" data-testid="stats">
      <table className="pp-table">
        <caption className="text-left text-sm font-semibold">Against the computer</caption>
        <thead>
          <tr>
            <th scope="col">Level</th>
            <th scope="col">Won</th>
            <th scope="col">Lost</th>
          </tr>
        </thead>
        <tbody>
          {LEVEL_ORDER.map((l) => (
            <tr key={l}>
              <th scope="row">{LEVELS[l].label}</th>
              <td data-testid={`won-${l}`}>{rec.ai[l].won}</td>
              <td data-testid={`lost-${l}`}>{rec.ai[l].lost}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="pp-facts m-0">
        <dt>2 Player matches</dt>
        <dd data-testid="local-matches">{rec.localMatches}</dd>
        <dt>Longest rally</dt>
        <dd data-testid="longest">{rec.longestRally}</dd>
        <dt>Best practice rally</dt>
        <dd data-testid="practice-rally">{rec.practiceRally}</dd>
        <dt>Points scored</dt>
        <dd>{rec.points}</dd>
        <dt>Paddle hits</dt>
        <dd>{rec.hits}</dd>
        <dt>Perfect hits</dt>
        <dd>{rec.perfect}</dd>
        <dt>Smashes</dt>
        <dd>{rec.smashes}</dd>
        <dt>Time played</dt>
        <dd>{mins} min</dd>
      </dl>
      <Button
        variant="secondary"
        onClick={() => {
          if (!sure) return setSure(true);
          resetRecord();
          setRec(loadRecord());
          setSure(false);
        }}
      >
        {sure ? "Tap again to erase" : "Reset statistics"}
      </Button>
    </div>
  );
}

interface MatchProps {
  settings: Settings;
  sound: Sound;
  change: (p: Partial<Settings>) => void;
  onMenu: () => void;
  onAgain: () => void;
  onExit: () => void;
  onFinish: GameProps["onFinish"];
}

const names = (mode: Mode): [string, string] =>
  mode === "local"
    ? ["Player 1", "Player 2"]
    : mode === "practice"
      ? ["You", "Wall"]
      : ["You", "Computer"];

function Match({ settings, sound, change, onMenu, onAgain, onExit, onFinish }: MatchProps) {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const startedAt = useRef(Date.now());
  const recorded = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [, redraw] = useState(0);
  const [panel, setPanel] = useState(false);
  const [, setSaved] = useState<Records | null>(null);
  const mode = settings.mode;
  const rules: Rules = { target: settings.target, winBy: 2, bestOf: settings.bestOf };

  const [game] = useState(
    () =>
      new Game({
        mode,
        rules,
        level: settings.level,
        practiceSpeed: settings.practiceSpeed,
        onEvent: (e: GameEvent) => {
          const vib = settingsRef.current.vibration;
          switch (e.type) {
            case "tick":
              sound.play("tick");
              break;
            case "serve":
              sound.play("go");
              break;
            case "hit":
              sound.play(e.hit.smash ? "smash" : e.hit.perfect ? "perfect" : "hit");
              buzz(e.hit.smash ? 30 : 12, vib);
              break;
            case "wall":
              sound.play("wall");
              break;
            case "pause":
            case "resume":
              redraw((n) => n + 1); // the pause screen should not wait for the next frame
              break;
            case "point":
              sound.play(e.winner === 1 && mode === "ai" ? "lose" : "point");
              break;
            case "matchEnd":
              sound.play(e.winner === 1 && mode === "ai" ? "lose" : "win");
              buzz([40, 40, 80], vib);
              break;
          }
        },
      }),
  );
  const touches = useRef(new Touches(mode === "local" ? "split" : "single"));
  touches.current.sensitivity = settings.sensitivity;
  const keys = useRef(new Set<string>());

  // Start, and run the frame loop. The game keeps its own time; we only feed it the gap between frames.
  useEffect(() => {
    game.start();
    const cv = canvas.current;
    const ctx = cv?.getContext("2d") ?? null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv) {
      cv.width = W * dpr;
      cv.height = H * dpr;
    }
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf = 0;
    let last = Date.now();
    let shown = "";
    const frame = () => {
      const now = Date.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const k = keys.current;
      if (game.phase !== "paused") {
        const step = KEY_SPEED * dt;
        if (k.has("ArrowLeft")) game.nudge(0, -step);
        if (k.has("ArrowRight")) game.nudge(0, step);
        if (mode === "local") {
          if (k.has("a")) game.nudge(1, -step);
          if (k.has("d")) game.nudge(1, step);
        }
      }
      game.advance(dt);
      const v = game.view();
      const st = stage.current;
      if (st) {
        // Where the paddles are, for tests and assistive tools; cheap to keep up to date.
        st.dataset.p0 = v.paddles[0].toFixed(3);
        st.dataset.p1 = v.paddles[1].toFixed(3);
      }
      if (ctx) draw(ctx, v, THEMES[settingsRef.current.theme]!, settingsRef.current.quality, now);
      // The page text only changes with the phase and the score, so it only re-renders then.
      const sig = `${v.phase}|${v.score.points}|${v.score.sets}|${v.matchPoint}|${v.deuce}|${game.version}`;
      if (sig !== shown) {
        shown = sig;
        redraw((n) => n + 1);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [game, mode]);

  // Losing the screen, or the window, pauses the match so nothing is lost.
  useEffect(() => {
    const pause = () => {
      touches.current.clear();
      keys.current.clear();
      game.pause();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") pause();
    };
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === "Escape" || key === "p") {
        if (game.phase === "paused") game.resume();
        else game.pause();
        return;
      }
      if (["ArrowLeft", "ArrowRight", "a", "d"].includes(key)) {
        e.preventDefault();
        keys.current.add(key);
      }
    };
    const up = (e: KeyboardEvent) =>
      keys.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", pause);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", pause);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [game]);

  const view: View = game.view();
  const phase = view.phase;

  // Match over: keep the records and tell the games hub, once.
  useEffect(() => {
    if (phase !== "matchComplete" || recorded.current) return;
    recorded.current = true;
    const s = game.stats;
    const mine = s.players[0];
    setSaved(
      recordMatch({
        mode,
        level: settingsRef.current.level,
        won: game.winner === 0,
        longestRally: s.longestRally,
        hits: s.players[0].hits + s.players[1].hits,
        perfect: s.players[0].perfect + s.players[1].perfect,
        smashes: s.players[0].smashes + s.players[1].smashes,
        points: s.players[0].points + s.players[1].points,
        seconds: s.seconds,
      }),
    );
    finishRef.current({
      gameId: "pingpong",
      score: mine.points,
      durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
      finishedAt: new Date().toISOString(),
    });
  }, [phase, game, mode]);

  // Practice has no end, so what was played is kept when the player leaves.
  useEffect(
    () => () => {
      if (mode !== "practice" || recorded.current) return;
      const s = game.stats;
      if (s.players[0].hits === 0) return;
      recorded.current = true;
      recordMatch({
        mode,
        level: "normal",
        won: false,
        longestRally: s.longestRally,
        hits: s.players[0].hits,
        perfect: s.players[0].perfect,
        smashes: s.players[0].smashes,
        points: 0,
        seconds: s.seconds,
      });
    },
    [game, mode],
  );

  function point(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      nx: tableX(((e.clientX - r.left) / r.width) * W),
      ny: (e.clientY - r.top) / r.height,
    };
  }
  function onDown(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    if (game.phase === "paused") return;
    const { nx, ny } = point(e);
    const t = touches.current.down(e.pointerId, nx, ny);
    if (t) {
      game.setTarget(t.player, t.x);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* a synthetic pointer cannot be captured */
      }
    }
  }
  function onMove(e: PointerEvent<HTMLDivElement>) {
    const t = touches.current.move(e.pointerId, point(e).nx);
    if (t && game.phase !== "paused") game.setTarget(t.player, t.x);
  }
  function onUp(e: PointerEvent<HTMLDivElement>) {
    touches.current.up(e.pointerId);
  }

  const [n0, n1] = names(mode);
  const local = mode === "local";
  const pts = view.score.points;
  const sets = view.score.sets;
  const multi = settings.bestOf > 1 && mode !== "practice";
  const theme = THEMES[settings.theme]!;

  const banner =
    phase === "point" && view.pointWinner !== null
      ? `Point: ${view.pointWinner === 0 ? n0 : n1}`
      : phase === "setComplete"
        ? `Set to ${sets[0] > sets[1] ? n0 : n1}`
        : view.matchPoint !== null && phase !== "matchComplete"
          ? `Match point: ${view.matchPoint === 0 ? n0 : n1}`
          : view.deuce && phase !== "matchComplete"
            ? "Deuce"
            : "";

  const hud = (p: 0 | 1, flip: boolean) => (
    <div className={`pp-hud lv-card ${flip ? "pp-flip" : ""}`} data-testid={`hud-${p}`}>
      <span className="pp-dot" style={{ background: p === 0 ? theme.p0 : theme.p1 }} aria-hidden />
      <span className="font-semibold">{p === 0 ? n0 : n1}</span>
      {multi && (
        <span className="text-xs text-muted" data-testid={`sets-${p}`}>
          Sets {sets[p]}
        </span>
      )}
      <span className="pp-score tabular-nums" data-testid={`score-${p}`}>
        {mode === "practice" && p === 1 ? view.rally : pts[p]}
      </span>
    </div>
  );

  const finished = phase === "matchComplete";
  const winner = view.winner;
  const s = game.stats;

  return (
    <div className="pp-wrap flex flex-col gap-3">
      {mode === "practice" ? (
        <div className="pp-hud lv-card" data-testid="hud-practice">
          <span className="font-semibold">Practice</span>
          <span className="text-sm text-muted">
            Rally <b data-testid="rally">{view.rally}</b> · Best{" "}
            <b data-testid="best-rally">{s.longestRally}</b>
          </span>
        </div>
      ) : (
        hud(1, local)
      )}
      <div
        ref={stage}
        className="pp-stage"
        role="group"
        aria-label={
          local
            ? "Table. Player 1 drags in the lower half, player 2 in the upper half."
            : "Table. Drag left and right to move your paddle."
        }
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
      >
        <canvas ref={canvas} className="pp-canvas" width={W} height={H} aria-hidden />
        {banner && (
          <div
            className="pp-banner"
            role="status"
            aria-live="polite"
            data-testid="banner"
            key={banner}
          >
            {banner}
          </div>
        )}
        {local && phase === "countdown" && (
          <p className="pp-hint" aria-hidden>
            Each player: slide your thumb in your half
          </p>
        )}
        {phase === "paused" && (
          <div className="pp-overlay" role="dialog" aria-label="Paused" data-testid="pause">
            <p className="m-0 text-2xl font-bold">Paused</p>
            <Button autoFocus onClick={() => game.resume()}>
              Resume
            </Button>
            <Button variant="secondary" onClick={onAgain}>
              Restart
            </Button>
            <Button variant="secondary" onClick={() => setPanel(true)}>
              Settings
            </Button>
            <Button variant="secondary" onClick={onMenu}>
              Main menu
            </Button>
          </div>
        )}
        {finished && (
          <div className="pp-overlay" role="dialog" aria-label="Match over" data-testid="result">
            <p className="m-0 text-3xl font-black" data-testid="winner">
              {mode === "ai"
                ? winner === 0
                  ? "You win!"
                  : "You lose"
                : winner === 0
                  ? `${n0} wins!`
                  : `${n1} wins!`}
            </p>
            <p className="m-0 text-lg font-semibold tabular-nums" data-testid="final">
              {multi ? `Sets ${sets[0]} - ${sets[1]}, last set ` : ""}
              {pts[0]} - {pts[1]}
            </p>
            <dl className="pp-facts pp-facts-dark m-0">
              <dt>Longest rally</dt>
              <dd>{s.longestRally}</dd>
              <dt>Perfect hits</dt>
              <dd>
                {s.players[0].perfect} / {s.players[1].perfect}
              </dd>
              <dt>Smashes</dt>
              <dd>
                {s.players[0].smashes} / {s.players[1].smashes}
              </dd>
              <dt>Time</dt>
              <dd>
                {Math.floor(s.seconds / 60)}:{String(Math.floor(s.seconds % 60)).padStart(2, "0")}
              </dd>
            </dl>
            <Button autoFocus onClick={onAgain}>
              Rematch
            </Button>
            <Button variant="secondary" onClick={onMenu}>
              Main menu
            </Button>
            <Button variant="secondary" onClick={onExit}>
              Back to Break Room
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-stretch gap-2">
        <div className="flex-1">{mode === "practice" ? null : hud(0, false)}</div>
        <Button
          variant="secondary"
          onClick={() => game.pause()}
          disabled={phase === "paused" || finished}
        >
          Pause
        </Button>
      </div>
      <p className="m-0 text-center text-xs text-muted">
        {local
          ? "Player 1 slides in the lower half, player 2 in the upper half."
          : mode === "practice"
            ? "No score. Keep the rally going."
            : "Slide left and right. Hit with the middle for a perfect hit."}
      </p>
      <Dialog open={panel} title="Settings" onClose={() => setPanel(false)} variant="modal">
        <SettingsForm settings={settings} change={change} />
      </Dialog>
    </div>
  );
}
