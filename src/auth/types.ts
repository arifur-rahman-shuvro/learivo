export interface AuthUser {
  id: string;
  email: string;
}

export type SignUpResult =
  { ok: true; needsConfirmation: boolean } | { ok: false; message: string };
export type SignInResult = { ok: true } | { ok: false; message: string };
type ChangePasswordResult = { ok: true } | { ok: false; message: string };

/** The small surface of authentication the app needs. Tests use a fake; production uses Supabase. */
export interface AuthClient {
  getUser(): Promise<AuthUser | null>;
  onChange(listener: (user: AuthUser | null) => void): () => void;
  signUp(email: string, password: string): Promise<SignUpResult>;
  signIn(email: string, password: string): Promise<SignInResult>;
  /** Checks the current password, then sets the new one. */
  changePassword(current: string, next: string): Promise<ChangePasswordResult>;
  signOut(): Promise<void>;
}
