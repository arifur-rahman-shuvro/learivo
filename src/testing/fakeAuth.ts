import type {
  AuthClient,
  AuthUser,
  ResetResult,
  SignInResult,
  SignUpResult,
} from "../auth/types.ts";

/** In-memory authentication for tests. */
export function fakeAuth(
  initial: AuthUser | null = null,
  over: Partial<Pick<AuthClient, "signIn" | "signUp" | "changePassword" | "deleteAccount">> = {},
): AuthClient & {
  calls: string[];
  expire: () => void;
  openResetLink: (email: string) => void;
  enableGoogle: () => void;
} {
  let user = initial;
  const listeners = new Set<(u: AuthUser | null) => void>();
  const emit = () => listeners.forEach((l) => l(user));
  const calls: string[] = [];
  const recoveryListeners = new Set<() => void>();
  let google = false;
  return {
    calls,
    /** Switches Google sign-in on, as the owner does in the dashboard. */
    enableGoogle: () => {
      google = true;
    },
    googleAvailable: async () => google,
    signInWithGoogle: async (): Promise<SignInResult> => {
      calls.push("signInWithGoogle");
      user = { id: "g1", email: "student@gmail.com", hasPassword: false };
      emit();
      return { ok: true };
    },
    /** The student opens the emailed reset link: a session starts and the recovery event fires. */
    openResetLink: (email) => {
      user = { id: "u1", email };
      emit();
      recoveryListeners.forEach((l) => l());
    },
    onRecovery: (l) => {
      recoveryListeners.add(l);
      return () => recoveryListeners.delete(l);
    },
    requestPasswordReset: async (email): Promise<ResetResult> => {
      calls.push(`requestPasswordReset:${email}`);
      return { ok: true };
    },
    setNewPassword: async (next): Promise<ResetResult> => {
      calls.push(`setNewPassword:${next}`);
      return next === "same-as-before"
        ? { ok: false, message: "Choose a password you have not used on this account." }
        : { ok: true };
    },
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
        if (user?.hasPassword === false && password !== user.email)
          return { ok: false as const, message: "That is not the email on this account." };
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
