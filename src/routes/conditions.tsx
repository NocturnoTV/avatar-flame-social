import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/conditions")({
  beforeLoad: () => {
    throw redirect({ to: "/terms", replace: true });
  },
});
