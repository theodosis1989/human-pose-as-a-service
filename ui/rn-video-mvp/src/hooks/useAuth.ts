// src/hooks/useAuth.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}
