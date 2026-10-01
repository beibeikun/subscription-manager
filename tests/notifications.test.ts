import { describe, it, expect } from "vitest";
import { barkDestination, reminderMessage } from "../server/notifications.js";
import type { Event } from "../shared/model.js";
const event: Event = {
  id: "e",
  subscriptionId: "s",
  name: "Apple Music",
  category: "音乐",
  date: "2026-10-01",
  type: "renewal",
  amount: 1100,
  currency: "CNY",
  converted: null,
};
describe("Bark URL and message content", () => {
  it.each([
    "https://api.day.app",
    "https://api.day.app/",
    "https://api.day.app/push",
    "https://api.day.app/device-key/",
    "https://api.day.app/device-key/push",
  ])("normalizes %s without turning push into the body", (server) => {
    expect(barkDestination(server, "device-key/")).toEqual({
      url: "https://api.day.app/push",
      key: "device-key",
    });
  });
  it("preserves reverse proxy prefixes", () => {
    expect(
      barkDestination("https://example.com/bark/device-key/", "device-key"),
    ).toEqual({ url: "https://example.com/bark/push", key: "device-key" });
  });
  it("includes app, days, original currency and expected charge", () => {
    const result = reminderMessage(event, "2026-09-28", "Asia/Shanghai");
    expect(result.title).toBe("Apple Music · 还有 3 天续费");
    expect(result.body).toContain("Apple Music");
    expect(result.body).toContain("还有 3 天");
    expect(result.body).toContain("¥11.00");
    expect(result.body).toContain("CNY");
  });
  it("uses today on the due date", () => {
    expect(reminderMessage(event, event.date, "Asia/Shanghai").title).toBe(
      "Apple Music · 今天续费",
    );
  });
  it("does not imply a charge for nonrenewing expiry", () => {
    const result = reminderMessage(
      { ...event, type: "expiry", amount: 0 },
      "2026-09-30",
      "Asia/Shanghai",
    );
    expect(result.title).toContain("还有 1 天到期");
    expect(result.body).toContain("本次不计扣款");
    expect(result.body).not.toContain("预计扣款");
  });
  it("formats zero-decimal currency correctly", () => {
    const result = reminderMessage(
      { ...event, currency: "JPY", amount: 1200 },
      "2026-09-30",
      "Asia/Shanghai",
    );
    expect(result.body).toContain("1,200");
    expect(result.body).not.toContain("1,200.00");
  });
  it("counts calendar days across daylight saving", () => {
    expect(
      reminderMessage(
        { ...event, date: "2026-03-09" },
        "2026-03-07",
        "America/New_York",
      ).title,
    ).toContain("还有 2 天");
  });
});
