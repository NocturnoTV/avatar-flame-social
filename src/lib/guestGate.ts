import { useState } from "react";
import { useSession } from "@/lib/session";

/**
 * Guests get real (read-only) access to the app now instead of a separate
 * mini feed - this is the shared gate for anything that writes (like,
 * comment, follow, post, join, send...). Call `requireAuth()` at the top of
 * a handler; it opens the sign-up prompt and returns false when there's no
 * session, so the caller can bail before touching the network.
 */
export function useGuestGate() {
  const { user } = useSession();
  const [promptOpen, setPromptOpen] = useState(false);
  const isGuest = !user;

  function requireAuth(): boolean {
    if (isGuest) {
      setPromptOpen(true);
      return false;
    }
    return true;
  }

  return { isGuest, requireAuth, promptOpen, closePrompt: () => setPromptOpen(false) };
}
