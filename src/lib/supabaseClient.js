import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// FIX #8: log solo in dev — l'URL Supabase non deve comparire in console di produzione
if (import.meta.env.DEV) {
  console.log("SUPABASE URL:", supabaseUrl);
  console.log("SUPABASE KEY:", supabaseAnonKey ? "presente" : "mancante");
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;