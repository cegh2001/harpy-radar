import { describe, expect, it } from "vitest";
import { RETAILER_SLUGS } from "@/worker/jobs/retailer-jobs";
import { parseRunOnceArgs } from "@/worker/run-once-args";

describe("parseRunOnceArgs", () => {
  it("defaults to running all jobs with bootstrap enabled", () => {
    expect(parseRunOnceArgs([], RETAILER_SLUGS)).toStrictEqual({
      job: "all",
      retailerSlug: null,
      skipBootstrap: false,
    });
  });

  it("ignores bare '--' forwarded by pnpm", () => {
    expect(
      parseRunOnceArgs(
        ["--", "--job=rates-official", "--skip-bootstrap"],
        RETAILER_SLUGS
      )
    ).toStrictEqual({
      job: "rates-official",
      retailerSlug: null,
      skipBootstrap: true,
    });
  });

  it("parses space-separated and equals-separated --job and --retailer flags", () => {
    expect(
      parseRunOnceArgs(["--job", "rates-parallel"], RETAILER_SLUGS)
    ).toStrictEqual({
      job: "rates-parallel",
      retailerSlug: null,
      skipBootstrap: false,
    });

    expect(
      parseRunOnceArgs(["--job=retailers"], RETAILER_SLUGS)
    ).toStrictEqual({
      job: "retailers",
      retailerSlug: null,
      skipBootstrap: false,
    });

    expect(
      parseRunOnceArgs(["--retailer=farmatodo-ve"], RETAILER_SLUGS)
    ).toStrictEqual({
      job: "retailers",
      retailerSlug: "farmatodo-ve",
      skipBootstrap: false,
    });

    expect(
      parseRunOnceArgs(
        ["--job=retailers", "--retailer", "bahia-la-guaira", "--skip-bootstrap"],
        RETAILER_SLUGS
      )
    ).toStrictEqual({
      job: "retailers",
      retailerSlug: "bahia-la-guaira",
      skipBootstrap: true,
    });
  });

  it("rejects invalid job values, unknown retailers, missing values, and incompatible combinations", () => {
    expect(() =>
      parseRunOnceArgs(["--job=unknown"], RETAILER_SLUGS)
    ).toThrow('Invalid --job value "unknown"');

    expect(() =>
      parseRunOnceArgs(["--retailer=non-existent"], RETAILER_SLUGS)
    ).toThrow('Unknown --retailer "non-existent"');

    expect(() =>
      parseRunOnceArgs(
        ["--job=rates-official", "--retailer=farmatodo-ve"],
        RETAILER_SLUGS
      )
    ).toThrow("--retailer can only be used with --job=retailers");

    expect(() =>
      parseRunOnceArgs(
        ["--job=all", "--retailer=farmatodo-ve"],
        RETAILER_SLUGS
      )
    ).toThrow("--retailer can only be used with --job=retailers");

    expect(() => parseRunOnceArgs(["--job"], RETAILER_SLUGS)).toThrow(
      "Missing value for --job"
    );

    expect(() => parseRunOnceArgs(["--bogus"], RETAILER_SLUGS)).toThrow(
      'Unknown argument "--bogus"'
    );
  });
});
