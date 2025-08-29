// src/lib/supabase.web.ts
import "react-native-url-polyfill/auto";
import "react-native-get-random-values";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";

const storage =
  typeof window !== "undefined" && window.localStorage
    ? window.localStorage
    : undefined;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // web handles magic-link redirects
  },
});
