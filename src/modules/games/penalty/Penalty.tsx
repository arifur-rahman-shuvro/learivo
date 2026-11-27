import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button, PageHeader } from "../../../ui-kit/index.ts";
import type { GameProps } from "../types.ts";
import {
  REGULATION,
  ZONES,
  botDive,
  botShot,
  matchState,
  resolveKick,
  zoneName,
  type Kick,
  type Power,
  type Side,
  type Zone,
} from "./rules.ts";
import "./penalty.css";

/** Where a zone sits on the pitch, in percent of its width and height. */
const zoneX = (z: Zone) => [22, 50, 78][z.col]!;
const zoneY = (z: Zone) => [18.5, 43.5][z.row]!;
const KEEPER_HOME = { x: 50, y: 56 };

const POWERS: { id: Power; label: string }[] = [
  { id: 1, label: "Soft" },
  { id: 2, label: "Medium" },
  { id: 3, label: "Hard" },
];

function ballTarget(k: Kick): { x: number; y: number } {
  if (k.outcome !== "miss") return { x: zoneX(k.aim), y: zoneY(k.aim) };
  // a miss goes wide of the post, or over the bar from the middle
  if (k.aim.col === 0) return { x: 3, y: zoneY(k.aim) };
  if (k.aim.col === 2) return { x: 97, y: zoneY(k.aim) };
  return { x: 50, y: -6 };
}

function say(k: Kick): string {
  if (k.shooter === "you") {
    return k.outcome === "goal"
      ? "Goal!"
      : k.outcome === "saved"
        ? "Saved by the keeper"
        : "Missed, it flew wide or over";
  }
  return k.outcome === "goal"
    ? "The bot scores"
    : k.outcome === "saved"
      ? "You saved it!"
      : "The bot missed";
}

