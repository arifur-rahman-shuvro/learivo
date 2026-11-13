import { useEffect, useState } from "react";
import { errorText } from "../../question-bank/ui/bank.tsx";
import type { Attempt } from "../../practice/data/repo.ts";
import { usePractice } from "../../practice/ui/practice.tsx";
import type { Fact, SessionSummary } from "../domain/insights.ts";

export function toSession(a: Attempt): SessionSummary {
  return {
    kind: a.kind,
    title: a.title,
    submittedAt: a.submittedAt ?? a.startedAt,
    questionCount: a.questionCount,
    marksCorrect: a.marksCorrect,
    score: a.score ?? 0,
    secondsSpent: a.secondsSpent,
    answered: (a.correct ?? 0) + (a.wrong ?? 0),
    correct: a.correct ?? 0,
  };
}

/** Loads finished sessions and answers once, shared by Insights and Home. */
export function useInsightsData() {
  const { attempts, rev } = usePractice();
  const [state, setState] = useState<{
    sessions: SessionSummary[];
    facts: Fact[];
  } | null>(null);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let alive = true;
    Promise.all([attempts.list(200), attempts.facts(5000)]).then(
      ([list, facts]) => {
        if (!alive) return;
        setState({ sessions: list.filter((a) => a.status === "submitted").map(toSession), facts });
        setError(undefined);
      },
      (e) => alive && setError(errorText(e)),
    );
    return () => {
      alive = false;
    };
  }, [attempts, rev]);
  return { data: state, error };
}
