import { createHmac, timingSafeEqual } from "node:crypto";

export const appIconName = "app.png";
export function validIconName(name: string) {
  return name === appIconName || /^[a-f0-9-]+\.webp$/.test(name);
}
function signature(name: string) {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw new Error("请设置 64 位十六进制 ENCRYPTION_KEY");
  return createHmac("sha256", Buffer.from(key, "hex"))
    .update(`bark-icon:${name}`)
    .digest("hex");
}
export function barkIconUrl(appUrl: string, logo?: string | null) {
  if (!appUrl) return undefined;
  const name = logo && validIconName(logo) ? logo : appIconName;
  const url = new URL(appUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/api/v1/bark/icons/${name}`;
  url.search = "";
  url.hash = "";
  url.searchParams.set("signature", signature(name));
  return url.toString();
}
export function verifyIconSignature(name: string, token: unknown) {
  if (
    !validIconName(name) ||
    typeof token !== "string" ||
    !/^[a-f0-9]{64}$/.test(token)
  )
    return false;
  return timingSafeEqual(
    Buffer.from(token, "hex"),
    Buffer.from(signature(name), "hex"),
  );
}
