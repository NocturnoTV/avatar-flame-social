import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/decouvrir/studio")({
  beforeLoad: () => {
    throw redirect({ to: "/discover/studio", replace: true });
  },
});
