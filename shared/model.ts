import { z } from "zod";
import { DateTime } from "luxon";
import { Decimal } from "decimal.js";
const date = z
  .string()
  .refine(
    (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && DateTime.fromISO(v).isValid,
    "日期无效",
  );
export const ruleSchema = z.object({
  effective: date,
  amount: z.number().int().min(0).max(1e12),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .refine(
      (v) => Intl.supportedValuesOf("currency").includes(v),
      "币种代码无效",
    ),
  unit: z.enum(["days", "weeks", "months", "years"]),
  interval: z.number().int().min(1).max(1000),
});
export const subscriptionSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(100),
    kind: z.enum(["recurring", "lifetime"]),
    start: date,
    autoRenew: z.boolean(),
    end: date.nullable().optional(),
    category: z.string().trim().min(1).max(40).default("未分类"),
    logo: z
      .string()
      .regex(/^[a-f0-9-]+\.webp$/)
      .nullable()
      .optional(),
    notes: z.string().max(4000).default(""),
    website: z
      .union([z.literal(""), z.url().refine((v) => /^https?:/.test(v))])
      .default(""),
    archived: z.boolean().default(false),
    reminders: z
      .array(z.number().int().min(0).max(365))
      .max(10)
      .nullable()
      .default(null),
    rules: z.array(ruleSchema).min(1).max(1000),
  })
  .superRefine((s, c) => {
    if (s.rules[0]?.effective !== s.start)
      c.addIssue({
        code: "custom",
        message: "首条规则必须从开始日期生效",
        path: ["rules"],
      });
    if (s.kind === "recurring" && !s.autoRenew && (!s.end || s.end <= s.start))
      c.addIssue({
        code: "custom",
        message: "关闭续费需指定晚于开始日期的到期日",
        path: ["end"],
      });
    for (let i = 1; i < s.rules.length; i++)
      if (s.rules[i].effective <= s.rules[i - 1].effective)
        c.addIssue({
          code: "custom",
          message: "规则日期必须递增",
          path: ["rules"],
        });
  });
export type Subscription = z.infer<typeof subscriptionSchema> & { id: string };
export type Event = {
  id: string;
  subscriptionId: string;
  name: string;
  category: string;
  date: string;
  type: "purchase" | "renewal" | "expiry";
  amount: number;
  currency: string;
  converted: number | null;
};
export function digits(currency: string) {
  try {
    return (
      new Intl.NumberFormat("en", {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}
export function minor(value: string | number, currency: string) {
  return new Decimal(value)
    .mul(10 ** digits(currency))
    .toDecimalPlaces(0)
    .toNumber();
}
export function major(value: number, currency: string) {
  return new Decimal(value).div(10 ** digits(currency)).toNumber();
}
export function events(
  s: Subscription,
  from: string,
  to: string,
  limitCount = Infinity,
): Event[] {
  const result: Event[] = [];
  const push = (
    date: string,
    type: Event["type"],
    r: Subscription["rules"][number],
  ) => {
    if (date >= from && date <= to)
      result.push({
        id: `${s.id}:${date}:${type}`,
        subscriptionId: s.id,
        name: s.name,
        category: s.category,
        date,
        type,
        amount: type === "expiry" ? 0 : r.amount,
        currency: r.currency,
        converted: null,
      });
  };
  if (s.kind === "lifetime") {
    push(s.start, "purchase", s.rules[0]);
    return result;
  }
  for (let i = 0; i < s.rules.length; i++) {
    const r = s.rules[i],
      anchor = DateTime.fromISO(r.effective, { zone: "UTC" }),
      limit = s.rules[i + 1]?.effective;
    const delta = DateTime.fromISO(from, { zone: "UTC" })
      .diff(anchor, r.unit)
      .as(r.unit);
    let n = Math.max(0, Math.floor(delta / r.interval) - 2);
    for (; n < 200000; n++) {
      const d = anchor.plus({ [r.unit]: n * r.interval }).toISODate()!;
      if (
        d > to ||
        (limit && d >= limit) ||
        (!s.autoRenew && s.end && d >= s.end)
      )
        break;
      push(d, d === s.start ? "purchase" : "renewal", r);
      if (result.length >= limitCount) return result;
    }
  }
  if (!s.autoRenew && s.end)
    push(s.end, "expiry", s.rules.filter((r) => r.effective <= s.end!).at(-1)!);
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
export function convert(
  e: Event,
  base: string,
  rates: Record<string, number>,
): Event {
  const rate = e.currency === base ? 1 : rates[e.currency];
  return {
    ...e,
    converted: rate
      ? new Decimal(major(e.amount, e.currency))
          .mul(rate)
          .toDecimalPlaces(digits(base))
          .toNumber()
      : null,
  };
}
export function nextEvent(s: Subscription, today: string) {
  return (
    events(
      s,
      today,
      DateTime.fromISO(today).plus({ years: 100 }).toISODate()!,
      1,
    )[0] ?? null
  );
}

export function currentRule(s: Subscription, date: string) {
  return s.rules.filter((r) => r.effective <= date).at(-1) || s.rules[0];
}
