export interface RetailerJobSpec {
  slug: string;
  jobName: string;
  lockKey: string;
  cronEnvKey:
    | "BAHIA_CRON"
    | "RIOMARKET_CRON"
    | "FARMATODO_CRON"
    | "CENTRAL_MADEIRENSE_CRON"
    | "PUNTO_AL_MAYOR_CRON"
    | "VIVA_CRON"
    | "LOCATEL_CRON";
  timeoutMs: number;
}

export const RETAILER_JOB_SPECS: readonly RetailerJobSpec[] = [
  {
    slug: "bahia-la-guaira",
    jobName: "job:scrape-bahia",
    lockKey: "scrape-bahia",
    cronEnvKey: "BAHIA_CRON",
    timeoutMs: 180_000,
  },
  {
    slug: "riomarket-caracas",
    jobName: "job:scrape-riomarket",
    lockKey: "scrape-riomarket",
    cronEnvKey: "RIOMARKET_CRON",
    timeoutMs: 180_000,
  },
  {
    slug: "farmatodo-ve",
    jobName: "job:scrape-farmatodo",
    lockKey: "scrape-farmatodo",
    cronEnvKey: "FARMATODO_CRON",
    timeoutMs: 180_000,
  },
  {
    slug: "central-madeirense",
    jobName: "job:scrape-central-madeirense",
    lockKey: "scrape-central-madeirense",
    cronEnvKey: "CENTRAL_MADEIRENSE_CRON",
    timeoutMs: 180_000,
  },
  {
    slug: "puntoalmayor-la-guaira",
    jobName: "job:scrape-punto-al-mayor",
    lockKey: "scrape-punto-al-mayor",
    cronEnvKey: "PUNTO_AL_MAYOR_CRON",
    timeoutMs: 180_000,
  },
  {
    slug: "viva-la-guaira",
    jobName: "job:scrape-viva",
    lockKey: "scrape-viva",
    cronEnvKey: "VIVA_CRON",
    timeoutMs: 180_000,
  },
  {
    slug: "locatel-caracas",
    jobName: "job:scrape-locatel",
    lockKey: "scrape-locatel",
    cronEnvKey: "LOCATEL_CRON",
    timeoutMs: 180_000,
  },
] as const;

export const RETAILER_SLUGS: readonly string[] = RETAILER_JOB_SPECS.map(
  (spec) => spec.slug
);
