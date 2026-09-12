import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/parametres")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", replace: true });
  },
});
