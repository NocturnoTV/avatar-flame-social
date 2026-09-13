import { supabase } from "@/integrations/supabase/client";

export const MAX_SAVED_ACCOUNTS = 3;
const STORAGE_KEY = "bloxspark-saved-accounts";

export type SavedAccount = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string;
  savedAt: number;
};

function readAll(): SavedAccount[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedAccount[]) : [];
  } catch {
    return [];
  }
}

function writeAll(accounts: SavedAccount[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // Storage full or unavailable — the switcher degrades to "no saved accounts".
  }
}

export function getSavedAccounts(): SavedAccount[] {
  return readAll().sort((a, b) => b.savedAt - a.savedAt);
}

/** Adds or refreshes an account's stored tokens/profile. Evicts the oldest entry past MAX_SAVED_ACCOUNTS. */
export function rememberAccount(partial: {
  userId: string;
  accessToken?: string;
  refreshToken?: string;
  username?: string | null;
  avatarUrl?: string | null;
  /** Bump this account to "most recently used" (e.g. on an explicit sign-in or switch). */
  touch?: boolean;
}) {
  const all = readAll();
  const existing = all.find((a) => a.userId === partial.userId);
  const next: SavedAccount = {
    userId: partial.userId,
    accessToken: partial.accessToken || existing?.accessToken || "",
    refreshToken: partial.refreshToken || existing?.refreshToken || "",
    username: partial.username ?? existing?.username ?? null,
    avatarUrl: partial.avatarUrl ?? existing?.avatarUrl ?? null,
    savedAt: partial.touch || !existing ? Date.now() : existing.savedAt,
  };
  let rest = all.filter((a) => a.userId !== partial.userId);
  if (rest.length >= MAX_SAVED_ACCOUNTS) {
    rest = rest.sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_SAVED_ACCOUNTS - 1);
  }
  writeAll([...rest, next]);
}

export function forgetAccount(userId: string) {
  writeAll(readAll().filter((a) => a.userId !== userId));
}

export async function switchToAccount(account: SavedAccount) {
  const { error } = await supabase.auth.setSession({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });
  if (error) throw error;
}
