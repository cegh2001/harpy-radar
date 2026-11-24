import { describe, expect, it } from "vitest";
import {
  getCaracasDateKey,
  getMsUntilNextBcvWindow,
  getNextBcvWindowStartTime,
  isWithinBcvPublishWindow,
} from "@/shared/lib/date/caracas-date";

describe("caracas-date utilities", () => {
  it("formats UTC timestamps into America/Caracas calendar dates", () => {
    // 2026-11-25T02:30:00Z is 2026-11-24T22:30:00-04:00 in Caracas
    const dateKey = getCaracasDateKey("2026-11-25T02:30:00Z");
    expect(dateKey).toBe("2026-11-24");
  });

  it("detects official BCV publish window on weekdays between 15:00 and 18:59 Caracas", () => {
    // Tuesday 2026-11-24 16:00 Caracas = 20:00 UTC
    expect(isWithinBcvPublishWindow("2026-11-24T20:00:00Z")).toBe(true);
    // Tuesday 2026-11-24 14:59 Caracas = 18:59 UTC
    expect(isWithinBcvPublishWindow("2026-11-24T18:59:00Z")).toBe(false);
    // Saturday 2026-11-28 16:00 Caracas = 20:00 UTC
    expect(isWithinBcvPublishWindow("2026-11-28T20:00:00Z")).toBe(false);
  });

  it("skips weekend when computing next BCV publish window after Friday 15:00", () => {
    // Friday 2026-11-27 16:00 Caracas (20:00 UTC) -> Monday 2026-11-30 15:00 Caracas (19:00 UTC)
    const nextWindow = getNextBcvWindowStartTime("2026-11-27T20:00:00Z");
    expect(nextWindow.toISOString()).toBe("2026-11-30T19:00:00.000Z");

    const ms = getMsUntilNextBcvWindow("2026-11-27T20:00:00Z");
    expect(ms).toBe(71 * 60 * 60 * 1000);
  });
});
