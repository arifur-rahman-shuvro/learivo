import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { WorkspaceRepo } from "../data/repo.ts";

interface Value {
  repo: WorkspaceRepo;
  /** Increases after every change so lists reload. */
  rev: number;
  refresh: () => void;
}

const Ctx = createContext<Value | null>(null);

export function WorkspaceProvider({
  repo,
  children,
}: {
  repo: WorkspaceRepo;
  children: ReactNode;
}) {
  const [rev, setRev] = useState(0);
  const value = useMemo(() => ({ repo, rev, refresh: () => setRev((n) => n + 1) }), [repo, rev]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return v;
}
