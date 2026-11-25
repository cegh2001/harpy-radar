export const DASHBOARD_TABS = ["products", "charts", "health"] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export const DEFAULT_DASHBOARD_TAB: DashboardTab = "products";

export function parseDashboardTab(
  value: string | string[] | null | undefined
): DashboardTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return DEFAULT_DASHBOARD_TAB;

  const normalized = raw.trim().toLowerCase();
  if (
    normalized === "products" ||
    normalized === "charts" ||
    normalized === "health"
  ) {
    return normalized;
  }

  return DEFAULT_DASHBOARD_TAB;
}

export function buildDashboardTabUrl(
  pathname: string,
  currentSearch: string,
  nextTab: DashboardTab
): string {
  const query = currentSearch.startsWith("?")
    ? currentSearch.slice(1)
    : currentSearch;
  const params = new URLSearchParams(query);
  params.set("tab", nextTab);
  return `${pathname}?${params.toString()}`;
}
