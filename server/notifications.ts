import { DateTime } from "luxon";
import { major, type Event } from "../shared/model.js";

/** Accept a server base, /push endpoint, or the full device URL copied from Bark. */
export function barkDestination(server: string, deviceKey: string) {
  const key = deviceKey.trim().replace(/^\/+|\/+$/g, "");
  if (!key || /[/?#\s]/.test(key))
    throw new Error("Bark 设备 Key 格式无效，请仅填写设备 Key");
  const url = new URL(server.trim());
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Bark 服务器必须使用 HTTP 或 HTTPS");
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.at(-1) === "push") segments.pop();
  if (segments.length && decodeURIComponent(segments.at(-1)!) === key)
    segments.pop();
  url.pathname = "/" + [...segments, "push"].join("/");
  url.hash = "";
  return { url: url.toString(), key };
}

export function reminderMessage(event: Event, today: string, timezone: string) {
  const days = Math.round(
    DateTime.fromISO(event.date, { zone: timezone }).diff(
      DateTime.fromISO(today, { zone: timezone }),
      "days",
    ).days,
  );
  const remaining =
    days === 0
      ? "今天"
      : days > 0
        ? `还有 ${days} 天`
        : `已过 ${Math.abs(days)} 天`;
  if (event.type === "expiry") {
    return {
      title: `${event.name} · ${remaining}${days < 0 ? "" : "到期"}`,
      body: `${event.name}\n到期日期：${event.date}（${remaining}）\n已记录为不自动续费，本次不计扣款。`,
    };
  }
  const amount = new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: event.currency,
  }).format(major(event.amount, event.currency));
  const action = event.type === "purchase" ? "开始订阅" : "续费";
  return {
    title: `${event.name} · ${remaining}${days < 0 ? "" : action}`,
    body: `${event.name}\n${action}日期：${event.date}（${remaining}）\n预计扣款：${amount}（${event.currency}）`,
  };
}
