import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthClient, AuthUser } from "./types.ts";

type Status = "loading" | "signed-out" | "signed-in";

interface AuthValue {
  status: Status;
  user: AuthUser | null;
  client: AuthClient;
  /** Set when the session ended without the student asking for it (expired, revoked elsewhere). */
  notice: string | null;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ client, children }: { client: AuthClient; children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const was = useRef<Status>("loading");
  const leaving = useRef(false);
  // Signing out or deleting the account is the student's own doing, so it earns no "session ended" notice.
  const wrapped = useMemo<AuthClient>(
    () => ({
      ...client,
      signOut: () => {
        leaving.current = true;
        return client.signOut();
      },
      deleteAccount: (password) => {
        leaving.current = true;
        return client.deleteAccount(password).then((r) => {
          if (!r.ok) leaving.current = false;
          return r;
        });
      },
    }),
    [client],
  );

  useEffect(() => {
    let alive = true;
    const apply = (u: AuthUser | null) => {
      if (!alive) return;
      const next: Status = u ? "signed-in" : "signed-out";
      if (next === "signed-out" && was.current === "signed-in" && !leaving.current) {
        setNotice(
          "Your session ended. Sign in again to continue. Changes waiting on this device are kept.",
        );
      } else if (next === "signed-in") {
        setNotice(null);
        leaving.current = false;
      }
      was.current = next;
      setUser(u);
      setStatus(next);
    };
    client.getUser().then(apply, () => apply(null));
    const off = client.onChange(apply);
    return () => {
      alive = false;
      off();
    };
  }, [client]);

  const value = useMemo(
    () => ({ status, user, client: wrapped, notice }),
    [status, user, wrapped, notice],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
