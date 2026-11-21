import type { Session } from "@supabase/supabase-js";
import { config } from "../core/config.ts";
import { supabase } from "../core/supabase.ts";
import type { AuthClient, AuthUser } from "./types.ts";

/** An account made with Google has no password until the student adds one. */
const toUser = (s: Session | null): AuthUser | null => {
  if (!s?.user) return null;
  const providers = s.user.app_metadata?.providers;
  const hasPassword = !Array.isArray(providers) || providers.includes("email");
  return { id: s.user.id, email: s.user.email ?? "", hasPassword };
};

/** Turn provider error text into plain guidance, without leaking whether an account exists. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Email or password is incorrect.";
  if (m.includes("email not confirmed"))
    return "Confirm your email first. Check your inbox for the link.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Wait a few minutes and try again.";
  if (m.includes("password")) return "Use a password with at least 8 characters.";
  return "Something went wrong. Check your connection and try again.";
}

/** What the address looked like when the page opened: the emailed link puts its result there. */
export function readLink(hash = window.location.hash, search = window.location.search) {
  const raw = `${hash.replace(/^#\/?/, "")}&${search.replace(/^\?/, "")}`;
  const p = new URLSearchParams(raw);
  const expired = p.get("error_code") === "otp_expired";
  return {
    recovery: p.get("type") === "recovery",
    expired,
    /** Coming back from Google without signing in (cancelled, or the provider refused). */
    failed: !expired && (p.get("error") !== null || p.get("error_code") !== null),
  };
}

/** Plain wording for why an email change was refused. Never says whether the address belongs to someone. */
export function emailChangeMessage(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many") || m.includes("seconds"))
    return "Too many requests. Wait a few minutes and try again.";
  if (m.includes("invalid") && m.includes("email")) return "Enter a valid email address.";
  if (m.includes("already") || m.includes("registered") || m.includes("exists"))
    return "That email cannot be used. Try a different address.";
  return friendly(raw);
}

export function createSupabaseAuth(): AuthClient {
  const link = readLink();
  return {
    startedInRecovery: link.recovery,
    startupNotice: link.expired
      ? "That link has expired or was already used. Choose Forgot password and ask for a new one."
      : link.failed
        ? "Sign in did not finish. Try again, or use your email and password."
        : undefined,
    async googleAvailable() {
      try {
        const res = await fetch(`${config.supabaseUrl}/auth/v1/settings`, {
          headers: { apikey: config.supabasePublishableKey },
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return false;
        const body = (await res.json()) as { external?: { google?: boolean } };
        return body.external?.google === true;
      } catch {
        return false; // no connection: the email form still works
      }
    },
    async signInWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      return error ? { ok: false, message: friendly(error.message) } : { ok: true };
    },
    onRecovery(listener) {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") listener();
      });
      return () => data.subscription.unsubscribe();
    },
    async requestPasswordReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      // The answer never says whether the email has an account.
      if (error && /rate limit|too many|seconds/i.test(error.message)) {
        return { ok: false, message: "Too many requests. Wait a few minutes and try again." };
      }
      if (error && !/not found|invalid/i.test(error.message))
        return { ok: false, message: friendly(error.message) };
      return { ok: true };
    },
    async setNewPassword(next) {
      const { error } = await supabase.auth.updateUser({ password: next });
      if (!error) return { ok: true };
      const m = error.message.toLowerCase();
      if (m.includes("different") || m.includes("same"))
        return { ok: false, message: "Choose a password you have not used on this account." };
      if (m.includes("session"))
        return { ok: false, message: "That link has expired. Ask for a new one." };
      return { ok: false, message: friendly(error.message) };
    },
    async getUser() {
      const { data } = await supabase.auth.getSession();
      return toUser(data.session);
    },
    onChange(listener) {
      const { data } = supabase.auth.onAuthStateChange((_e, session) => listener(toUser(session)));
      return () => data.subscription.unsubscribe();
    },
    async signUp(email, password) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) return { ok: false, message: friendly(error.message) };
      return { ok: true, needsConfirmation: data.session === null };
    },
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { ok: false, message: friendly(error.message) } : { ok: true };
    },
    async changePassword(current, next) {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user.email;
      if (!email) return { ok: false, message: "Your session has ended. Sign in again." };
      // Re-check the current password so a stolen open session cannot change it.
      const check = await supabase.auth.signInWithPassword({ email, password: current });
      if (check.error) {
        return {
          ok: false,
          message: check.error.message.toLowerCase().includes("invalid login")
            ? "Your current password is incorrect."
            : friendly(check.error.message),
        };
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (!error) return { ok: true };
      const m = error.message.toLowerCase();
      if (m.includes("different") || m.includes("same"))
        return { ok: false, message: "Choose a password you have not used on this account." };
      return { ok: false, message: friendly(error.message) };
    },
    async changeEmail(password, newEmail) {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user.email;
      if (!email) return { ok: false, message: "Your session has ended. Sign in again." };
      const providers = data.session?.user.app_metadata?.providers;
      if (Array.isArray(providers) && !providers.includes("email"))
        return { ok: false, message: "Your email comes from Google and cannot be changed here." };
      const next = newEmail.trim();
      if (next.toLowerCase() === email.toLowerCase())
        return { ok: false, message: "That is already your email." };
      // Ask for the password again, so someone holding an open phone cannot take over the account.
      const check = await supabase.auth.signInWithPassword({ email, password });
      if (check.error) {
        return {
          ok: false,
          message: check.error.message.toLowerCase().includes("invalid login")
            ? "That password is not correct."
            : friendly(check.error.message),
        };
      }
      const { error } = await supabase.auth.updateUser(
        { email: next },
        { emailRedirectTo: window.location.origin },
      );
      return error ? { ok: false, message: emailChangeMessage(error.message) } : { ok: true };
    },
    async deleteAccount(password) {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user.email;
      if (!email) return { ok: false, message: "Your session has ended. Sign in again." };
      const providers = data.session?.user.app_metadata?.providers;
      if (Array.isArray(providers) && !providers.includes("email")) {
        // A Google-only account has no password: the student types their email instead.
        if (password.trim().toLowerCase() !== email.toLowerCase())
          return { ok: false, message: "That is not the email on this account." };
      } else {
        // Ask for the password again, so someone holding an open phone cannot delete the account.
        const check = await supabase.auth.signInWithPassword({ email, password });
        if (check.error) {
          return {
            ok: false,
            message: check.error.message.toLowerCase().includes("invalid login")
              ? "That password is not correct."
              : friendly(check.error.message),
          };
        }
      }
      const { error } = await supabase.rpc("delete_my_account");
      if (error) return { ok: false, message: friendly(error.message) };
      await supabase.auth.signOut({ scope: "local" }); // the account is gone; end this session
      return { ok: true };
    },
    async signOut() {
      await supabase.auth.signOut();
    },
  };
}
