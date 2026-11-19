import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { TermSplitter } from "../../../ui-kit/primitives/RichText.tsx";
import type { WorkspaceRepo } from "../data/repo.ts";
import { splitByTerms, type GlossaryTerm } from "../domain/cards.ts";

interface Value {
  repo: WorkspaceRepo;
  /** Increases after every change so lists reload. */
  rev: number;
  refresh: () => void;
  /** Underlines the student's glossary terms in text; undefined while the glossary is empty. */
  splitter: TermSplitter | undefined;
}

export const Ctx = createContext<Value | null>(null);

export function WorkspaceProvider({
  repo,
  children,
}: {
  repo: WorkspaceRepo;
  children: ReactNode;
}) {
  const [rev, setRev] = useState(0);
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  useEffect(() => {
    let alive = true;
    repo.glossary().then(
      (list) => alive && setTerms(list),
      () => alive && setTerms([]),
    );
    return () => {
      alive = false;
    };
  }, [repo, rev]);
  const splitter = useMemo<TermSplitter | undefined>(
    () =>
      terms.length === 0
        ? undefined
        : (text) =>
            splitByTerms(text, terms).map((p) => ({
              text: p.text,
              definition: p.term?.definition,
            })),
    [terms],
  );
  const value = useMemo(
    () => ({ repo, rev, refresh: () => setRev((n) => n + 1), splitter }),
    [repo, rev, splitter],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return v;
}
