import type { AuthClient, AuthUser, SignInResult, SignUpResult } from "../auth/types.ts";

/** In-memory authentication for tests. */
export function fakeAuth(
  initial: AuthUser | null = null,
  over: Partial<Pick<AuthClient, "signIn" | "signUp">> = {},
): AuthClient & { calls: string[] } {
  let user = initial;
  const listeners = new Set<(u: AuthUser | null) => void>();
  const emit = () => listeners.forEach((l) => l(user));
  const calls: string[] = [];
  return {
    calls,
    getUser: async () => user,
    onChange: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    signUp:
      over.signUp ??
      (async (email): Promise<SignUpResult> => {
        calls.push(`signUp:${email}`);
        return { ok: true, needsConfirmation: true };
      }),
    signIn:
      over.signIn ??
      (async (email): Promise<SignInResult> => {
        calls.push(`signIn:${email}`);
        user = { id: "u1", email };
        emit();
        return { ok: true };
      }),
    signOut: async () => {
      calls.push("signOut");
      user = null;
      emit();
    },
  };
}
