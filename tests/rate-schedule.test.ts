import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { rateSlot, nextRateRefresh } from "../server/rate-schedule.js";
const s = {
  timezone: "Asia/Shanghai",
  ratesAutoRefresh: true,
  ratesRefreshFrequency: "daily",
  ratesRefreshTime: "09:00",
  ratesRefreshWeekday: 1,
};
describe("exchange rate schedule", () => {
  it("uses local clock and includes the scheduled minute", () => {
    const now = DateTime.fromISO("2026-09-28T09:00:00+08:00");
    expect(rateSlot(s, now)).toBe(now.toMillis());
    expect(nextRateRefresh(s, now)).toBe("2026-09-29T09:00:00.000+08:00");
    expect(rateSlot(s, now.minus({ minutes: 1 }))).toBe(
      now.minus({ days: 1 }).toMillis(),
    );
  });
  it("catches up the latest weekly slot across restart", () => {
    const now = DateTime.fromISO("2026-09-30T12:00:00+08:00");
    const weekly = { ...s, ratesRefreshFrequency: "weekly" };
    expect(rateSlot(weekly, now)).toBe(
      DateTime.fromISO("2026-09-28T09:00:00+08:00").toMillis(),
    );
    expect(nextRateRefresh(weekly, now)).toBe("2026-10-05T09:00:00.000+08:00");
  });
  it("disables the automatic schedule", () => {
    expect(rateSlot({ ...s, ratesAutoRefresh: false })).toBeNull();
    expect(nextRateRefresh({ ...s, ratesAutoRefresh: false })).toBeNull();
  });
});
