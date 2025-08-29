// src/lib/supabase.native.ts
import "react-native-url-polyfill/auto";
import "react-native-get-random-values";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // no URL redirects on native
  },
});
