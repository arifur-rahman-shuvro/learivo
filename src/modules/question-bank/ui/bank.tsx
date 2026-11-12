import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { QuestionRepo } from "../data/repo.ts";

interface BankValue {
  repo: QuestionRepo;
  /** Increases after every change, so screens reload their data. */
  rev: number;
  refresh: () => void;
}

const BankContext = createContext<BankValue | null>(null);

export function BankProvider({ repo, children }: { repo: QuestionRepo; children: ReactNode }) {
  const [rev, setRev] = useState(0);
  const refresh = useCallback(() => setRev((n) => n + 1), []);
  const value = useMemo(() => ({ repo, rev, refresh }), [repo, rev, refresh]);
  return <BankContext.Provider value={value}>{children}</BankContext.Provider>;
}

export function useBank(): BankValue {
  const v = useContext(BankContext);
  if (!v) throw new Error("useBank must be used inside BankProvider");
  return v;
}

export const FRIENDLY_ERROR =
  "Could not reach your question bank. Check your connection and try again.";

/** The repository already words its errors for students; anything else gets a generic line. */
export function errorText(e: unknown): string {
  return e instanceof Error && e.message ? e.message : FRIENDLY_ERROR;
}

export interface Loaded<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
}

/** Load data from the repository; reloads when the bank changes or the dependencies change. */
export function useLoad<T>(
  load: (repo: QuestionRepo) => Promise<T>,
  deps: readonly unknown[] = [],
): Loaded<T> {
  const { repo, rev } = useBank();
  const [state, setState] = useState<Loaded<T>>({
    data: undefined,
    error: undefined,
    loading: true,
  });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    load(repo).then(
      (data) => alive && setState({ data, error: undefined, loading: false }),
      (e) => alive && setState({ data: undefined, error: errorText(e), loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, rev, ...deps]);
  return state;
}
