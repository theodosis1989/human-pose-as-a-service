import { API_BASE } from "../config";
import { supabase } from "./supabase";

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok)
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

// Convenience wrappers if you like:
export const apiGet = (path: string) => apiFetch(path, { method: "GET" });
export const apiPost = (path: string, body: any) =>
  apiFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
