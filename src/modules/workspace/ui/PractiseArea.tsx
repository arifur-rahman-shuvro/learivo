import { useState } from "react";
import { Button } from "../../../ui-kit/index.ts";
import { errorText, useBank } from "../../question-bank/ui/bank.tsx";
import { handoff, usePractice } from "../../practice/ui/practice.tsx";
import { startForArea } from "../../practice/ui/start.ts";
import { useWorkspace } from "./workspace.tsx";

/** Starts ten questions on one weak area and opens the session. */
export default function PractiseArea({
  area,
  onNavigate,
}: {
  area: string;
  onNavigate: (route: string) => void;
}) {
  const { repo } = useBank();
  const { attempts, refresh } = usePractice();
  const ws = useWorkspace().repo;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        loading={busy}
        aria-label={`Practise ${area}`}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            handoff.attemptId = await startForArea(repo, attempts, area, ws);
            refresh();
            onNavigate("#/practice");
          } catch (e) {
            setError(errorText(e));
            setBusy(false);
          }
        }}
      >
        Practise
      </Button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
