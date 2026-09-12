import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/profil")({
  beforeLoad: () => {
    throw redirect({ to: "/profile", replace: true });
  },
});
