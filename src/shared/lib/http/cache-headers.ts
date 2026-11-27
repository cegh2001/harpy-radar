export const PUBLIC_API_CACHE_CONTROL =
  "public, s-maxage=300, stale-while-revalidate=600";

export const NO_STORE_CACHE_CONTROL = "no-store";

export const PUBLIC_API_CACHE_HEADERS = {
  "Cache-Control": PUBLIC_API_CACHE_CONTROL,
} as const;

export const NO_STORE_HEADERS = {
  "Cache-Control": NO_STORE_CACHE_CONTROL,
} as const;
