import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/regles")({
  beforeLoad: () => {
    throw redirect({ to: "/community-guidelines", replace: true });
  },
});
