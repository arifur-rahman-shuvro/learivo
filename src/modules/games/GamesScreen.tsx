import {
  CardsIcon,
  ClockIcon,
  GamesIcon,
  PageHeader,
  PracticeIcon,
  SparkIcon,
  Tile,
  TileGrid,
} from "../../ui-kit/index.ts";

/** What each game will be. Every one is Coming soon: nothing here pretends to be playable. */
export const GAMES = [
  {
    id: "speed",
    title: "Speed round",
    help: "Answer as many as you can in 60 seconds.",
    icon: <ClockIcon />,
  },
  {
    id: "match",
    title: "Match pairs",
    help: "Match terms to their meanings against the clock.",
    icon: <CardsIcon />,
  },
  {
    id: "duel",
    title: "Streak duel",
    help: "Beat your own best streak of correct answers.",
    icon: <SparkIcon />,
  },
  {
    id: "boss",
    title: "Weak spot boss",
    help: "Defeat your weakest topic with a short fight.",
    icon: <PracticeIcon />,
  },
] as const;

export default function GamesScreen({ onNavigate }: { onNavigate: (route: string) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Mini games"
        help="Short, playful rounds built from your own questions."
        onBack={() => onNavigate("#/practice")}
        backLabel="Practice"
      />
      <div className="lv-card flex items-center gap-3 p-4">
        <span
          aria-hidden
          className="grid size-12 place-items-center rounded-control bg-accent text-on-accent"
        >
          <GamesIcon />
        </span>
        <p className="m-0 text-sm text-muted">
          Games are on the way. They will use the questions you already have, and count toward your
          streak.
        </p>
      </div>
      <TileGrid>
        {GAMES.map((g) => (
          <Tile key={g.id} icon={g.icon} title={g.title} help={g.help} soon />
        ))}
      </TileGrid>
    </div>
  );
}
