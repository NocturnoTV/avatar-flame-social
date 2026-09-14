import { createServerFn } from "@tanstack/react-start";

type StatusComponent = { id: string; name: string; status: string };
type StatusIncident = {
  id: string;
  name: string;
  status: string;
  impact: string;
  created_at: string;
  updated_at: string;
  shortlink?: string;
};

export const getRobloxStatus = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const response = await fetch("https://status.roblox.com/api/v2/summary.json", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error(`Roblox Status returned ${response.status}`);
    const payload = (await response.json()) as {
      status?: { indicator?: string; description?: string };
      components?: StatusComponent[];
      incidents?: StatusIncident[];
      page?: { updated_at?: string };
    };
    return {
      available: true,
      indicator: payload.status?.indicator ?? "none",
      description: payload.status?.description ?? "All Systems Operational",
      updatedAt: payload.page?.updated_at ?? new Date().toISOString(),
      components: (payload.components ?? []).filter(
        (component) => !component.name.includes("Group"),
      ),
      incidents: payload.incidents ?? [],
    };
  } catch (error) {
    console.error("Roblox status fetch failed", error);
    return {
      available: false,
      indicator: "unknown",
      description: "Roblox status is temporarily unavailable",
      updatedAt: new Date().toISOString(),
      components: [] as StatusComponent[],
      incidents: [] as StatusIncident[],
    };
  }
});
