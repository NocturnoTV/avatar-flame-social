import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Prefetches a route's code (and loader data) as soon as a finger/cursor
    // touches its link, instead of waiting for the actual click - without
    // this, every navigation pays the full chunk-load latency up front,
    // which is exactly the "changing pages feels slow" complaint.
    defaultPreload: "intent",
  });

  return router;
};
