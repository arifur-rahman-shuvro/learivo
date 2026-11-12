import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthClient, AuthUser } from "./types.ts";

type Status = "loading" | "signed-out" | "signed-in";

interface AuthValue {
  status: Status;
  user: AuthUser | null;
  client: AuthClient;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ client, children }: { client: AuthClient; children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let alive = true;
    const apply = (u: AuthUser | null) => {
      if (!alive) return;
      setUser(u);
      setStatus(u ? "signed-in" : "signed-out");
    };
    client.getUser().then(apply, () => apply(null));
    const off = client.onChange(apply);
    return () => {
      alive = false;
      off();
    };
  }, [client]);

  const value = useMemo(() => ({ status, user, client }), [status, user, client]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
