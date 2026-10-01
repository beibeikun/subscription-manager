import { ServicePicker } from "./components/service-picker";
import { serviceIcon } from "./service-catalog";
import { InstallApp } from "./pwa";
import { Button } from "./components/ui/button";
import { Select } from "./components/select";
import { DatePicker } from "./components/date-picker";
import { CategorySelect } from "./components/category-select";
import { currencyFlag } from "./currency-flags";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { DateTime } from "luxon";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);
import {
  Layers,
  LayoutGrid,
  List,
  Plus,
  Search,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  Settings,
  LogOut,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Archive,
  Copy,
  Trash2,
  Bell,
  Wallet,
  RefreshCw,
  Check,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  major,
  minor,
  currentRule,
  type Subscription,
  type Event,
} from "../shared/model";
import "./style.css";
let csrf = "";
async function api(path: string, method = "GET", body?: any) {
  const form = body instanceof FormData;
  const r = await fetch("/api/v1" + path, {
    method,
    headers: {
      ...(!form && body ? { "Content-Type": "application/json" } : {}),
      "x-csrf-token": csrf,
    },
    body: body ? (form ? body : JSON.stringify(body)) : undefined,
  });
  const value = await r.json();
  if (!r.ok) throw new Error(value.error || "操作失败");
  return value;
}
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
const currency = (v: number, c = "CNY") =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: c,
    maximumFractionDigits: 2,
  }).format(v);
const today = () =>
  DateTime.now()
    .setZone(
      client.getQueryData<any>(["settings"])?.timezone || "Asia/Shanghai",
    )
    .toISODate()!;
const typeName = (t: string) =>
  t === "expiry" ? "服务到期" : t === "purchase" ? "首次购买" : "预计续费";
