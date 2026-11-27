import type { ReactNode } from "react";
import {
  CardsIcon,
  CheckIcon,
  ClockIcon,
  GamesIcon,
  GlossaryIcon,
  MistakeIcon,
  NoteIcon,
  PracticeIcon,
  SparkIcon,
  StudyIcon,
} from "../../ui-kit/index.ts";

/**
 * The two kinds of mini game. Brain Gym games are built from the student's own questions,
 * cards and glossary and count toward study time and streak. Break Room games are pure fun
 * that never touch the question bank and never count toward the streak.
 */
export type GameGroup = "brain" | "break";

export interface GameManifest {
  /** Stable id, used in the address (`#/games/brain`) and in saved scores later. Never rename. */
  id: string;
  group: GameGroup;
  title: string;
  /** One line shown on the tile. */
  help: string;
  icon: ReactNode;
  /** `soon` tiles are dimmed and not clickable. Set `ready` only when the game really plays. */
  status: "soon" | "ready";
}

export const GROUPS: Record<
  GameGroup,
  { title: string; help: string; page: string; icon: ReactNode }
> = {
  brain: {
    title: "Brain Gym",
    help: "Train what you are learning, as quick games built from your own questions.",
    page: "Quick games built from your own questions, cards and glossary.",
    icon: <StudyIcon />,
  },
  break: {
    title: "Break Room",
    help: "Pure fun to rest your head between sessions. Nothing here counts as study.",
    page: "Pure fun to rest your head. Nothing here counts as study or touches your streak.",
    icon: <GamesIcon />,
  },
};

/** Add a game by adding one entry here (see docs/GAMES.md). Every game is Coming soon for now. */
export const GAMES: readonly GameManifest[] = [
  {
    id: "speed",
    group: "brain",
    title: "Speed round",
    help: "Answer as many as you can in 60 seconds.",
    icon: <ClockIcon />,
    status: "soon",
  },
  {
    id: "streak",
    group: "brain",
    title: "Streak run",
    help: "Keep going until your first wrong answer. Beat your best.",
    icon: <SparkIcon />,
    status: "soon",
  },
  {
    id: "boss",
    group: "brain",
    title: "Weak spot boss",
    help: "Defeat your weakest topic in a short fight.",
    icon: <PracticeIcon />,
    status: "soon",
  },
  {
    id: "match",
    group: "brain",
    title: "Match pairs",
    help: "Match terms to their meanings against the clock.",
    icon: <CardsIcon />,
    status: "soon",
  },
  {
    id: "blitz",
    group: "brain",
    title: "True or false blitz",
    help: "Swipe true or false on quick statements.",
    icon: <CheckIcon />,
    status: "soon",
  },
  {
    id: "gap",
    group: "brain",
    title: "Fill the gap",
    help: "Finish the sentence from your own explanations.",
    icon: <NoteIcon />,
    status: "soon",
  },
  {
    id: "scramble",
    group: "brain",
    title: "Word scramble",
    help: "Unscramble the terms in your glossary.",
    icon: <GlossaryIcon />,
    status: "soon",
  },
  {
    id: "daily",
    group: "brain",
    title: "Daily five",
    help: "Five fresh questions a day, one try each.",
    icon: <MistakeIcon />,
    status: "soon",
  },
  {
    id: "wordguess",
    group: "break",
    title: "Word guess",
    help: "Find the hidden five-letter word in six tries.",
    icon: <GlossaryIcon />,
    status: "soon",
  },
  {
    id: "memory",
    group: "break",
    title: "Memory match",
    help: "Flip cards and find the pairs.",
    icon: <CardsIcon />,
    status: "soon",
  },
  {
    id: "slide",
    group: "break",
    title: "Number slide",
    help: "Slide and merge tiles to reach the top number.",
    icon: <SparkIcon />,
    status: "soon",
  },
  {
    id: "reaction",
    group: "break",
    title: "Reaction test",
    help: "How fast can you tap when the screen changes?",
    icon: <ClockIcon />,
    status: "soon",
  },
  {
    id: "snake",
    group: "break",
    title: "Snake",
    help: "The classic. Eat, grow, do not bite yourself.",
    icon: <PracticeIcon />,
    status: "soon",
  },
  {
    id: "calm",
    group: "break",
    title: "Breathing break",
    help: "One calm minute: follow the circle and breathe.",
    icon: <StudyIcon />,
    status: "soon",
  },
];

export const gamesIn = (g: GameGroup): GameManifest[] => GAMES.filter((x) => x.group === g);
