import { useEffect, useRef, useState } from "react";
import { Button, PageHeader, Tile } from "../../../ui-kit/index.ts";
import type { GameProps } from "../types.ts";
import {
  botMove,
  emptyBoard,
  isFull,
  other,
  place,
  turnOf,
  winnerOf,
  type Board,
  type Level,
  type Mark,
} from "./rules.ts";

type Mode = Level | "two";

const MODES: { id: Mode; title: string; help: string }[] = [
  { id: "easy", title: "Easy bot", help: "Plays anywhere. A good warm-up." },
  { id: "medium", title: "Medium bot", help: "Wins and blocks when it can, otherwise random." },
  { id: "hard", title: "Hard bot", help: "Never loses. Can you make a draw?" },
  { id: "two", title: "Two players", help: "Pass the phone and take turns." },
];

const BOT_DELAY_MS = 450;

interface Score {
  you: number;
  other: number;
  draws: number;
}

export default function TicTacToe({ onExit, onFinish }: GameProps) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState<Score>({ you: 0, other: 0, draws: 0 });
  const startedAt = useRef(Date.now());

  // Against a bot the human is X on even rounds and O on odd rounds, so the first move alternates.
  const human: Mark = round % 2 === 0 ? "X" : "O";
  const bot: Mark = other(human);
  const win = winnerOf(board);
  const over = win !== null || isFull(board);
  const turn = turnOf(board);
  const botsTurn = mode !== null && mode !== "two" && !over && turn === bot;

  // The bot thinks for a moment, so its move is seen. A cleanup stops it if the game is left.
  useEffect(() => {
    if (!botsTurn) return;
    const t = window.setTimeout(() => {
      setBoard((b) => (turnOf(b) === bot ? place(b, botMove(b, bot, mode), bot) : b));
    }, BOT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [botsTurn, mode, bot, board]);

  // A finished round is counted once and reported once.
  const counted = useRef<Board | null>(null);
  useEffect(() => {
    if (!over || mode === null || counted.current === board) return;
    counted.current = board;
    const you = mode === "two" ? win?.mark === "X" : win?.mark === human;
    const them = win !== null && !you;
    setScore((s) => ({
      you: s.you + (you ? 1 : 0),
      other: s.other + (them ? 1 : 0),
      draws: s.draws + (win === null ? 1 : 0),
    }));
    onFinish({
      gameId: "tictactoe",
      score: you ? 3 : win === null ? 1 : 0,
      durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
      finishedAt: new Date().toISOString(),
    });
    startedAt.current = Date.now();
  }, [over, board, mode, win, human, onFinish]);

  const names =
    mode === "two"
      ? { you: "X", other: "O" }
      : {
          you: "You",
          other: mode === null ? "Bot" : `${mode[0]!.toUpperCase()}${mode.slice(1)} bot`,
        };

  function status(): string {
    if (mode === null) return "";
    if (win) {
      if (mode === "two") return `${win.mark} wins`;
      return win.mark === human ? "You win" : "The bot wins";
    }
    if (over) return "A draw";
    if (mode === "two") return `${turn}'s turn`;
    return turn === human ? `Your turn (${human})` : "The bot is thinking";
  }

  function tap(i: number) {
    if (over || botsTurn || board[i] !== null) return;
    setBoard(place(board, i, turn));
  }

  function again() {
    setBoard(emptyBoard());
    setRound((r) => r + 1);
  }

  function choose(m: Mode) {
    setMode(m);
    setBoard(emptyBoard());
    setRound(0);
    setScore({ you: 0, other: 0, draws: 0 });
    counted.current = null;
    startedAt.current = Date.now();
  }

  if (mode === null) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Tic-tac-toe"
          help="Three in a row wins. Pick who you play against."
          onBack={onExit}
          backLabel="Break Room"
        />
        <div className="flex flex-col gap-3">
          {MODES.map((m) => (
            <Tile
              key={m.id}
              title={m.title}
              help={m.help}
              icon={<MarkIcon m={m.id === "two" ? "O" : "X"} />}
              onClick={() => choose(m.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Tic-tac-toe"
        help={MODES.find((m) => m.id === mode)?.title}
        onBack={() => {
          setMode(null);
          counted.current = null;
        }}
        backLabel="Choose opponent"
      />
      <p
        role="status"
        aria-live="polite"
        className="m-0 text-center text-lg font-semibold"
        data-testid="status"
      >
        {status()}
      </p>
      <div
        role="group"
        aria-label="Board"
        className="mx-auto grid w-full max-w-sm grid-cols-3 gap-2"
      >
        {board.map((c, i) => {
          const inLine = win?.line.includes(i) ?? false;
          const row = Math.floor(i / 3) + 1;
          const col = (i % 3) + 1;
          const usable = c === null && !over && !botsTurn;
          return (
            <button
              key={i}
              type="button"
              aria-label={`Row ${row}, column ${col}, ${c ?? "empty"}`}
              aria-disabled={!usable}
              onClick={() => tap(i)}
              className={`grid aspect-square place-items-center rounded-control border-2 text-5xl font-bold transition-colors ${
                inLine ? "border-accent bg-surface-2" : "border-line bg-surface"
              } ${c === "X" ? "text-accent" : "text-fg"} ${usable ? "lv-card-interactive" : ""}`}
            >
              {c}
            </button>
          );
        })}
      </div>
      <dl className="lv-card m-0 grid grid-cols-3 divide-x divide-line p-3 text-center">
        <Stat label={names.you} value={score.you} />
        <Stat label="Draws" value={score.draws} />
        <Stat label={names.other} value={score.other} />
      </dl>
      {over && (
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={again}>Play again</Button>
          <Button variant="secondary" onClick={() => setMode(null)}>
            Change opponent
          </Button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col px-1">
      <dd className="m-0 text-2xl font-bold">{value}</dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  );
}

function MarkIcon({ m }: { m: Mark }) {
  return <span className="text-2xl font-bold">{m}</span>;
}
