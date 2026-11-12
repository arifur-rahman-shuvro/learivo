import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase.ts";
import type { AuthClient, AuthUser } from "./types.ts";

const toUser = (s: Session | null): AuthUser | null =>
  s?.user ? { id: s.user.id, email: s.user.email ?? "" } : null;

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

export function createSupabaseAuth(): AuthClient {
  return {
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
    async signOut() {
      await supabase.auth.signOut();
    },
  };
}
