import { createFileRoute, redirect } from "@tanstack/react-router";

// The standalone guest mini-feed is retired - guests now get real (read-only)
// access to the actual app via the same _authenticated shell as everyone
// else (see continueAsGuest() in auth.tsx and the beforeLoad guard in
// _authenticated/route.tsx). This route stays as a redirect so any old
// bookmarks/links to /guest still land somewhere useful.
export const Route = createFileRoute("/guest")({
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
});
