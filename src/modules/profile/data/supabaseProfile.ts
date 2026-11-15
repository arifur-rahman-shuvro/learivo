import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanProfile, DEFAULT_PROFILE, type Profile } from "../domain/profile.ts";
import type { ProfileRepo } from "./repo.ts";

const fail = (e: { code?: string; message: string }): never => {
  throw new Error(
    e.code === "42501" || e.code === "PGRST301"
      ? "Your session has ended. Sign in again."
      : e.code === "23514"
        ? "That name or avatar is not allowed."
        : `Could not reach your profile. ${e.message}`,
  );
};

interface Row {
  display_name: string;
  avatar: string;
}
const fromRow = (r: Row): Profile =>
  cleanProfile({ displayName: r.display_name, avatar: r.avatar });

export class SupabaseProfile implements ProfileRepo {
  constructor(
    private db: SupabaseClient,
    private userId: string,
  ) {}

  async get(): Promise<Profile> {
    const { data, error } = await this.db
      .from("profiles")
      .select("display_name, avatar")
      .eq("id", this.userId)
      .maybeSingle();
    if (error) return fail(error);
    return data ? fromRow(data as Row) : DEFAULT_PROFILE;
  }

  async save(p: Profile): Promise<Profile> {
    const clean = cleanProfile(p);
    const { data, error } = await this.db
      .from("profiles")
      .update({ display_name: clean.displayName, avatar: clean.avatar })
      .eq("id", this.userId)
      .select("display_name, avatar")
      .single();
    if (error) return fail(error);
    return fromRow(data as Row);
  }
}
