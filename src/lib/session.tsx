import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { rememberAccount } from "@/lib/accountSwitcher";
import { isNativeApp } from "@/lib/native";

type SessionValue = { session: Session | null; user: User | null; loading: boolean };

const SessionContext = createContext<SessionValue>({ session: null, user: null, loading: true });

// In the native iOS/Android shell the auth session lives in the WebView's
// localStorage, which the OS is allowed to purge (storage pressure, some
// updates) - when that happens the app used to fall back to the sign-in
// screen even though the person never logged out. So on native we also
// mirror the tokens into Capacitor Preferences (real on-device storage the
// OS won't clear) and silently restore from there on launch: you log in
// once, the app stays logged in.
const NATIVE_SESSION_KEY = "bloxspark-native-session";

async function nativeSaveSession(session: Session | null) {
  if (!isNativeApp()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    if (session?.access_token && session.refresh_token) {
      await Preferences.set({
        key: NATIVE_SESSION_KEY,
        value: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }),
      });
    } else {
      await Preferences.remove({ key: NATIVE_SESSION_KEY });
    }
  } catch {
    // Backup unavailable - the WebView copy still works, just less durable.
  }
}

async function nativeRestoreSession(): Promise<Session | null> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: NATIVE_SESSION_KEY });
    if (!value) return null;
    const tokens = JSON.parse(value) as { access_token?: string; refresh_token?: string };
    if (!tokens.access_token || !tokens.refresh_token) return null;
    const { data, error } = await supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    if (error || !data.session) {
      // Tokens no longer valid (e.g. refresh token rotated elsewhere) - drop
      // the stale backup so we don't keep retrying it on every launch.
      await Preferences.remove({ key: NATIVE_SESSION_KEY });
      return null;
    }
    return data.session;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      if (event === "SIGNED_OUT") void nativeSaveSession(null);
      else if (next) void nativeSaveSession(next);
      if (next?.access_token && next.refresh_token) {
        rememberAccount({
          userId: next.user.id,
          accessToken: next.access_token,
          refreshToken: next.refresh_token,
          touch: event === "SIGNED_IN",
        });
      }
    });
    supabase.auth.getSession().then(async ({ data: d }) => {
      let current = d.session;
      if (!current && isNativeApp()) {
        current = await nativeRestoreSession();
      }
      setSession(current);
      setLoading(false);
      if (current?.access_token && current.refresh_token) {
        rememberAccount({
          userId: current.user.id,
          accessToken: current.access_token,
          refreshToken: current.refresh_token,
        });
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <SessionContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
