import { describe, expect, it } from "vitest";
import {
  analyzePriceDispersion,
  classifySinglePriceAgainstReference,
  computeMedian,
} from "@/features/basket/domain/dispersion-outliers";

describe("dispersion-outliers", () => {
  it("handles empty and single-element inputs without flagging outliers", () => {
    expect(computeMedian([])).toBe(0);

    const empty = analyzePriceDispersion([]);
    expect(empty.median).toBeNull();
    expect(empty.mad).toBeNull();
    expect(empty.rawSpreadPct).toBeNull();
    expect(empty.robustSpreadPct).toBeNull();
    expect(empty.outlierCount).toBe(0);
    expect(empty.needsArbitration).toBe(false);
    expect(empty.classifications).toStrictEqual([]);

    const single = analyzePriceDispersion([2.5]);
    expect(single.median).toBe(2.5);
    expect(single.mad).toBe(0);
    expect(single.rawSpreadPct).toBeNull();
    expect(single.robustSpreadPct).toBeNull();
    expect(single.outlierCount).toBe(0);
    expect(single.needsArbitration).toBe(false);
    expect(single.classifications).toStrictEqual([
      {
        value: 2.5,
        status: "normal",
        deviationFromMedianPct: 0,
        modifiedZScore: null,
      },
    ]);
  });

  it("does not flag outliers when n < 3 even if raw spread triggers arbitration", () => {
    const pair = analyzePriceDispersion([1.0, 2.5]);
    expect(pair.median).toBe(1.75);
    expect(pair.rawSpreadPct).toBe(150);
    expect(pair.robustSpreadPct).toBe(150);
    expect(pair.outlierCount).toBe(0);
    expect(pair.needsArbitration).toBe(true);
    expect(pair.classifications.map((c) => c.status)).toStrictEqual([
      "normal",
      "normal",
    ]);
  });

  it("avoids false positives on tight-MAD retail clusters with moderate variation", () => {
    const result = analyzePriceDispersion([1.0, 1.02, 1.04, 1.25]);
    expect(result.outlierCount).toBe(0);
    expect(result.rawSpreadPct).toBe(25);
    expect(result.robustSpreadPct).toBe(25);
    expect(result.needsArbitration).toBe(false);
    expect(result.classifications.map((c) => c.status)).toStrictEqual([
      "normal",
      "normal",
      "normal",
      "normal",
    ]);
  });

  it("flags low outliers and computes robustSpreadPct over normal offers only", () => {
    const result = analyzePriceDispersion([0.4, 1.15, 1.2, 1.25]);
    expect(result.lowOutlierCount).toBe(1);
    expect(result.highOutlierCount).toBe(0);
    expect(result.outlierCount).toBe(1);
    expect(result.needsArbitration).toBe(true);
    expect(result.rawSpreadPct).toBe(212.5);
    expect(result.robustSpreadPct).toBeCloseTo(8.7, 2);
    expect(result.classifications[0].status).toBe("low_outlier");
    expect(result.classifications.slice(1).map((c) => c.status)).toStrictEqual([
      "normal",
      "normal",
      "normal",
    ]);
  });

  it("flags high outliers and preserves input order for unsorted inputs", () => {
    const result = analyzePriceDispersion([3.6, 1.2, 1.1, 1.25, 1.15]);
    expect(result.highOutlierCount).toBe(1);
    expect(result.outlierCount).toBe(1);
    expect(result.needsArbitration).toBe(true);
    expect(result.rawSpreadPct).toBeCloseTo(227.27, 2);
    expect(result.robustSpreadPct).toBeCloseTo(13.64, 2);
    expect(result.classifications[0].status).toBe("high_outlier");
    expect(result.classifications.slice(1).map((c) => c.status)).toStrictEqual([
      "normal",
      "normal",
      "normal",
      "normal",
    ]);
  });

  it("safely handles zero-MAD panels without dividing by zero", () => {
    const result = analyzePriceDispersion([1.0, 1.0, 1.0, 2.5]);
    expect(result.mad).toBe(0);
    expect(result.highOutlierCount).toBe(1);
    expect(result.outlierCount).toBe(1);
    expect(result.rawSpreadPct).toBe(150);
    expect(result.robustSpreadPct).toBe(0);
    expect(result.classifications[3].status).toBe("high_outlier");
    expect(result.classifications[3].modifiedZScore).toBeNull();
  });

  it("classifies out-of-sample values against reference median and MAD", () => {
    const outOfSample = classifySinglePriceAgainstReference(
      3.2,
      1.2,
      0.05,
      4
    );
    expect(outOfSample.status).toBe("high_outlier");
    expect(outOfSample.deviationFromMedianPct).toBeCloseTo(166.67, 2);
  });
});
