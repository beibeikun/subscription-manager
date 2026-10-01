import { describe, it, expect } from "vitest";
import {
  events,
  convert,
  minor,
  subscriptionSchema,
  type Subscription,
} from "../shared/model.js";
const sub = (changes: Partial<Subscription> = {}): Subscription => ({
  id: "test",
  name: "测试会员",
  kind: "recurring",
  start: "2024-01-31",
  autoRenew: true,
  category: "工具",
  notes: "",
  website: "",
  archived: false,
  reminders: null,
  rules: [
    {
      effective: "2024-01-31",
      amount: 1000,
      currency: "CNY",
      unit: "months",
      interval: 1,
    },
  ],
  ...changes,
});
describe("calendar billing engine", () => {
  it("retains month-end anchor through leap February", () => {
    expect(
      events(sub(), "2024-01-01", "2024-04-30").map((e) => e.date),
    ).toEqual(["2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30"]);
  });
  it("restores leap-day annual anchor", () => {
    const s = sub({
      start: "2024-02-29",
      rules: [
        {
          effective: "2024-02-29",
          amount: 100,
          currency: "USD",
          unit: "years",
          interval: 1,
        },
      ],
    });
    expect(events(s, "2025-01-01", "2028-12-31").map((e) => e.date)).toEqual([
      "2025-02-28",
      "2026-02-28",
      "2027-02-28",
      "2028-02-29",
    ]);
  });
  it("stops charges at expiry", () => {
    const es = events(
      sub({ autoRenew: false, end: "2024-03-31" }),
      "2024-01-01",
      "2024-12-31",
    );
    expect(es.map((e) => e.type)).toEqual(["purchase", "renewal", "expiry"]);
    expect(es.at(-1)?.amount).toBe(0);
  });
  it("lifetime charges exactly once", () => {
    expect(
      events(sub({ kind: "lifetime" }), "2024-01-01", "2040-12-31"),
    ).toHaveLength(1);
  });
  it("keeps historical rule and starts new anchor", () => {
    const s = sub();
    s.rules.push({
      effective: "2024-03-31",
      amount: 2500,
      currency: "CNY",
      unit: "months",
      interval: 3,
    });
    expect(
      events(s, "2024-01-01", "2024-07-01").map((e) => [e.date, e.amount]),
    ).toEqual([
      ["2024-01-31", 1000],
      ["2024-02-29", 1000],
      ["2024-03-31", 2500],
      ["2024-06-30", 2500],
    ]);
  });
  it("does not charge before start and allows zero", () => {
    expect(events(sub(), "2023-01-01", "2023-12-31")).toEqual([]);
    const s = sub();
    s.rules[0].amount = 0;
    expect(events(s, "2024-01-31", "2024-01-31")[0].amount).toBe(0);
  });
  it("handles currency precision and missing rates", () => {
    expect(minor("12.345", "CNY")).toBe(1235);
    expect(minor("100", "JPY")).toBe(100);
    const e = events(sub(), "2024-01-31", "2024-01-31")[0];
    expect(convert(e, "USD", { CNY: 0.14 }).converted).toBe(1.4);
    expect(convert(e, "USD", {}).converted).toBeNull();
  });
  it("requires end date when not renewing", () => {
    expect(
      subscriptionSchema.safeParse(sub({ autoRenew: false })).success,
    ).toBe(false);
  });
  it("generates daily intervals without drift", () => {
    const s = sub({
      start: "2026-01-01",
      rules: [
        {
          effective: "2026-01-01",
          amount: 100,
          currency: "CNY",
          unit: "days",
          interval: 3,
        },
      ],
    });
    expect(events(s, "2026-01-02", "2026-01-10").map((e) => e.date)).toEqual([
      "2026-01-04",
      "2026-01-07",
      "2026-01-10",
    ]);
  });
  it("queries 1,000 annual subscriptions", () => {
    const start = performance.now();
    let count = 0;
    for (let i = 0; i < 1000; i++)
      count += events(sub(), "2026-01-01", "2026-12-31").length;
    expect(count).toBe(12000);
    console.info(
      "1000 subscription computation milliseconds:",
      performance.now() - start,
    );
  });
});
