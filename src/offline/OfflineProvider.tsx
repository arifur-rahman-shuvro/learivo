import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import type { QuestionRepo } from "../modules/question-bank/data/repo.ts";
import type { AttemptRepo } from "../modules/practice/data/repo.ts";
import { OfflineAwareRepo } from "./pack.ts";
import { SyncedAttempts } from "./syncedAttempts.ts";
import { deviceStore } from "./store.ts";

export interface Services {
  bank: QuestionRepo;
  attempts: AttemptRepo;
  /** Present only in the real app. Tests inject plain in-memory repositories. */
  pack: OfflineAwareRepo | null;
  sync: SyncedAttempts | null;
}

const Ctx = createContext<Services | null>(null);

export function useServices(): Services {
  const v = useContext(Ctx);
  if (!v) throw new Error("useServices must be used inside <OfflineProvider>.");
  return v;
}

/** Null when there is no offline support (tests), so the header can hide its controls. */
export function useOfflineControls() {
  const v = useContext(Ctx);
  return v && v.pack && v.sync ? { pack: v.pack, sync: v.sync } : null;
}

interface Props {
  userId: string;
  /** Builds the live (network) repositories. */
  live: () => { bank: QuestionRepo; attempts: AttemptRepo };
  /** Tests pass in-memory repositories here to skip the device copy and syncing. */
  injected?: { bank?: QuestionRepo; attempts?: AttemptRepo };
  children: ReactNode;
}

/**
 * Wraps the live repositories so the app keeps working without a connection: questions come
 * from a copy on this device, and finished sessions wait on the device until they can be sent.
 */
export function OfflineProvider({ userId, live, injected, children }: Props) {
  const services = useMemo<Services>(() => {
    const store = deviceStore();
    const real = injected?.bank && injected?.attempts ? null : live();
    const pack = injected?.bank ? null : new OfflineAwareRepo(real!.bank, store, userId);
    const sync = injected?.attempts ? null : new SyncedAttempts(real!.attempts, store, userId);
    return {
      bank: injected?.bank ?? pack!,
      attempts: injected?.attempts ?? sync!,
      pack,
      sync,
    };
    // `live` and `injected` are stable per user in practice; rebuilding on them would drop state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const { pack, sync } = services;
    if (!pack || !sync) return;
    const run = () => {
      void sync.sync();
      void pack.refresh().catch(() => undefined);
    };
    run();
    const onVisible = () => document.visibilityState === "visible" && run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [services]);

  return <Ctx.Provider value={services}>{children}</Ctx.Provider>;
}
