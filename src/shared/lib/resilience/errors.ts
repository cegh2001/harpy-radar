/**
 * Pure error classification helpers for retry and circuit-breaker boundaries.
 */

export class CircuitOpenError extends Error {
  constructor(public readonly breakerName: string) {
    super(`Circuit breaker '${breakerName}' is open`);
    this.name = "CircuitOpenError";
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (error instanceof TypeError) {
    return true;
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: number }).status;
    return status >= 500 || status === 408 || status === 429;
  }
  return false;
}
