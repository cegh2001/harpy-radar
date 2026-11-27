export const MIN_OUTLIER_SAMPLE_SIZE = 3;
export const HIGH_SPREAD_ARBITRATION_THRESHOLD_PCT = 80;
export const MAD_SCALE_FACTOR = 0.67448975;
export const MODIFIED_Z_THRESHOLD = 3.5;
export const MIN_LOW_OUTLIER_RATIO = 0.55;
export const MIN_HIGH_OUTLIER_RATIO = 1.75;
export const SEVERE_LOW_OUTLIER_RATIO = 0.45;
export const SEVERE_HIGH_OUTLIER_RATIO = 2.2;

export type OutlierStatus = "normal" | "low_outlier" | "high_outlier";

export interface PriceOutlierClassification {
  value: number;
  status: OutlierStatus;
  deviationFromMedianPct: number | null;
  modifiedZScore: number | null;
}

export interface DispersionAnalysis {
  median: number | null;
  mad: number | null;
  rawSpreadPct: number | null;
  robustSpreadPct: number | null;
  outlierCount: number;
  lowOutlierCount: number;
  highOutlierCount: number;
  needsArbitration: boolean;
  classifications: PriceOutlierClassification[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeSpreadPct(sortedValues: readonly number[]): number | null {
  if (sortedValues.length < 2 || sortedValues[0] <= 0) {
    return null;
  }
  const min = sortedValues[0];
  const max = sortedValues[sortedValues.length - 1];
  return round2(((max - min) / min) * 100);
}

/**
 * Returns the median of an already-sorted numeric array, or 0 if empty.
 */
export function computeMedian(sortedValues: readonly number[]): number {
  if (sortedValues.length === 0) return 0;
  const mid = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 0) {
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  }
  return sortedValues[mid];
}

/**
 * Classifies a single price against a precomputed median and MAD using a
 * hybrid modified-Z-score + relative-ratio rule.
 */
export function classifySinglePriceAgainstReference(
  value: number,
  median: number | null,
  mad: number | null,
  sampleSize: number
): PriceOutlierClassification {
  if (
    median === null ||
    median <= 0 ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return {
      value,
      status: "normal",
      deviationFromMedianPct: null,
      modifiedZScore: null,
    };
  }

  const deviationFromMedianPct = round2(((value - median) / median) * 100);
  if (sampleSize < MIN_OUTLIER_SAMPLE_SIZE) {
    return {
      value,
      status: "normal",
      deviationFromMedianPct,
      modifiedZScore: null,
    };
  }

  const ratio = value / median;
  if (mad === null || mad / median < 1e-6) {
    const status: OutlierStatus =
      ratio < MIN_LOW_OUTLIER_RATIO
        ? "low_outlier"
        : ratio > MIN_HIGH_OUTLIER_RATIO
          ? "high_outlier"
          : "normal";
    return {
      value,
      status,
      deviationFromMedianPct,
      modifiedZScore: null,
    };
  }

  const modifiedZScore = round2((MAD_SCALE_FACTOR * (value - median)) / mad);
  let status: OutlierStatus = "normal";
  if (
    ratio < MIN_LOW_OUTLIER_RATIO &&
    (modifiedZScore <= -MODIFIED_Z_THRESHOLD || ratio <= SEVERE_LOW_OUTLIER_RATIO)
  ) {
    status = "low_outlier";
  } else if (
    ratio > MIN_HIGH_OUTLIER_RATIO &&
    (modifiedZScore >= MODIFIED_Z_THRESHOLD || ratio >= SEVERE_HIGH_OUTLIER_RATIO)
  ) {
    status = "high_outlier";
  }

  return {
    value,
    status,
    deviationFromMedianPct,
    modifiedZScore,
  };
}

/**
 * Computes robust dispersion metrics (median, MAD, raw/robust spread, and
 * per-element outlier classifications) while preserving input order.
 */
export function analyzePriceDispersion(
  values: readonly number[]
): DispersionAnalysis {
  const positiveSorted = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  const sampleSize = positiveSorted.length;
  const median = sampleSize > 0 ? computeMedian(positiveSorted) : null;
  const mad =
    median !== null
      ? computeMedian(
          positiveSorted
            .map((value) => Math.abs(value - median))
            .sort((a, b) => a - b)
        )
      : null;

  const rawSpreadPct = computeSpreadPct(positiveSorted);
  const classifications = values.map((value) =>
    classifySinglePriceAgainstReference(value, median, mad, sampleSize)
  );

  const normalSorted = classifications
    .filter(
      (entry) =>
        entry.status === "normal" &&
        Number.isFinite(entry.value) &&
        entry.value > 0
    )
    .map((entry) => entry.value)
    .sort((a, b) => a - b);

  const robustSpreadPct = computeSpreadPct(normalSorted);

  let lowOutlierCount = 0;
  let highOutlierCount = 0;
  for (const entry of classifications) {
    if (entry.status === "low_outlier") lowOutlierCount += 1;
    else if (entry.status === "high_outlier") highOutlierCount += 1;
  }

  const outlierCount = lowOutlierCount + highOutlierCount;
  const needsArbitration =
    outlierCount > 0 ||
    (rawSpreadPct !== null &&
      rawSpreadPct >= HIGH_SPREAD_ARBITRATION_THRESHOLD_PCT);

  return {
    median,
    mad,
    rawSpreadPct,
    robustSpreadPct,
    outlierCount,
    lowOutlierCount,
    highOutlierCount,
    needsArbitration,
    classifications,
  };
}
