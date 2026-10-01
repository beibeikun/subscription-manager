import { DateTime } from "luxon";
export function rateSlot(s: any, now: DateTime = DateTime.now()) {
  if (!s.ratesAutoRefresh) return null;
  const local = now.setZone(s.timezone);
  const [hour, minute] = s.ratesRefreshTime.split(":").map(Number);
  let slot = local.startOf("day").set({ hour, minute });
  if (s.ratesRefreshFrequency === "weekly") {
    slot = slot.minus({
      days: (local.weekday - s.ratesRefreshWeekday + 7) % 7,
    });
    if (slot > local) slot = slot.minus({ weeks: 1 });
  } else if (slot > local) slot = slot.minus({ days: 1 });
  return slot.toMillis();
}
export function nextRateRefresh(s: any, now: DateTime = DateTime.now()) {
  const slot = rateSlot(s, now);
  if (slot === null) return null;
  return DateTime.fromMillis(slot)
    .setZone(s.timezone)
    .plus(s.ratesRefreshFrequency === "weekly" ? { weeks: 1 } : { days: 1 })
    .toISO();
}
