export const CARACAS_TIME_ZONE = "America/Caracas";

function toValidDate(value: Date | string | number): Date {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date value");
  }
  return parsed;
}

/**
 * Formats any timestamp into a YYYY-MM-DD calendar key in America/Caracas.
 */
export function getCaracasDateKey(
  value: Date | string | number = new Date()
): string {
  const date = toValidDate(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CARACAS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to format Caracas date key");
  }

  return `${year}-${month}-${day}`;
}

export function getCaracasTimeParts(
  value: Date | string | number = new Date()
): {
  weekday: string;
  hour: number;
  minute: number;
} {
  const date = toValidDate(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CARACAS_TIME_ZONE,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hourStr = parts.find((part) => part.type === "hour")?.value ?? "0";
  const minuteStr = parts.find((part) => part.type === "minute")?.value ?? "0";

  return {
    weekday,
    hour: Number.parseInt(hourStr, 10),
    minute: Number.parseInt(minuteStr, 10),
  };
}

/**
 * Returns true during the official BCV publishing window:
 * Monday to Friday between 15:00 and 18:59:59 America/Caracas.
 */
export function isWithinBcvPublishWindow(
  value: Date | string | number = new Date()
): boolean {
  const { weekday, hour } = getCaracasTimeParts(value);
  const isBusinessDay = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);
  if (!isBusinessDay) return false;
  return hour >= 15 && hour < 19;
}

/**
 * Computes the next 15:00 America/Caracas (19:00 UTC) banking window start.
 */
export function getNextBcvWindowStartTime(
  value: Date | string | number = new Date()
): Date {
  const now = toValidDate(value);
  const nowMs = now.getTime();
  const todayKey = getCaracasDateKey(now);
  const [year, month, day] = todayKey.split("-").map(Number);

  // Venezuela uses UTC-4 year-round (no DST), so 15:00 Caracas is 19:00 UTC.
  const today1500Utc = new Date(Date.UTC(year, month - 1, day, 19, 0, 0, 0));
  const { weekday } = getCaracasTimeParts(now);

  if (weekday === "Sat") {
    return new Date(today1500Utc.getTime() + 2 * 24 * 60 * 60 * 1000);
  }
  if (weekday === "Sun") {
    return new Date(today1500Utc.getTime() + 1 * 24 * 60 * 60 * 1000);
  }
  if (weekday === "Fri") {
    if (nowMs < today1500Utc.getTime()) {
      return today1500Utc;
    }
    return new Date(today1500Utc.getTime() + 3 * 24 * 60 * 60 * 1000);
  }
  if (nowMs < today1500Utc.getTime()) {
    return today1500Utc;
  }
  return new Date(today1500Utc.getTime() + 1 * 24 * 60 * 60 * 1000);
}

export function getMsUntilNextBcvWindow(
  value: Date | string | number = new Date()
): number {
  const now = toValidDate(value);
  const target = getNextBcvWindowStartTime(now);
  return Math.max(1000, target.getTime() - now.getTime());
}
