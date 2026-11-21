export interface AuthUser {
  id: string;
  email: string;
  /** False when the account only signs in with Google (no password set). Missing means it has one. */
  hasPassword?: boolean;
}

export type SignUpResult =
  { ok: true; needsConfirmation: boolean } | { ok: false; message: string };
export type SignInResult = { ok: true } | { ok: false; message: string };
export type DeleteAccountResult = { ok: true } | { ok: false; message: string };
type ChangePasswordResult = { ok: true } | { ok: false; message: string };
export type ResetResult = { ok: true } | { ok: false; message: string };

/** The small surface of authentication the app needs. Tests use a fake; production uses Supabase. */
export interface AuthClient {
  getUser(): Promise<AuthUser | null>;
  onChange(listener: (user: AuthUser | null) => void): () => void;
  signUp(email: string, password: string): Promise<SignUpResult>;
  signIn(email: string, password: string): Promise<SignInResult>;
  /** Checks the current password, then sets the new one. */
  changePassword(current: string, next: string): Promise<ChangePasswordResult>;
  /** Checks the password, then permanently deletes the account and everything stored under it. */
  deleteAccount(password: string): Promise<DeleteAccountResult>;
  signOut(): Promise<void>;
  /** Emails a link to choose a new password. Succeeds the same way whether or not the email has an account. */
  requestPasswordReset(email: string): Promise<ResetResult>;
  /** After the emailed link has been opened: sets the new password for that session. */
  setNewPassword(next: string): Promise<ResetResult>;
  /** True when Google sign-in is switched on for this project (so the button is only shown when it works). */
  googleAvailable(): Promise<boolean>;
  /** Sends the student to Google; they come back signed in. */
  signInWithGoogle(): Promise<SignInResult>;
  /** Called when the emailed reset link has just been opened. */
  onRecovery(listener: () => void): () => void;
  /** True when this page load came from a reset link (known before anything else has loaded). */
  startedInRecovery?: boolean;
  /** Something to tell the student at start, for example that a link has expired. */
  startupNotice?: string;
}
