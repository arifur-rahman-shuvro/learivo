import { createClient } from "@supabase/supabase-js";
import { config } from "./config.ts";

/** One shared client, so sign-in and data access use the same session. */
export const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey);
