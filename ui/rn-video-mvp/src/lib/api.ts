import { API_BASE } from "../config";
import { supabase } from "./supabase";

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiGet(path: string) {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }
  return res.json();
}