function App() {
  const q = useQueryClient(),
    [page, setPage] = useState("subscriptions"),
    [toast, setToast] = useState(""),
    [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
      try {
        return localStorage.getItem("sidebarCollapsed") === "true";
      } catch {
        return false;
      }
    }),
    [editing, setEditing] = useState<any>(undefined),
    [choosingService, setChoosingService] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem("sidebarCollapsed", String(sidebarCollapsed));
    } catch {
      // Navigation still works when browser storage is unavailable.
    }
  }, [sidebarCollapsed]);
  const auth = useQuery({ queryKey: ["auth"], queryFn: () => api("/auth/me") });
  if (auth.data) csrf = auth.data.csrf;
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api("/settings"),
    enabled: !!auth.data,
  });
  const subscriptions = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => api("/subscriptions"),
    enabled: !!auth.data,
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api("/categories"),
    enabled: !!auth.data,
  });
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 4500);
  };
  const reload = () => {
    q.invalidateQueries({ queryKey: ["subscriptions"] });
    q.invalidateQueries({ queryKey: ["events"] });
    q.invalidateQueries({ queryKey: ["categories"] });
    q.invalidateQueries({ queryKey: ["settings"] });
  };
  useEffect(() => {
    if (subscriptions.data) {
      const id = new URLSearchParams(location.search).get("subscription");
      if (id) setEditing(subscriptions.data.find((s: any) => s.id === id));
    }
  }, [!!subscriptions.data]);
  if (auth.isPending) return <div className="loading">正在打开订阅集…</div>;
  if (!auth.data)
    return (
      <Login onLogin={() => q.invalidateQueries({ queryKey: ["auth"] })} />
    );
  const s = settings.data || { base: "CNY" },
    subs = subscriptions.data || [];
  return (
    <div className={`app${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar" id="workspace-sidebar">
        <a
          className="brand"
          aria-label="订阅集"
          title="订阅集"
          onClick={() => setPage("subscriptions")}
        >
          <span className="brand-mark">
            <Layers size={22} />
          </span>
          <span className="brand-text">
            订阅集<small>MEMBERSHIPS</small>
          </span>
        </a>
        <div className="nav-label">个人工作空间</div>
        <nav>
          {[
            ["subscriptions", LayoutGrid, "我的订阅"],
            ["statistics", ChartNoAxesCombined, "支出统计"],
            ["notifications", Bell, "到期提醒"],
            ["settings", Settings, "偏好设置"],
          ].map(([id, Icon, label]: any) => (
            <button
              key={id}
              className={page === id ? "nav active" : "nav"}
              onClick={() => setPage(id)}
              aria-label={label}
              title={sidebarCollapsed ? label : undefined}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={19} />
              <span className="nav-text">{label}</span>
              {id === "subscriptions" && (
                <span className="nav-count">
                  {subs.filter((x: any) => !x.archived).length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-badge">
            <i /> 本地存储 · 数据由你掌握
          </div>
          <button
            className="profile"
            aria-label="个人账户"
            title={sidebarCollapsed ? "个人账户" : undefined}
            onClick={() => setPage("profile")}
          >
            <Avatar profile={auth.data} />
            <span>
              个人账户<small>{auth.data.username}</small>
            </span>
            <Settings size={16} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="topbar-location">
            <button
              className="sidebar-toggle"
              aria-label={sidebarCollapsed ? "展开侧边菜单" : "收起侧边菜单"}
              title={sidebarCollapsed ? "展开侧边菜单" : "收起侧边菜单"}
              aria-expanded={!sidebarCollapsed}
              aria-controls="workspace-sidebar"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
            </button>
            <span>
              我的工作空间 <span className="slash">/</span>{" "}
              <b>
                {page === "subscriptions"
                  ? "订阅管理"
                  : page === "statistics"
                    ? "支出统计"
                    : page === "notifications"
                      ? "到期提醒"
                      : page === "profile"
                        ? "个人信息"
                        : "偏好设置"}
              </b>
            </span>
          </span>
          <span className="top-right">
            <span className="private-tag">个人版</span>
            <button
              className="avatar-button"
              title="个人信息设置"
              aria-label="个人信息设置"
              onClick={() => setPage("profile")}
            >
              <Avatar profile={auth.data} small />
            </button>
          </span>
        </header>
        <main>
          {page === "subscriptions" ? (
            <Subscriptions
              subs={subs}
              settings={s}
              categories={categories.data || []}
              edit={(value: any) =>
                value === null ? setChoosingService(true) : setEditing(value)
              }
              notify={notify}
              reload={reload}
            />
          ) : page === "statistics" ? (
            <Statistics
              subs={subs}
              settings={s}
              categories={categories.data || []}
              edit={(id: string) =>
                setEditing(subs.find((x: any) => x.id === id))
              }
            />
          ) : page === "notifications" ? (
            <Notifications subs={subs} notify={notify} />
          ) : page === "profile" ? (
            <Profile
              profile={auth.data}
              notify={notify}
              saved={() => q.invalidateQueries({ queryKey: ["auth"] })}
            />
          ) : (
            <Preferences
              settings={s}
              categories={categories.data || []}
              notify={notify}
              reload={reload}
            />
          )}
        </main>
        <footer>
          订阅集 <span>让每一份订阅，心中有数。</span>
          <small>费用为规则推算，仅供个人管理参考</small>
        </footer>
      </div>
      {choosingService && (
        <ServicePicker
          close={() => setChoosingService(false)}
          select={(service) => {
            setChoosingService(false);
            setEditing(
              service
                ? {
                    name: service.name,
                    website: service.website,
                    templateIcon: serviceIcon(service),
                  }
                : null,
            );
          }}
        />
      )}
      {editing !== undefined && (
        <Editor
          value={editing}
          back={() => {
            setEditing(undefined);
            setChoosingService(true);
          }}
          categories={categories.data || []}
          close={() => {
            setEditing(undefined);
            history.replaceState({}, "", location.pathname);
          }}
          saved={() => {
            reload();
            setEditing(undefined);
            notify("订阅已保存");
          }}
          notify={notify}
        />
      )}{" "}
      {toast && (
        <div className="toast">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
function Login({ onLogin }: { onLogin: () => void }) {
  const { register, handleSubmit } = useForm(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="login">
      <div className="login-intro">
        <span className="brand-mark">
          <Layers />
        </span>
        <h1>
          每一份喜爱，
          <br />
          都有迹可循。
        </h1>
        <p>把分散的会员与订阅，收进一个清晰的空间。</p>
        <div className="login-art">
          <Wallet size={64} />
          <span>
            YOUR SUBSCRIPTIONS,
            <br />
            BEAUTIFULLY ORGANIZED.
          </span>
        </div>
      </div>
      <form
        className="login-form"
        onSubmit={handleSubmit(async (b) => {
          setBusy(true);
          try {
            const r = await api("/auth/login", "POST", b);
            csrf = r.csrf;
            onLogin();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        })}
      >
        <span className="eyebrow">WELCOME BACK</span>
        <h2>欢迎回到订阅集</h2>
        <p className="muted">登录你的个人订阅管理空间</p>
        <label>
          用户名
          <input
            {...register("username")}
            defaultValue="admin"
            required
            autoComplete="username"
          />
        </label>
        <label>
          密码
          <input
            {...register("password")}
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <Button className="wide" disabled={busy}>
          {busy ? "登录中…" : "登录工作空间"} <ArrowUpRight size={17} />
        </Button>
        <p className="login-note">自托管 · 私有数据 · 简单有序</p>
      </form>
    </div>
  );
}
function useEvents(from: string, to: string, filters: any = {}) {
  const params = new URLSearchParams({
    from,
    to,
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
  });
  return useQuery({
    queryKey: ["events", from, to, filters],
    queryFn: async () => {
      let cursor = DateTime.fromISO(from);
      const parts: any[] = [];
      while (cursor.toISODate()! <= to) {
        const end = cursor.plus({ years: 19 }).minus({ days: 1 }).toISODate()!;
        params.set("from", cursor.toISODate()!);
        params.set("to", end < to ? end : to);
        parts.push(await api("/events?" + params));
        cursor = DateTime.fromISO(params.get("to")!).plus({ days: 1 });
      }
      return {
        ...parts[0],
        events: parts.flatMap((p) => p.events),
        missing: [...new Set(parts.flatMap((p) => p.missing))],
      };
    },
  });
}
function Summary({ subs, base }: { subs: any[]; base: string }) {
  const now = DateTime.fromISO(today()),
    month = useEvents(
      now.startOf("month").toISODate()!,
      now.endOf("month").toISODate()!,
    ),
    future = useEvents(today(), now.plus({ days: 29 }).toISODate()!);
  const sum = (v: any) =>
    v?.events.reduce((n: number, e: Event) => n + (e.converted || 0), 0) || 0;
  return (
    <div className="summary">
      {[
        [
          Layers,
          "有效周期订阅",
          subs.filter(
            (s) =>
              s.kind === "recurring" &&
              s.start <= today() &&
              (s.autoRenew || s.end > today()),
          ).length,
          "份订阅陪伴日常",
        ],
        [
          Wallet,
          "本月预计支出",
          currency(sum(month.data), base),
          "按订阅规则推算",
        ],
        [
          CalendarDays,
          "未来 30 天",
          currency(sum(future.data), base),
          "掌握接下来的支出",
        ],
        [
          Archive,
          "永久买断",
          subs.filter((s) => s.kind === "lifetime" && s.start <= today())
            .length,
          "一次拥有，长期使用",
        ],
      ].map(([Icon, label, value, note]: any, i) => (
        <section className="metric" key={label}>
          <div className="metric-label">
            {label}
            <Icon size={17} />
          </div>
          <div className="metric-value">
            {value}
            {(i === 0 || i === 3) && <small>项</small>}
          </div>
          <div className="metric-note">{note}</div>
        </section>
      ))}
      {(month.data?.missing.length > 0 || future.data?.missing.length > 0) && (
        <div className="warning full">
          部分币种缺少汇率，合计不完整，请在设置中刷新汇率。
        </div>
      )}
    </div>
  );
}
function Avatar({ profile, small = false }: any) {
  return profile.avatar ? (
    <img
      className={`avatar ${small ? "small" : ""}`}
      src={`/api/v1/logos/${profile.avatar}`}
      alt="个人头像"
    />
  ) : (
    <span className={`avatar ${small ? "small" : ""}`}>
      {Array.from(String(profile.username || "用户"))[0]?.toUpperCase()}
    </span>
  );
}
function Profile({ profile, notify, saved }: any) {
  const [username, setUsername] = useState(profile.username),
    [avatar, setAvatar] = useState(profile.avatar || ""),
    [busy, setBusy] = useState(false),
    [crop, setCrop] = useState<string | null>(null),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      if (crop) URL.revokeObjectURL(crop);
    },
    [crop],
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR PROFILE</div>
          <h1>个人信息</h1>
          <p>管理你的头像、登录用户名与密码。</p>
        </div>
      </div>
      <form
        className="panel settings-panel profile-editor"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api("/auth/profile", "PUT", { username, avatar });
            await saved();
            notify("个人信息已保存");
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="profile-avatar-preview">
          <Avatar profile={{ username, avatar }} />
        </div>
        <label>
          上传头像
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (
                !["image/png", "image/jpeg", "image/webp"].includes(
                  file.type,
                ) ||
                file.size > 5 * 1024 * 1024
              ) {
                setError("请选择 5 MB 以内的 PNG、JPEG 或 WebP 图片");
                return;
              }
              setError("");
              setCrop(URL.createObjectURL(file));
            }}
          />
        </label>
        <p className="muted">支持 PNG、JPEG、WebP，最大 5 MB，可裁剪。</p>
        {avatar && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => setAvatar("")}
          >
            移除头像
          </button>
        )}
        <label>
          用户名
          <input
            value={username}
            required
            maxLength={64}
            autoComplete="username"
            disabled={busy}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <p className="muted">修改后，下次登录请使用新用户名，密码保持不变。</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "保存中…" : "保存个人信息"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={async () => {
            try {
              await api("/auth/logout", "POST");
              csrf = "";
              client.clear();
              location.reload();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <LogOut size={16} />
          退出登录
        </button>
      </form>
      <PasswordForm notify={notify} />
      {crop && (
        <Crop
          source={crop}
          close={() => setCrop(null)}
          save={async (blob) => {
            setBusy(true);
            try {
              const fd = new FormData();
              fd.append("file", blob, "avatar.webp");
              const result = await api("/logos", "POST", fd);
              setAvatar(result.logo);
              setCrop(null);
            } catch (err) {
              notify((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </>
  );
}
function Logo({ s }: { s: any }) {
  return s.logo || s.preview ? (
    <img
      className="logo"
      alt={s.name + " Logo"}
      src={s.logo ? "/api/v1/logos/" + s.logo : s.preview}
    />
  ) : (
    <span className={"logo logo-" + (s.name.charCodeAt(0) % 5)}>
      {s.name.slice(0, 1).toUpperCase()}
    </span>
  );
}
function Subscriptions({
  subs,
  settings,
  categories,
  edit,
  notify,
  reload,
}: any) {
  const [search, setSearch] = useState(""),
    [cat, setCat] = useState(""),
    [kind, setKind] = useState(""),
    [status, setStatus] = useState("active"),
    [view, setView] = useState("grid"),
    [sort, setSort] = useState("next");
  let rows = subs.filter(
    (s: any) =>
      s.name.toLowerCase().includes(search.toLowerCase()) &&
      (!cat || s.category === cat) &&
      (!kind || s.kind === kind) &&
      (status === "all" || status === "archived"
        ? status === "all" || s.archived
        : !s.archived &&
          (status === "active"
            ? s.kind === "lifetime" || s.autoRenew || s.end > today()
            : s.kind === "recurring" && !s.autoRenew && s.end <= today())),
  );
  const rate =
    settings.rates?.base === settings.base ? settings.rates.rates || {} : {};
  rows.sort((a: any, b: any) =>
    sort === "name"
      ? a.name.localeCompare(b.name)
      : sort === "start"
        ? b.start.localeCompare(a.start)
        : sort === "amount"
          ? major(b.rules.at(-1).amount, b.rules.at(-1).currency) *
              (b.rules.at(-1).currency === settings.base
                ? 1
                : rate[b.rules.at(-1).currency] || 0) -
            major(a.rules.at(-1).amount, a.rules.at(-1).currency) *
              (a.rules.at(-1).currency === settings.base
                ? 1
                : rate[a.rules.at(-1).currency] || 0)
          : (a.next?.date || "9999").localeCompare(b.next?.date || "9999"),
  );
  const action = async (s: any, name: string) => {
    try {
      if (name === "copy") {
        edit({ ...s, id: undefined, name: s.name + " · 副本" });
        return;
      }
      if (name === "delete") {
        if (!confirm(`永久删除「${s.name}」？该订阅也会从历史推算中移除。`))
          return;
        await api("/subscriptions/" + s.id, "DELETE");
      } else
        await api("/subscriptions/" + s.id, "PUT", {
          ...s,
          archived: !s.archived,
        });
      reload();
      notify(name === "delete" ? "订阅已删除" : "已更新归档状态");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR MEMBERSHIPS</div>
          <h1>
            我的订阅 <span className="title-dot" />
          </h1>
          <p>喜欢的服务，有序的生活。所有订阅，一目了然。</p>
        </div>
        <button className="primary" onClick={() => edit(null)}>
          <Plus size={18} />
          添加订阅
        </button>
      </div>
      <Summary subs={subs} base={settings.base} />
      <div className="section-title">
        <h2>
          订阅清单 <span>{rows.length}</span>
        </h2>
        <div className="segmented desktop">
          <button
            className={view === "grid" ? "selected" : ""}
            onClick={() => setView("grid")}
            aria-label="卡片视图"
          >
            <LayoutGrid size={17} />
          </button>
          <button
            className={view === "table" ? "selected" : ""}
            onClick={() => setView("table")}
            aria-label="表格视图"
          >
            <List size={18} />
          </button>
        </div>
      </div>
      <div className="filters">
        <div className="search">
          <Search size={17} />
          <input
            placeholder="搜索订阅名称…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          aria-label="筛选分类"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="">全部分类</option>
          {categories.map((c: any) => (
            <option key={c.name} data-color={c.color}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="筛选付费模式"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">全部付费模式</option>
          <option value="recurring">周期订阅</option>
          <option value="lifetime">永久买断</option>
        </Select>
        <Select
          aria-label="筛选订阅状态"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="active">有效订阅</option>
          <option value="expired">已到期</option>
          <option value="archived">已归档</option>
          <option value="all">全部状态</option>
        </Select>
        <Select
          aria-label="订阅排序"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="next">按下次事件</option>
          <option value="amount">按折算金额</option>
          <option value="start">按开始时间</option>
          <option value="name">按名称</option>
        </Select>
      </div>
      {!rows.length ? (
        <div className="empty">
          <div className="empty-icon">
            <Layers size={34} />
          </div>
          <h3>{subs.length ? "没有匹配的订阅" : "给你的订阅，一个专属空间"}</h3>
          <p>
            {subs.length
              ? "试试调整筛选条件"
              : "添加第一份会员，开始了解你的订阅支出。"}
          </p>
          <button className="primary" onClick={() => edit(null)}>
            <Plus size={16} />
            添加订阅
          </button>
        </div>
      ) : (
        <div
          className={
            view === "table"
              ? "subscription-grid table-view"
              : "subscription-grid"
          }
        >
          {rows.map((s: any) => {
            const r = currentRule(s, today()),
              days = s.next
                ? Math.ceil(
                    DateTime.fromISO(s.next.date).diff(
                      DateTime.fromISO(today()),
                      "days",
                    ).days,
                  )
                : null;
            return (
              <article className="sub-card" key={s.id}>
                <div className="card-top" onClick={() => edit(s)}>
                  <Logo s={s} />
                  <div className="sub-name">
                    <h3>{s.name}</h3>
                    <span className="category">
                      <i
                        style={{
                          background:
                            categories.find((c: any) => c.name === s.category)
                              ?.color || "#94a3b8",
                        }}
                      />
                      {s.category}
                    </span>
                  </div>
                  <span
                    className={s.kind === "lifetime" ? "pill purple" : "pill"}
                  >
                    {s.kind === "lifetime"
                      ? "永久买断"
                      : s.autoRenew
                        ? "自动续费"
                        : "到期结束"}
                  </span>
                </div>
                <div className="card-price" onClick={() => edit(s)}>
                  {currency(major(r.amount, r.currency), r.currency)}
                  <small>
                    {s.kind === "lifetime"
                      ? "一次性"
                      : `/ ${r.interval === 1 ? "" : r.interval}${{ days: "天", weeks: "周", months: "月", years: "年" }[r.unit as string]}`}
                  </small>
                </div>
                <div className="card-bottom">
                  <div>
                    <span
                      className={
                        days !== null && days <= 7 ? "due soon" : "due"
                      }
                    >
                      {s.kind === "lifetime"
                        ? "永久有效"
                        : s.next
                          ? `${s.next.date} · ${typeName(s.next.type)}`
                          : "已到期"}
                    </span>
                    {days !== null && (
                      <small>{days === 0 ? "今天" : `${days} 天后`}</small>
                    )}
                  </div>
                  <div className="card-actions">
                    <button title="编辑" onClick={() => edit(s)}>
                      <MoreHorizontal size={17} />
                    </button>
                    <button title="复制" onClick={() => action(s, "copy")}>
                      <Copy size={14} />
                    </button>
                    <button
                      title={s.archived ? "恢复归档" : "归档"}
                      onClick={() => action(s, "archive")}
                    >
                      <Archive size={14} />
                    </button>
                    <button title="删除" onClick={() => action(s, "delete")}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          <button className="add-card" onClick={() => edit(null)}>
            <span>
              <Plus size={24} />
            </span>
            <b>添加新的订阅</b>
            <small>记录下一份喜爱</small>
          </button>
        </div>
      )}
      <div className="tip">
        <span>✦</span> 定期回顾你的订阅，把预算留给真正喜欢的服务。
      </div>
    </>
  );
}
function Editor({ value, categories, close, saved, notify, back }: any) {
  const r = value?.rules?.at(-1) || {
    amount: 0,
    currency: "CNY",
    unit: "months",
    interval: 1,
  };
  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      name: value?.name || "",
      kind: value?.kind || "recurring",
      amount: major(r.amount, r.currency),
      currency: r.currency,
      start: value?.start || today(),
      unit: r.unit,
      interval: r.interval,
      autoRenew: value?.autoRenew ?? true,
      end: value?.end || "",
      category: value?.category || "未分类",
      notes: value?.notes || "",
      website: value?.website || "",
      editMode: "correction",
      reminderText: value?.reminders?.join(",") ?? "",
    },
  });
  const [templateIcon, setTemplateIcon] = useState<string | null>(
    value?.templateIcon || null,
  );
  const [logo, setLogo] = useState(value?.logo || null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [crop, setCrop] = useState<string | null>(null);
  const kind = watch("kind"),
    auto = watch("autoRenew");
  return (
    <div className="modal-overlay" onClick={close}>
      <section className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">MEMBERSHIP DETAILS</span>
            <h2>{value?.id ? "编辑订阅" : "添加新的订阅"}</h2>
            {!value?.id && (
              <button type="button" className="service-back" onClick={back}>
                <ChevronLeft size={14} />
                重新选择服务
              </button>
            )}
          </div>
          <button onClick={close} aria-label="关闭">
            <X />
          </button>
        </div>
        <form
          onSubmit={handleSubmit(async (v: any) => {
            setBusy(true);
            setError("");
            try {
              const rule = {
                effective: v.start,
                amount: minor(v.amount, v.currency),
                currency: v.currency,
                unit: v.unit,
                interval: Number(v.interval),
              };
              const billingChanged =
                !value?.id ||
                value.kind !== v.kind ||
                value.start !== v.start ||
                r.amount !== rule.amount ||
                r.currency !== rule.currency ||
                r.unit !== rule.unit ||
                r.interval !== rule.interval;
              let savedLogo = logo;
              if (!savedLogo && templateIcon) {
                const image = await fetch(templateIcon);
                if (!image.ok)
                  throw new Error(
                    "内置 Logo 加载失败，请重试或移除 Logo 后保存",
                  );
                const fd = new FormData();
                fd.append("file", await image.blob(), "logo.webp");
                savedLogo = (await api("/logos", "POST", fd)).logo;
                setLogo(savedLogo);
              }
              const body = {
                ...v,
                logo: savedLogo,
                end: v.end || null,
                archived: value?.archived || false,
                reminders: v.reminderText.trim()
                  ? v.reminderText.split(",").map(Number)
                  : null,
                rules: billingChanged ? [rule] : value.rules,
                editMode: billingChanged ? v.editMode : "correction",
              };
              await api(
                "/subscriptions" + (value?.id ? "/" + value.id : ""),
                value?.id ? "PUT" : "POST",
                body,
              );
              saved();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          })}
        >
          <div className="logo-upload">
            <Logo
              s={{ name: watch("name") || "订", logo, preview: templateIcon }}
            />
            <div>
              <label className="button secondary">
                上传 Logo
                <input
                  hidden
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > 5 * 1024 * 1024) {
                        setError("Logo 最大 5 MB");
                        return;
                      }
                      setCrop(URL.createObjectURL(f));
                    }
                  }}
                />
              </label>
              <small>
                {templateIcon && !logo
                  ? "已使用内置 Logo，可上传替换"
                  : "PNG / JPG / WebP · 最大 5 MB"}
              </small>
            </div>
            {(logo || templateIcon) && (
              <button
                type="button"
                onClick={() => {
                  setLogo(null);
                  setTemplateIcon(null);
                }}
              >
                移除
              </button>
            )}
          </div>
          <div className="form-grid">
            <label className="full">
              订阅名称
              <input
                {...register("name")}
                placeholder="例如：Apple Music"
                required
                maxLength={100}
              />
            </label>
            <label>
              付费模式
              <Select
                aria-label="付费模式"
                value={watch("kind")}
                onChange={(e) => setValue("kind", e.target.value)}
              >
                <option value="recurring">周期订阅</option>
                <option value="lifetime">永久买断</option>
              </Select>
            </label>
            <label>
              分类
              <Select
                aria-label="分类"
                value={watch("category")}
                onChange={(e) => setValue("category", e.target.value)}
              >
                {categories.map((c: any) => (
                  <option key={c.name} data-color={c.color}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              {kind === "lifetime" ? "购买金额" : "每期金额"}
              <input
                {...register("amount")}
                type="number"
                min="0"
                step="any"
                required
              />
            </label>
            <label>
              币种
              <Select
                aria-label="币种"
                editable
                value={watch("currency")}
                onChange={(e) =>
                  setValue("currency", e.target.value.toUpperCase())
                }
                pattern="[A-Z]{3}"
                maxLength={3}
                required
              >
                {[
                  "CNY",
                  "USD",
                  "EUR",
                  "HKD",
                  "JPY",
                  "GBP",
                  "SGD",
                  "TWD",
                  "KRW",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </label>
            <label>
              开始 / 购买日期
              <DatePicker
                aria-label="开始 / 购买日期"
                value={watch("start")}
                onChange={(date) =>
                  setValue("start", date, { shouldDirty: true })
                }
                today={today()}
                required
              />
            </label>
            {kind === "recurring" && (
              <>
                <label>
                  快捷周期
                  <Select
                    aria-label="快捷周期"
                    onChange={(e) => {
                      const [n, u] = e.target.value.split(":");
                      if (n) {
                        setValue("interval", Number(n));
                        setValue("unit", u);
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="">自定义周期</option>
                    <option value="1:months">月付</option>
                    <option value="3:months">季付</option>
                    <option value="6:months">半年付</option>
                    <option value="1:years">年付</option>
                  </Select>
                </label>
                <label>
                  每隔
                  <input
                    {...register("interval")}
                    type="number"
                    min="1"
                    max="1000"
                  />
                </label>
                <label>
                  周期单位
                  <Select
                    aria-label="周期单位"
                    value={watch("unit")}
                    onChange={(e) => setValue("unit", e.target.value)}
                  >
                    <option value="days">天</option>
                    <option value="weeks">周</option>
                    <option value="months">月</option>
                    <option value="years">年</option>
                  </Select>
                </label>
                <label className="checkbox full">
                  <input {...register("autoRenew")} type="checkbox" /> 自动续费
                </label>
                {!auto && (
                  <label className="full">
                    当前服务到期日
                    <DatePicker
                      aria-label="当前服务到期日"
                      value={watch("end")}
                      onChange={(date) =>
                        setValue("end", date, { shouldDirty: true })
                      }
                      today={today()}
                      required
                    />
                  </label>
                )}
              </>
            )}
            <label className="full">
              官网链接
              <input
                {...register("website")}
                type="url"
                placeholder="https://"
              />
            </label>
            <label className="full">
              备注
              <textarea {...register("notes")} rows={2} />
            </label>
            {kind === "recurring" && (
              <label className="full">
                提前提醒天数
                <input
                  {...register("reminderText")}
                  placeholder="留空使用全局设置，例如 7,1,0"
                />
              </label>
            )}
            {value?.id && (
              <label className="full">
                修改生效方式
                <Select
                  aria-label="修改生效方式"
                  value={watch("editMode")}
                  onChange={(e) => setValue("editMode", e.target.value)}
                >
                  <option value="correction">
                    修正录入错误（重新计算历史）
                  </option>
                  <option value="next">
                    从下一期变更（保留历史价格和周期）
                  </option>
                </Select>
              </label>
            )}
          </div>
          {error && <p className="error">{error}</p>}
          <div className="modal-foot">
            <button type="button" className="secondary" onClick={close}>
              取消
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "保存中…" : "保存订阅"}
            </button>
          </div>
        </form>
      </section>
      {crop && (
        <Crop
          source={crop}
          close={() => {
            URL.revokeObjectURL(crop);
            setCrop(null);
          }}
          save={async (blob) => {
            try {
              const fd = new FormData();
              fd.append("file", blob, "logo.webp");
              const result = await api("/logos", "POST", fd);
              setLogo(result.logo);
              URL.revokeObjectURL(crop);
              setCrop(null);
            } catch (e) {
              notify((e as Error).message);
            }
          }}
        />
      )}
    </div>
  );
}
function Crop({
  source,
  close,
  save,
}: {
  source: string;
  close: () => void;
  save: (b: Blob) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [zoom, setZoom] = useState(1),
    [x, setX] = useState(0),
    [y, setY] = useState(0);
  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const c = canvas.current!;
      const ctx = c.getContext("2d")!;
      const scale = Math.max(256 / image.width, 256 / image.height) * zoom;
      ctx.clearRect(0, 0, 256, 256);
      ctx.drawImage(
        image,
        (256 - image.width * scale) / 2 + x,
        (256 - image.height * scale) / 2 + y,
        image.width * scale,
        image.height * scale,
      );
    };
    image.src = source;
  }, [source, zoom, x, y]);
  return (
    <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="modal crop">
        <h2>裁剪 Logo</h2>
        <canvas ref={canvas} width={256} height={256} />
        <label>
          缩放
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(+e.target.value)}
          />
        </label>
        <label>
          水平位置
          <input
            type="range"
            min="-128"
            max="128"
            value={x}
            onChange={(e) => setX(+e.target.value)}
          />
        </label>
        <label>
          垂直位置
          <input
            type="range"
            min="-128"
            max="128"
            value={y}
            onChange={(e) => setY(+e.target.value)}
          />
        </label>
        <div className="actions">
          <button className="secondary" onClick={close}>
            取消
          </button>
          <button
            className="primary"
            onClick={() =>
              canvas.current?.toBlob((b) => b && save(b), "image/webp")
            }
          >
            使用图片
          </button>
        </div>
      </div>
    </div>
  );
}
function Statistics({ subs, settings, categories, edit }: any) {
  const [tab, setTab] = useState("calendar"),
    [month, setMonth] = useState(DateTime.fromISO(today()).startOf("month")),
    [selected, setSelected] = useState(today()),
    [category, setCategory] = useState(""),
    [kind, setKind] = useState(""),
    [curr, setCurr] = useState(""),
    [period, setPeriod] = useState(DateTime.fromISO(today())),
    [group, setGroup] = useState("month"),
    [stack, setStack] = useState(true);
  const relevant = subs.filter(
    (s: Subscription) =>
      (!category || s.category === category) &&
      (!kind || s.kind === kind) &&
      (!curr || s.rules.some((r) => r.currency === curr)),
  );
  const dates: string[] = [
    today(),
    ...relevant.flatMap((s: Subscription) => [
      s.start,
      ...(s.end ? [s.end] : []),
      ...s.rules.map((r) => r.effective),
    ]),
  ].sort();
  const from =
    group === "year"
      ? dates[0].slice(0, 4) + "-01-01"
      : period.startOf(group === "day" ? "month" : "year").toISODate()!;
  const to =
    group === "year"
      ? dates[dates.length - 1].slice(0, 4) + "-12-31"
      : period.endOf(group === "day" ? "month" : "year").toISODate()!;
  const data = useEvents(
      tab === "calendar" ? month.toISODate()! : from,
      tab === "calendar" ? month.endOf("month").toISODate()! : to,
      { category, kind, currency: curr },
    ),
    es: Event[] = data.data?.events || [],
    sum = es.reduce((a, e) => a + (e.converted || 0), 0);
  const start = month.startOf("week"),
    days = Array.from({ length: 42 }, (_, i) => start.plus({ days: i }));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SPENDING INSIGHTS</div>
          <h1>支出统计</h1>
          <p>用日历安排每一次续费，用趋势看懂每一份投入。</p>
        </div>
        <div className="segmented">
          <button
            className={tab === "calendar" ? "selected" : ""}
            onClick={() => setTab("calendar")}
          >
            <CalendarDays size={16} />
            日历
          </button>
          <button
            className={tab === "trend" ? "selected" : ""}
            onClick={() => setTab("trend")}
          >
            <ChartNoAxesCombined size={16} />
            趋势
          </button>
        </div>
      </div>
      <div className="filters">
        <Select
          aria-label="筛选分类"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">全部分类</option>
          {categories.map((c: any) => (
            <option key={c.name} data-color={c.color}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="筛选付费模式"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">全部付费模式</option>
          <option value="recurring">周期订阅</option>
          <option value="lifetime">永久买断</option>
        </Select>
        <input
          placeholder="全部币种"
          maxLength={3}
          value={curr}
          onChange={(e) => setCurr(e.target.value.toUpperCase())}
        />
      </div>
      <div className="stats-banner">
        <div>
          <span>所选区间预计支出</span>
          <strong>{currency(sum, settings.base)}</strong>
        </div>
        <p>
          按 {data.data?.rateDate || "原币"} 汇率估算
          <br />
          历史费用按订阅规则推算，未来费用为预测
        </p>
      </div>
      {data.data?.missing.length > 0 && (
        <div className="warning">
          缺少 {data.data.missing.join("、")} 汇率，当前合计不完整。
        </div>
      )}
      {data.error && <p className="error">{data.error.message}</p>}
      {tab === "calendar" ? (
        <>
          <section className="panel">
            <div className="panel-heading">
              <h2>{month.toFormat("yyyy 年 M 月")}</h2>
              <div className="actions">
                <button
                  aria-label="上个月"
                  onClick={() => setMonth(month.minus({ months: 1 }))}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setMonth(DateTime.fromISO(today()).startOf("month"));
                    setSelected(today());
                  }}
                >
                  今天
                </button>
                <button
                  aria-label="下个月"
                  onClick={() => setMonth(month.plus({ months: 1 }))}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div className="calendar">
              <div className="weekdays">
                {"一二三四五六日".split("").map((d) => (
                  <span key={d}>周{d}</span>
                ))}
              </div>
              <div className="calendar-days">
                {days.map((d) => {
                  const date = d.toISODate()!,
                    day = es.filter((e) => e.date === date);
                  return (
                    <button
                      key={date}
                      className={`calendar-day ${d.month !== month.month ? "outside" : ""} ${date === selected ? "chosen" : ""}`}
                      onClick={() => setSelected(date)}
                    >
                      <span className={date === today() ? "today" : ""}>
                        {d.day}
                      </span>
                      {day.length > 0 && (
                        <>
                          <b>
                            {currency(
                              day.reduce((a, e) => a + (e.converted || 0), 0),
                              settings.base,
                            )}
                          </b>
                          <div className="calendar-logos">
                            {day.slice(0, 2).map((e) => (
                              <span
                                className="calendar-logo-item"
                                key={e.id}
                                title={`${e.name} · ${typeName(e.type)}`}
                                aria-label={`${e.name} · ${typeName(e.type)}`}
                              >
                                <Logo
                                  s={
                                    subs.find(
                                      (s: Subscription) =>
                                        s.id === e.subscriptionId,
                                    ) ?? e
                                  }
                                />
                              </span>
                            ))}
                            {day.length > 2 && (
                              <small
                                className="calendar-more"
                                title={`另有 ${day.length - 2} 项，点击日期查看全部`}
                              >
                                +{day.length - 2}
                              </small>
                            )}
                          </div>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
          <section className="panel day-detail">
            <div className="panel-heading">
              <h2>
                {selected} <span className="muted">当日明细</span>
              </h2>
            </div>
            <EventTable
              events={es.filter((e) => e.date === selected)}
              base={settings.base}
              edit={edit}
            />
          </section>
        </>
      ) : (
        <>
          <div className="filters range">
            {group !== "year" ? (
              <div className="trend-period">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={group === "day" ? "上个月" : "上一年"}
                  onClick={() =>
                    setPeriod((p) =>
                      p.minus(group === "day" ? { months: 1 } : { years: 1 }),
                    )
                  }
                >
                  <ChevronLeft size={18} />
                </button>
                <strong aria-live="polite">
                  {period.toFormat(
                    group === "day" ? "yyyy 年 M 月" : "yyyy 年",
                  )}
                </strong>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={group === "day" ? "下个月" : "下一年"}
                  onClick={() =>
                    setPeriod((p) =>
                      p.plus(group === "day" ? { months: 1 } : { years: 1 }),
                    )
                  }
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setPeriod(DateTime.fromISO(today()))}
                >
                  {group === "day" ? "本月" : "今年"}
                </button>
              </div>
            ) : (
              <strong>
                全部年份 · {from.slice(0, 4)}–{to.slice(0, 4)}
              </strong>
            )}
            <Select
              aria-label="趋势统计粒度"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              <option value="day">按日</option>
              <option value="month">按月</option>
              <option value="year">按年</option>
            </Select>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={stack}
                onChange={(e) => setStack(e.target.checked)}
              />
              分类堆叠
            </label>
          </div>
          <section className="panel">
            <div className="panel-heading">
              <h2>支出变化</h2>
              <span className="muted">浅色 / 虚线区域包含未来预测</span>
            </div>
            <Trend
              events={es}
              from={from}
              to={to}
              group={group}
              stack={stack}
              base={settings.base}
            />
          </section>
          <div className="split">
            <Breakdown
              events={es}
              base={settings.base}
              field="category"
              title="分类支出"
            />
            <Breakdown
              events={es}
              base={settings.base}
              field="name"
              title="支出最高的订阅"
            />
          </div>
          <details className="panel">
            <summary>展开全部费用明细（{es.length} 条）</summary>
            <EventTable events={es} base={settings.base} edit={edit} />
          </details>
        </>
      )}
    </>
  );
}
function EventTable({
  events,
  base,
  edit,
}: {
  events: Event[];
  base: string;
  edit: (id: string) => void;
}) {
  return events.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>订阅</th>
            <th>日期</th>
            <th>事件</th>
            <th>原币金额</th>
            <th>折算金额</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} onClick={() => edit(e.subscriptionId)}>
              <td>
                <b>{e.name}</b>
              </td>
              <td>{e.date}</td>
              <td>{typeName(e.type)}</td>
              <td>{currency(major(e.amount, e.currency), e.currency)}</td>
              <td>
                {e.converted === null
                  ? "汇率缺失"
                  : currency(e.converted, base)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="empty compact">这段时间没有费用或到期事件</div>
  );
}
function Trend({ events, from, to, group, stack, base }: any) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chart = echarts.init(ref.current!);
    const key = (s: string) =>
        s.slice(0, group === "day" ? 10 : group === "month" ? 7 : 4),
      buckets: string[] = [];
    let date = DateTime.fromISO(from).startOf(group);
    for (let i = 0; i < 8000 && date.toISODate()! <= to; i++) {
      buckets.push(key(date.toISODate()!));
      date = date.plus({ [group + "s"]: 1 });
    }
    const cats = stack
      ? [...new Set(events.map((e: Event) => e.category))]
      : ["预计费用"];
    let cumulative = 0;
    const totals = buckets.map((k) =>
      events
        .filter((e: Event) => key(e.date) === k)
        .reduce((s: number, e: Event) => s + (e.converted || 0), 0),
    );
    chart.setOption({
      color: ["#28796c", "#91bbae", "#a1aecb", "#d5b884", "#bba3ce"],
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: number) => currency(v, base),
      },
      legend: { bottom: 0 },
      grid: { left: 64, right: 64, top: 24, bottom: 64 },
      xAxis: {
        type: "category",
        data: buckets,
        axisLine: { lineStyle: { color: "#dce3e0" } },
      },
      yAxis: [
        { type: "value", splitLine: { lineStyle: { color: "#eef1ef" } } },
        { type: "value", splitLine: { show: false } },
      ],
      series: [
        ...cats.map((c: any) => ({
          name: c,
          type: "bar",
          stack: "fees",
          barMaxWidth: 36,
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          data: buckets.map((k, i) => ({
            value: stack
              ? events
                  .filter((e: Event) => key(e.date) === k && e.category === c)
                  .reduce((s: number, e: Event) => s + (e.converted || 0), 0)
              : totals[i],
            itemStyle: { opacity: k >= key(today()) ? 0.5 : 1 },
          })),
        })),
        {
          name: "累计预计支出",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          lineStyle: { type: "dashed", width: 2 },
          symbol: "circle",
          symbolSize: 5,
          data: totals.map((v) => +(cumulative += v).toFixed(2)),
        },
      ],
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current!);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [events, from, to, group, stack, base]);
  return <div ref={ref} className="chart" />;
}
function Breakdown({ events, base, field, title }: any) {
  const totals: Record<string, number> = {};
  const labels: Record<string, string> = {};
  for (const e of events) {
    const key = field === "name" ? e.subscriptionId : e[field];
    labels[key] = e[field];
    totals[key] = (totals[key] || 0) + (e.converted || 0);
  }
  const rows = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8),
    sum = Object.values(totals).reduce((a, b) => a + b, 0);
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>
      </div>
      {rows.map(([k, v]) => (
        <div className="breakdown" key={k}>
          <div>
            <span>{labels[k]}</span>
            <b>
              {currency(v, base)}{" "}
              <small>{sum ? ((v / sum) * 100).toFixed(0) : 0}%</small>
            </b>
          </div>
          <div className="bar">
            <i style={{ width: (sum ? (v / sum) * 100 : 0) + "%" }} />
          </div>
        </div>
      ))}
      {!rows.length && <div className="empty compact">暂无数据</div>}
    </section>
  );
}
function Notifications({ subs, notify }: any) {
  const logs = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api("/notifications"),
    refetchInterval: 30000,
  });
  const data = useEvents(
    today(),
    DateTime.fromISO(today()).plus({ days: 30 }).toISODate()!,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">STAY AHEAD</div>
          <h1>到期提醒</h1>
          <p>提前知道下一次续费，把选择权留在自己手里。</p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>未来 30 天</h2>
          <span className="pill">站内提醒</span>
        </div>
        {(data.data?.events || [])
          .filter(
            (e: Event) =>
              subs.find((s: any) => s.id === e.subscriptionId)?.kind ===
              "recurring",
          )
          .map((e: Event) => (
            <div className="notification" key={e.id}>
              <Logo
                s={
                  subs.find((s: Subscription) => s.id === e.subscriptionId) ?? e
                }
              />
              <div>
                <b>{e.name}</b>
                <p>
                  {e.date} · {typeName(e.type)}
                </p>
              </div>
              <strong>
                {e.type === "expiry"
                  ? "到期结束"
                  : currency(major(e.amount, e.currency), e.currency)}
              </strong>
            </div>
          ))}
        {!data.data?.events.length && (
          <div className="empty compact">近期没有到期事件</div>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Bark 投递记录</h2>
        </div>
        {logs.data?.map((l: any) => (
          <div className="notification" key={l.id}>
            <Logo
              s={
                subs.find(
                  (s: Subscription) =>
                    s.id === JSON.parse(l.data).subscriptionId,
                ) ?? JSON.parse(l.data)
              }
            />
            <div>
              <b>{JSON.parse(l.data).name}</b>
              <p>
                {JSON.parse(l.data).date} ·{" "}
                {
                  (
                    {
                      sent: "已发送",
                      pending: "待发送",
                      retry: "等待重试",
                      failed: "发送失败",
                      expired: "已过期",
                    } as any
                  )[l.status]
                }{" "}
                {l.error && "· " + l.error}
              </p>
            </div>
            {["failed", "retry", "expired"].includes(l.status) && (
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await api(
                      "/notifications/" + encodeURIComponent(l.id) + "/retry",
                      "POST",
                    );
                    logs.refetch();
                    notify("已加入重试队列");
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                重试
              </button>
            )}
          </div>
        ))}
        {!logs.data?.length && (
          <div className="empty compact">
            暂无投递记录，可先在设置中测试 Bark 连接。
          </div>
        )}
      </section>
    </>
  );
}
function Preferences({ settings, categories, notify, reload }: any) {
  const [form, setForm] = useState<any>(null),
    [selectedCategory, setSelectedCategory] = useState(""),
    [cat, setCat] = useState(""),
    [color, setColor] = useState("#28796c"),
    [importing, setImporting] = useState<any>(null),
    [preview, setPreview] = useState<any>(null);
  const backups = useQuery({
    queryKey: ["backups"],
    queryFn: () => api("/backups"),
  });
  useEffect(() => {
    setForm({
      ...settings,
      barkKey: "",
      reminderText: (settings.reminders || [7, 1, 0]).join(","),
    });
  }, [settings]);
  const run = async (fn: () => Promise<any>, message: string) => {
    try {
      await fn();
      notify(message);
      reload();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  if (!form) return null;
  const selected = categories.find((c: any) => c.name === selectedCategory);
  const field = (key: string, value: any) => setForm({ ...form, [key]: value });
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE IT YOURS</div>
          <h1>偏好设置</h1>
          <p>为你的订阅空间，设置熟悉的使用方式。</p>
        </div>
      </div>
      <InstallApp />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              api("/settings", "PUT", {
                ...form,
                reminders: form.reminderText
                  .split(",")
                  .filter(Boolean)
                  .map(Number),
              }),
            "设置已保存",
          );
        }}
      >
        <section className="panel settings-panel">
          <h2>通用偏好</h2>
          <p className="muted">统计币种与日历时区</p>
          <div className="form-grid">
            <label>
              统计币种
              <input
                value={form.base}
                maxLength={3}
                pattern="[A-Z]{3}"
                onChange={(e) => field("base", e.target.value.toUpperCase())}
              />
            </label>
            <label>
              时区
              <input
                value={form.timezone}
                onChange={(e) => field("timezone", e.target.value)}
              />
            </label>
          </div>
          <div className="rates-settings">
            <div className="rates-settings-heading">
              <span className="rates-settings-icon">
                <RefreshCw size={18} aria-hidden="true" />
              </span>
              <h3>汇率与自动刷新</h3>
            </div>
            <p className="muted rates-description">
              Frankfurter · 按 {settings.timezone} 时区执行；失败后每 15
              分钟重试，离线时保留缓存。
            </p>
            <div className="form-grid rates-schedule">
              <label>
                自动刷新
                <Select
                  aria-label="自动刷新"
                  value={String(form.ratesAutoRefresh ?? true)}
                  onChange={(e) =>
                    field("ratesAutoRefresh", e.target.value === "true")
                  }
                >
                  <option value="true">开启</option>
                  <option value="false">关闭</option>
                </Select>
              </label>
              <label>
                刷新频率
                <Select
                  aria-label="刷新频率"
                  value={form.ratesRefreshFrequency || "daily"}
                  onChange={(e) =>
                    field("ratesRefreshFrequency", e.target.value)
                  }
                >
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                </Select>
              </label>
              {form.ratesRefreshFrequency === "weekly" && (
                <label>
                  刷新星期
                  <Select
                    aria-label="刷新星期"
                    value={form.ratesRefreshWeekday || 1}
                    onChange={(e) =>
                      field("ratesRefreshWeekday", Number(e.target.value))
                    }
                  >
                    {["一", "二", "三", "四", "五", "六", "日"].map((d, i) => (
                      <option key={d} value={i + 1}>
                        星期{d}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
              <label>
                刷新时间
                <input
                  type="time"
                  required
                  value={form.ratesRefreshTime || "09:00"}
                  onChange={(e) => field("ratesRefreshTime", e.target.value)}
                />
              </label>
            </div>
            <p className="muted rates-help">
              修改规则后点击下方“保存设置”生效。容器恢复时会补刷已错过的计划。
            </p>
            <div className="rates-status-grid">
              <div className="rates-status-item">
                <span>最近成功刷新</span>
                <strong>
                  {settings.rates?.updated
                    ? DateTime.fromMillis(settings.rates.updated)
                        .setZone(settings.timezone)
                        .toFormat("yyyy-MM-dd HH:mm")
                    : "暂无刷新记录"}
                </strong>
              </div>
              <div className="rates-status-item">
                <span>下次计划</span>
                <strong>
                  {settings.ratesNextRefresh
                    ? DateTime.fromISO(settings.ratesNextRefresh, {
                        setZone: true,
                      }).toFormat("yyyy-MM-dd HH:mm")
                    : "自动刷新已关闭"}
                </strong>
              </div>
            </div>
            {settings.ratesStatus?.error && (
              <p className="warning" role="status">
                {settings.ratesStatus.error}
              </p>
            )}
            {settings.rates?.base && settings.rates.base !== settings.base && (
              <p className="warning">
                缓存基准币种与当前统计币种不同，请刷新汇率；当前缓存不参与统计。
              </p>
            )}
            <details className="rates-details">
              <summary>
                查看汇率明细（{Object.keys(settings.rates?.rates || {}).length}{" "}
                种币种）
              </summary>
              <p className="muted">
                以下为 1 单位原币折合的 {settings.rates?.base || settings.base}{" "}
                金额，非历史结算汇率。
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>原币</th>
                      <th>折合 {settings.rates?.base || settings.base}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(settings.rates?.rates || {})
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([code, rate]) => (
                        <tr key={code}>
                          <td>
                            <span className="currency-flag" aria-hidden="true">
                              {currencyFlag(code)}
                            </span>{" "}
                            1 {code}
                          </td>
                          <td>
                            {Number(rate).toLocaleString("zh-CN", {
                              maximumFractionDigits: 6,
                            })}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
            <div className="rates-footer">
              <span className="rates-footer-note">
                汇率日期：{settings.rates?.date || "尚未获取"} ·
                全部区间按最近汇率估算
              </span>
              <button
                type="button"
                className="secondary rates-refresh-button"
                onClick={() =>
                  run(async () => {
                    try {
                      return await api("/rates/refresh", "POST");
                    } finally {
                      reload();
                    }
                  }, "汇率已刷新")
                }
              >
                <RefreshCw size={14} />
                刷新汇率
              </button>
            </div>
          </div>
        </section>
        <section className="panel settings-panel">
          <h2>Bark 推送</h2>
          <p className="muted">
            每天当地时间 09:00 发送提醒；容器需要保持运行。
          </p>
          <div className="form-grid">
            <label className="checkbox full">
              <input
                type="checkbox"
                checked={form.barkEnabled}
                onChange={(e) => field("barkEnabled", e.target.checked)}
              />
              启用 Bark 通知
            </label>
            <label>
              Bark 服务器
              <input
                type="url"
                value={form.barkServer}
                onChange={(e) => field("barkServer", e.target.value)}
              />
            </label>
            <label>
              设备 Key
              <input
                type="password"
                autoComplete="new-password"
                value={form.barkKey}
                placeholder={
                  settings.hasBarkKey ? "已配置；留空保持不变" : "输入设备 Key"
                }
                onChange={(e) => field("barkKey", e.target.value)}
              />
            </label>
            <label>
              通知分组
              <input
                value={form.barkGroup}
                onChange={(e) => field("barkGroup", e.target.value)}
              />
            </label>
            <label>
              提前天数
              <input
                value={form.reminderText}
                onChange={(e) => field("reminderText", e.target.value)}
                placeholder="7,1,0"
              />
            </label>
            <label className="full">
              应用访问地址（可选）
              <input
                type="url"
                value={form.appUrl}
                onChange={(e) => field("appUrl", e.target.value)}
                placeholder="https://subscriptions.example.com"
              />
              <small>
                用于通知图标和点击跳转，请填写手机可访问的地址。订阅提醒使用项目
                Logo，测试通知使用订阅集 Logo。
              </small>
            </label>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              run(() => api("/bark/test", "POST"), "测试通知已发送")
            }
          >
            发送测试通知（请先保存）
          </button>
        </section>
        <div className="save-settings">
          <button className="primary">保存设置</button>
        </div>
      </form>
      <section className="panel settings-panel category-settings-panel">
        <h2>订阅分类</h2>
        <div className="category-manager actions">
          <CategorySelect
            categories={categories}
            value={selected ? selectedCategory : ""}
            onChange={(name) => {
              setSelectedCategory(name);
              setCat("");
              setColor(
                categories.find((c: any) => c.name === name)?.color ||
                  "#28796c",
              );
            }}
          />
          {selected && (
            <button
              type="button"
              className="secondary"
              disabled={selected.name === "未分类" || selected.usageCount > 0}
              onClick={() =>
                run(async () => {
                  await api(
                    "/categories/" + encodeURIComponent(selected.name),
                    "DELETE",
                  );
                  setSelectedCategory("");
                  setCat("");
                  setColor("#28796c");
                }, "分类已删除")
              }
            >
              删除分类
            </button>
          )}
        </div>
        {selected && (
          <p className="muted">
            {selected.name === "未分类"
              ? "默认分类不能删除。"
              : selected.usageCount > 0
                ? "该分类已有订阅项目使用，不能删除（包含归档订阅）。"
                : "该分类尚未被订阅项目使用，可以删除。"}
          </p>
        )}
        <div className="actions">
          {!selected && (
            <input
              aria-label="新分类名称"
              placeholder="新分类名称"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
            />
          )}
          <input
            type="color"
            aria-label="分类颜色"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
          <button
            className="secondary"
            onClick={() =>
              run(
                () =>
                  api("/categories", "POST", {
                    name: selected?.name || cat,
                    color,
                  }),
                "分类已保存",
              )
            }
          >
            保存分类
          </button>
        </div>
      </section>
      <section className="panel settings-panel">
        <h2>数据导入与导出</h2>
        <p className="muted">
          JSON 保留规则历史；CSV
          用于常见字段交换。导入会新增记录，不覆盖已有订阅；Logo
          请使用完整备份迁移。
        </p>
        <div className="actions">
          <a className="button secondary" href="/api/v1/export">
            <Download size={16} />
            导出 JSON
          </a>
          <a className="button secondary" href="/api/v1/export?format=csv">
            导出 CSV
          </a>
          <label className="button secondary">
            选择导入文件
            <input
              hidden
              type="file"
              accept=".json,.csv"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const b = {
                  format: f.name.endsWith(".csv") ? "csv" : "json",
                  text: await f.text(),
                };
                setImporting(b);
                run(
                  async () =>
                    setPreview(await api("/import/preview", "POST", b)),
                  "导入预览已生成",
                );
              }}
            />
          </label>
        </div>
        {preview && (
          <div className="import-preview">
            <p>
              可导入 {preview.count} 条 · 错误 {preview.errors.length} 条
            </p>
            {preview.errors.map((e: any) => (
              <p className="error" key={e.row}>
                第 {e.row} 行：{e.error}
              </p>
            ))}
            {preview.preview.map((s: any) => (
              <div key={s.id}>
                {s.name} · {s.start} · {s.category}
              </div>
            ))}
            <button
              className="primary"
              disabled={preview.errors.length > 0}
              onClick={() =>
                run(async () => {
                  await api("/import", "POST", importing);
                  setPreview(null);
                }, "导入完成")
              }
            >
              确认新增导入
            </button>
          </div>
        )}
      </section>
      <section className="panel settings-panel">
        <h2>备份与恢复</h2>
        <p className="muted">
          每天自动备份，保留最近 14
          份。完整备份包含敏感配置，请妥善保存；加密密钥需单独备份。
        </p>
        <div className="actions">
          <button
            className="secondary"
            onClick={() =>
              run(async () => {
                await api("/backups", "POST");
                backups.refetch();
              }, "备份已创建")
            }
          >
            立即备份
          </button>
          <label className="button secondary">
            从 ZIP 恢复
            <input
              type="file"
              hidden
              accept=".zip"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (
                  !file ||
                  !confirm(
                    "恢复将覆盖当前数据并退出登录。系统会先备份当前数据，是否继续？",
                  )
                )
                  return;
                const fd = new FormData();
                fd.append("file", file);
                await run(async () => {
                  await api("/restore", "POST", fd);
                  location.reload();
                }, "恢复完成");
              }}
            />
          </label>
        </div>
        <div className="backup-list">
          {backups.data?.map((f: string) => (
            <a key={f} href={"/api/v1/backups/" + f}>
              <Archive size={14} />
              {f}
              <Download size={14} />
            </a>
          ))}
        </div>
      </section>
      <button
        className="secondary"
        onClick={async () => {
          await api("/auth/logout", "POST");
          location.reload();
        }}
      >
        <LogOut size={16} />
        退出登录
      </button>
    </>
  );
}
function PasswordForm({ notify }: any) {
  const { register, handleSubmit } = useForm();
  return (
    <form
      className="panel settings-panel"
      onSubmit={handleSubmit(async (b) => {
        try {
          await api("/auth/password", "POST", b);
          location.reload();
        } catch (e) {
          notify((e as Error).message);
        }
      })}
    >
      <h2>修改登录密码</h2>
      <div className="form-grid">
        <label>
          当前密码
          <input
            type="password"
            {...register("old")}
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          新密码（至少 10 位）
          <input
            type="password"
            {...register("password")}
            autoComplete="new-password"
            minLength={10}
            required
          />
        </label>
      </div>
      <button className="secondary">修改并重新登录</button>
    </form>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
