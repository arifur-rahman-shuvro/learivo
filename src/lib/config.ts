/**
 * Public client configuration. The Supabase URL and the publishable key are meant to be
 * visible in the browser: access is enforced by row-level security in the database, not by
 * hiding the key. Never put a secret or service-role key here.
 */
export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "https://vmtbqoqyplsfmxyjcoiy.supabase.co",
  supabasePublishableKey:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    "sb_publishable_swo9z1VNBvDjvrjt12FzJQ_ldW8crRa",
} as const;