export default function Penalty({ onExit, onFinish }: GameProps) {
  const [kicks, setKicks] = useState<Kick[]>([]);
  const [shown, setShown] = useState<Kick | null>(null); // the kick being shown, until Next is pressed
  const [power, setPower] = useState<Power>(2);
  const startedAt = useRef(Date.now());
  const reported = useRef(false);

  const m = matchState(kicks);
  const finished = m.over && shown === null;

  useEffect(() => {
    if (!m.over || reported.current) return;
    reported.current = true;
    onFinish({
      gameId: "penalty",
      score: m.you,
      durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
      finishedAt: new Date().toISOString(),
    });
  }, [m.over, m.you, onFinish]);

  function play(zone: Zone) {
    if (shown || m.over || m.next === null) return;
    const kick: Kick =
      m.next === "you"
        ? { shooter: "you", aim: zone, power, dive: botDive(Math.random), outcome: "goal" }
        : (() => {
            const s = botShot(Math.random);
            return {
              shooter: "bot",
              aim: s.aim,
              power: s.power,
              dive: zone,
              outcome: "goal",
            } as Kick;
          })();
    kick.outcome = resolveKick(kick.aim, kick.power, kick.dive, Math.random);
    setKicks([...kicks, kick]);
    setShown(kick);
  }

  function restart() {
    setKicks([]);
    setShown(null);
    reported.current = false;
    startedAt.current = Date.now();
  }

  const shooting: Side | null = shown ? shown.shooter : m.next;
  const target = shown ? ballTarget(shown) : null;
  const pitchStyle = {
    "--kx0": `${KEEPER_HOME.x}%`,
    "--ky0": `${KEEPER_HOME.y}%`,
    "--kx": `${shown ? zoneX(shown.dive) : KEEPER_HOME.x}%`,
    "--ky": `${shown ? zoneY(shown.dive) + 12 : KEEPER_HOME.y}%`,
    "--kr": shown ? `${(shown.dive.col - 1) * 40}deg` : "0deg",
    "--bx": `${target?.x ?? 50}%`,
    "--by": `${target?.y ?? 88}%`,
  } as CSSProperties;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Penalty shootout"
        help="Five kicks each. Shoot, then dive to save the bot's kicks."
        onBack={onExit}
        backLabel="Break Room"
      />

      <Scoreboard kicks={kicks} you={m.you} bot={m.bot} suddenDeath={m.suddenDeath && !m.over} />

      <div className="pen-pitch" style={pitchStyle}>
        <div className="pen-goal">
          <div className="pen-zones" role="group" aria-label="Goal">
            {ZONES.map((z) => {
              const usable = !shown && !m.over;
              return (
                <button
                  key={zoneName(z)}
                  type="button"
                  className="pen-zone"
                  aria-label={`${shooting === "bot" ? "Dive" : "Shoot"} ${zoneName(z)}`}
                  aria-disabled={!usable}
                  onClick={() => play(z)}
                />
              );
            })}
          </div>
        </div>
        <div className="pen-spot" />
        <div
          key={`k${kicks.length}`}
          className="pen-keeper"
          data-dive={shown !== null}
          aria-hidden
        />
        <div key={`b${kicks.length}`} className="pen-ball" data-shot={shown !== null} aria-hidden />
      </div>

      {shown ? (
        <div className="flex flex-col items-center gap-3">
          <p
            role="status"
            aria-live="polite"
            className="m-0 text-xl font-bold"
            data-testid="status"
          >
            {say(shown)}
          </p>
          <Button onClick={() => setShown(null)}>{m.over ? "See result" : "Next kick"}</Button>
        </div>
      ) : finished ? (
        <div className="lv-card flex flex-col items-center gap-3 p-4 text-center">
          <p role="status" className="m-0 text-xl font-bold" data-testid="status">
            {m.winner === "you"
              ? `You win ${m.you} to ${m.bot}`
              : m.winner === "bot"
                ? `The bot wins ${m.bot} to ${m.you}`
                : `A draw, ${m.you} to ${m.bot}`}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={restart}>Play again</Button>
            <Button variant="secondary" onClick={onExit}>
              Back to Break Room
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p
            role="status"
            aria-live="polite"
            className="m-0 text-center text-lg font-semibold"
            data-testid="status"
          >
            {m.next === "you"
              ? "Your kick: tap a spot in the goal"
              : "Bot's kick: tap where to dive"}
          </p>
          {m.next === "you" && (
            <div role="group" aria-label="Shot power" className="flex gap-2">
              {POWERS.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant={power === p.id ? "primary" : "secondary"}
                  aria-pressed={power === p.id}
                  onClick={() => setPower(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          )}
          {m.next === "you" && (
            <p className="m-0 text-center text-sm text-muted">
              Harder shots are harder to save but can fly wide.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Scoreboard({
  kicks,
  you,
  bot,
  suddenDeath,
}: {
  kicks: Kick[];
  you: number;
  bot: number;
  suddenDeath: boolean;
}) {
  return (
    <div className="lv-card flex flex-col gap-2 p-3">
      {(["you", "bot"] as const).map((side) => {
        const mine = kicks.filter((k) => k.shooter === side);
        const slots = Math.max(REGULATION, mine.length);
        return (
          <div key={side} className="flex items-center gap-3">
            <span className="w-10 text-sm font-semibold">{side === "you" ? "You" : "Bot"}</span>
            <span className="flex flex-1 flex-wrap gap-1.5" aria-hidden>
              {Array.from({ length: slots }, (_, i) => {
                const k = mine[i];
                return (
                  <span
                    key={i}
                    className={`h-3.5 w-3.5 rounded-full border-2 ${
                      !k
                        ? "border-line bg-transparent"
                        : k.outcome === "goal"
                          ? "border-accent bg-accent"
                          : "border-danger bg-transparent"
                    }`}
                  />
                );
              })}
            </span>
            <span className="text-2xl font-bold tabular-nums" data-testid={`${side}-goals`}>
              {side === "you" ? you : bot}
            </span>
          </div>
        );
      })}
      {suddenDeath && (
        <p className="m-0 text-center text-sm font-semibold text-accent">Sudden death</p>
      )}
    </div>
  );
}
