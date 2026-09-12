import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/decouvrir/")({
  beforeLoad: () => {
    throw redirect({ to: "/discover", replace: true });
  },
});
