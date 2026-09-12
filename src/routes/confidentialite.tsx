import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/confidentialite")({
  beforeLoad: () => {
    throw redirect({ to: "/privacy", replace: true });
  },
});
