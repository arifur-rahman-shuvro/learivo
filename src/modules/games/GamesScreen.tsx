import { Suspense, lazy, type ComponentType } from "react";
import { useRequestFocus } from "../../core/focus.ts";
import { subPage, useHash } from "../../core/hash.ts";
import { PageHeader, Tile, TileGrid } from "../../ui-kit/index.ts";
import { GAMES, GROUPS, gamesIn, type GameGroup, type GameManifest } from "./registry.tsx";
import type { GameProps } from "./types.ts";

export { GAMES };

const ORDER: GameGroup[] = ["brain", "break"];

/** One lazy component per playable game, made once so a re-render never reloads or resets it. */
const screens = new Map<string, ComponentType<GameProps>>();
function screenFor(g: GameManifest): ComponentType<GameProps> | null {
  if (g.status !== "ready" || !g.load) return null;
  let c = screens.get(g.id);
  if (!c) {
    c = lazy(g.load);
    screens.set(g.id, c);
  }
  return c;
}

/**
 * "#/games" is the hub with two big choices. "#/games/brain" and "#/games/break" list the games of
 * that kind. Every game is Coming soon: nothing here pretends to be playable.
 */
export default function GamesScreen({ onNavigate }: { onNavigate: (route: string) => void }) {
  // Games use the whole screen: no tab bar or top bar on a phone, so nothing pulls the student away.
  useRequestFocus();
  // "#/games" hub, "#/games/break" a list, "#/games/break/tictactoe" a running game
  const [first, second] = (subPage(useHash(), "#/games") ?? "").split("/");
  const group = ORDER.find((g) => g === first) ?? null;
  const game = group && second ? gamesIn(group).find((g) => g.id === second) : undefined;
  const Play = game ? screenFor(game) : null;

  if (group && Play) {
    // Reporting a finished round is wired here in one place; saving scores is not built yet.
    return (
      <Suspense fallback={<p className="m-0 text-muted">Loading the game…</p>}>
        <Play onExit={() => onNavigate(`#/games/${group}`)} onFinish={() => undefined} />
      </Suspense>
    );
  }

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
              onClick={() => onNavigate(`#/games/${group}/${g.id}`)}
            />
          ))}
        </TileGrid>
        {gamesIn(group).some((g) => g.status === "soon") && (
          <p className="m-0 text-center text-sm text-muted">
            The dimmed ones are on the way. Tell us which one you want first.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Mini games"
        help="Pick a side: train your brain or take a break."
        onBack={() => onNavigate("#/home")}
        backLabel="Home"
      />
      <div className="flex flex-col gap-4">
        {ORDER.map((g) => (
          <Tile
            key={g}
            tone="accent"
            icon={GROUPS[g].icon}
            title={GROUPS[g].title}
            help={GROUPS[g].help}
            badge={`${gamesIn(g).length} games`}
            onClick={() => onNavigate(`#/games/${g}`)}
          />
        ))}
      </div>
    </div>
  );
}
