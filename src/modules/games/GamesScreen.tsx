import { subPage, useHash } from "../../core/hash.ts";
import { PageHeader, Tile, TileGrid } from "../../ui-kit/index.ts";
import { GAMES, GROUPS, gamesIn, type GameGroup } from "./registry.tsx";

export { GAMES };

const ORDER: GameGroup[] = ["brain", "break"];

/**
 * "#/games" is the hub with two big choices. "#/games/brain" and "#/games/break" list the games of
 * that kind. Every game is Coming soon: nothing here pretends to be playable.
 */
export default function GamesScreen({ onNavigate }: { onNavigate: (route: string) => void }) {
  const sub = subPage(useHash(), "#/games");
  const group = ORDER.find((g) => g === sub) ?? null;

  if (group) {
    const info = GROUPS[group];
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title={info.title}
          help={info.page}
          onBack={() => onNavigate("#/games")}
          backLabel="Mini games"
        />
        <TileGrid>
          {gamesIn(group).map((g) => (
            <Tile
              key={g.id}
              icon={g.icon}
              title={g.title}
              help={g.help}
              soon={g.status === "soon"}
            />
          ))}
        </TileGrid>
        <p className="m-0 text-center text-sm text-muted">
          These are on the way. Tell us which one you want first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Mini games"
        help="Pick a side: train your brain or take a break."
        onBack={() => onNavigate("#/practice")}
        backLabel="Practice"
      />
      <div className="flex flex-col gap-4">
        {ORDER.map((g) => (
          <Tile
            key={g}
            tone="accent"
            icon={GROUPS[g].icon}
            title={GROUPS[g].title}
            help={GROUPS[g].help}
            badge={`${gamesIn(g).length} games soon`}
            onClick={() => onNavigate(`#/games/${g}`)}
          />
        ))}
      </div>
    </div>
  );
}
