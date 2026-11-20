import type { AuthClient, AuthUser, SignInResult, SignUpResult } from "../auth/types.ts";

/** In-memory authentication for tests. */
export function fakeAuth(
  initial: AuthUser | null = null,
  over: Partial<Pick<AuthClient, "signIn" | "signUp" | "changePassword" | "deleteAccount">> = {},
): AuthClient & { calls: string[]; expire: () => void } {
  let user = initial;
  const listeners = new Set<(u: AuthUser | null) => void>();
  const emit = () => listeners.forEach((l) => l(user));
  const calls: string[] = [];
  return {
    calls,
    /** The session ends without the student asking (it expired, or was revoked elsewhere). */
    expire: () => {
      user = null;
      emit();
    },
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
    changePassword:
      over.changePassword ??
      (async (current) => {
        calls.push(`changePassword:${current}`);
        return current === "wrong-password"
          ? { ok: false as const, message: "Your current password is incorrect." }
          : { ok: true as const };
      }),
    deleteAccount:
      over.deleteAccount ??
      (async (password) => {
        calls.push(`deleteAccount:${password}`);
        if (password === "wrong-password")
          return { ok: false as const, message: "That password is not correct." };
        user = null;
        emit();
        return { ok: true as const };
      }),
    signOut: async () => {
      calls.push("signOut");
      user = null;
      emit();
    },
  };
}
