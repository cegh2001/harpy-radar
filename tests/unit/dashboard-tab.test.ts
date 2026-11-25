import { describe, expect, it } from "vitest";
import {
  buildDashboardTabUrl,
  DEFAULT_DASHBOARD_TAB,
  parseDashboardTab,
} from "@/features/basket/domain/dashboard-tab";

describe("parseDashboardTab", () => {
  it("accepts valid tab identifiers", () => {
    expect(parseDashboardTab("products")).toBe("products");
    expect(parseDashboardTab("charts")).toBe("charts");
    expect(parseDashboardTab("health")).toBe("health");
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(parseDashboardTab(" Charts ")).toBe("charts");
    expect(parseDashboardTab("HEALTH")).toBe("health");
  });

  it("reads the first element when given a string array", () => {
    expect(parseDashboardTab(["health", "products"])).toBe("health");
    expect(parseDashboardTab([])).toBe(DEFAULT_DASHBOARD_TAB);
  });

  it("falls back to products for missing or invalid values", () => {
    expect(parseDashboardTab(null)).toBe("products");
    expect(parseDashboardTab(undefined)).toBe("products");
    expect(parseDashboardTab("")).toBe("products");
    expect(parseDashboardTab("unknown")).toBe("products");
  });
});

describe("buildDashboardTabUrl", () => {
  it("adds tab param when search string is empty", () => {
    expect(buildDashboardTabUrl("/", "", "charts")).toBe("/?tab=charts");
  });

  it("replaces existing tab param while preserving other search params", () => {
    expect(
      buildDashboardTabUrl("/", "region=Caracas&tab=products", "health")
    ).toBe("/?region=Caracas&tab=health");
  });

  it("handles a leading question mark in currentSearch", () => {
    expect(buildDashboardTabUrl("/", "?q=arroz&tab=charts", "products")).toBe(
      "/?q=arroz&tab=products"
    );
  });
});
