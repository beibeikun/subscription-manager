import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let pending: InstallPrompt | null = null;
let installed = window.matchMedia("(display-mode: standalone)").matches;
const notify = () => window.dispatchEvent(new Event("pwa-install-state"));
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  pending = event as InstallPrompt;
  notify();
});
window.addEventListener("appinstalled", () => {
  installed = true;
  pending = null;
  notify();
});
if (
  import.meta.env.PROD &&
  window.isSecureContext &&
  "serviceWorker" in navigator
) {
  const register = () =>
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {});
  if (document.readyState === "complete") void register();
  else window.addEventListener("load", () => void register(), { once: true });
}
export function InstallApp() {
  const [, refresh] = useState(0);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    const changed = () => refresh((n) => n + 1);
    window.addEventListener("pwa-install-state", changed);
    return () => window.removeEventListener("pwa-install-state", changed);
  }, []);
  const install = async () => {
    if (!pending) return;
    const prompt = pending;
    setBusy(true);
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      setMessage(
        result.outcome === "accepted"
          ? "已提交安装，请按 Chrome 提示完成。"
          : "你可以稍后从 Chrome 菜单中安装。",
      );
    } catch {
      setMessage("请打开 Chrome 菜单，选择“安装应用”或“添加到主屏幕”。");
    } finally {
      pending = null;
      setBusy(false);
      notify();
    }
  };
  return (
    <section className="panel settings-panel install-panel">
      <h2>
        <Smartphone size={19} />
        安装到手机
      </h2>
      <p className="muted">将订阅集添加到安卓桌面，以独立应用窗口打开。</p>
      {installed ? (
        <p className="install-status">当前已在应用模式中打开。</p>
      ) : !window.isSecureContext ? (
        <div className="warning">
          当前地址是 HTTP。请使用可信 HTTPS 地址打开，再通过 Chrome
          菜单安装应用。
        </div>
      ) : pending ? (
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={install}
        >
          <Download size={16} />
          {busy ? "正在打开安装提示…" : "安装订阅集"}
        </button>
      ) : (
        <p className="install-status">
          在安卓 Chrome 中打开菜单
          ⋮，选择“安装应用”或“添加到主屏幕”。如果暂未出现，请稍后刷新；已经安装时可直接从桌面打开。
        </p>
      )}
      {message && (
        <p role="status" className="install-status">
          {message}
        </p>
      )}
      <p className="muted install-note">
        安装后仍需连接服务器才能查看和修改订阅。
      </p>
    </section>
  );
}
