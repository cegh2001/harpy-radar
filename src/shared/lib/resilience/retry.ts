import { isRetryableError } from "./errors";

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number) => void;
  sleepFn?: (ms: number) => Promise<void>;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;

export function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries an async operation using exponential backoff with full jitter.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const maxAttempts = config?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = config?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = config?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const shouldRetry = config?.shouldRetry ?? isRetryableError;
  const onRetry = config?.onRetry;
  const sleep = config?.sleepFn ?? defaultSleep;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      if (isLastAttempt || !shouldRetry(error, attempt)) {
        throw error;
      }
      onRetry?.(error, attempt);
      const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const delay = Math.random() * cap;
      await sleep(delay);
    }
  }

  throw new Error("withRetry: unreachable");
}
