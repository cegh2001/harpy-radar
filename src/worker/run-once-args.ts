export type RunOnceJobTarget =
  | "all"
  | "rates"
  | "rates-official"
  | "rates-parallel"
  | "retailers"
  | "arbitrate";

export interface RunOnceOptions {
  job: RunOnceJobTarget;
  retailerSlug: string | null;
  skipBootstrap: boolean;
}

const VALID_JOB_TARGETS: readonly RunOnceJobTarget[] = [
  "all",
  "rates",
  "rates-official",
  "rates-parallel",
  "retailers",
  "arbitrate",
];

function isValidJobTarget(value: string): value is RunOnceJobTarget {
  return (VALID_JOB_TARGETS as readonly string[]).includes(value);
}

function readFlagValue(
  argv: readonly string[],
  index: number,
  flagName: string,
  inlineValue?: string
): { value: string; nextIndex: number } {
  if (inlineValue !== undefined) {
    if (!inlineValue) {
      throw new Error(`Missing value for ${flagName}`);
    }
    return { value: inlineValue, nextIndex: index };
  }

  const nextArg = argv[index + 1];
  if (!nextArg || nextArg.startsWith("--")) {
    throw new Error(`Missing value for ${flagName}`);
  }
  return { value: nextArg, nextIndex: index + 1 };
}

export function parseRunOnceArgs(
  argv: readonly string[],
  validRetailerSlugs: readonly string[]
): RunOnceOptions {
  let explicitJob: RunOnceJobTarget | null = null;
  let retailerSlug: string | null = null;
  let skipBootstrap = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      continue;
    }

    if (arg === "--skip-bootstrap") {
      skipBootstrap = true;
      continue;
    }

    if (arg === "--job" || arg.startsWith("--job=")) {
      const inline = arg.startsWith("--job=") ? arg.slice(6) : undefined;
      const { value, nextIndex } = readFlagValue(argv, i, "--job", inline);
      if (!isValidJobTarget(value)) {
        throw new Error(
          `Invalid --job value "${value}". Valid values: ${VALID_JOB_TARGETS.join(", ")}`
        );
      }
      explicitJob = value;
      i = nextIndex;
      continue;
    }

    if (arg === "--retailer" || arg.startsWith("--retailer=")) {
      const inline = arg.startsWith("--retailer=") ? arg.slice(11) : undefined;
      const { value, nextIndex } = readFlagValue(
        argv,
        i,
        "--retailer",
        inline
      );
      if (!validRetailerSlugs.includes(value)) {
        throw new Error(
          `Unknown --retailer "${value}". Valid retailers: ${validRetailerSlugs.join(", ")}`
        );
      }
      retailerSlug = value;
      i = nextIndex;
      continue;
    }

    throw new Error(`Unknown argument "${arg}"`);
  }

  if (
    retailerSlug !== null &&
    explicitJob !== null &&
    explicitJob !== "retailers"
  ) {
    throw new Error(
      "--retailer can only be used with --job=retailers (or omitted --job)"
    );
  }

  return {
    job: explicitJob ?? (retailerSlug !== null ? "retailers" : "all"),
    retailerSlug,
    skipBootstrap,
  };
}
