import { useState } from "react";
import Player from "./Player.tsx";
import { handoff } from "./practice.tsx";
import Results from "./Results.tsx";
import PracticeHome, { type View } from "./PracticeHome.tsx";

export default function PracticeScreen() {
  const [view, setView] = useState<View>(() => {
    const id = handoff.attemptId;
    handoff.attemptId = null;
    return id ? { name: "play", id } : { name: "home" };
  });
  if (view.name === "play")
    return (
      <Player
        attemptId={view.id}
        onLeave={() => setView({ name: "home" })}
        onSubmitted={(id) => setView({ name: "results", id })}
      />
    );
  if (view.name === "results")
    return (
      <Results
        attemptId={view.id}
        onClose={() => setView({ name: "home" })}
        onStarted={(id) => setView({ name: "play", id })}
      />
    );
  return <PracticeHome onOpen={setView} />;
}
