# 订阅集 · Subscription Manager

个人自托管的会员订阅管理工具。React + TypeScript 前端、Fastify 后端、SQLite 持久化，单容器运行。中文响应式界面，支持电脑和手机浏览器。

## 快速开始

需要 Docker Engine / Docker Desktop 与 Compose。项目使用 Node.js 24 LTS 构建镜像。

```sh
# 在项目目录执行，生成随机管理员密码及加密密钥；不会覆盖已有 .env
npm run init
# 打开 .env 查看 INIT_ADMIN_PASSWORD，默认用户名 admin
# 若没有本机 Node，复制 .env.example 为 .env 并自行填写密码和 openssl rand -hex 32 的结果

docker compose up -d --build
```

默认访问 **http://127.0.0.1:3188**（init 脚本设置），手工使用 `.env.example` 时默认端口为 3000。`.env` 仅供本机使用，不要提交到版本库。管理员只在空数据库首次启动时创建，更改初始化环境变量不会重置既有密码。

- 要从局域网访问，设置 `BIND_ADDRESS=0.0.0.0`，通过宿主机 IP 和配置端口访问。
- 公网部署放在 HTTPS 反向代理后，并设置 `COOKIE_SECURE=true`。反代须保留原始 Host。
- 数据卷为 `subscriptions-data`，容器内路径 `/data`。可重建容器，**不要使用 `docker compose down -v` 删除正式数据卷**。
- 单实例运行，数据库放本地磁盘；不支持多个实例共享 SQLite 或网络文件系统。

## 已实现的功能

- 管理员登录、退出、修改密码、CLI 重置；HttpOnly 会话、CSRF / 来源校验、登录限流。
- 周期订阅和永久买断；自定义名称、Logo 裁剪上传、金额、币种、日期、分类、备注和官网。
- 每 N 天 / 周 / 月 / 年，自然月末和闰年锚点；关闭续费后只提醒到期。
- 卡片 / 表格视图，搜索和筛选，复制、归档、恢复、永久删除。
- 历史规则版本：修正录入错误或从下一次续费改变金额 / 周期。
- 日历、按日 / 月 / 年趋势、累计预计支出、分类堆叠、分类占比、订阅排名及原币明细。
- Frankfurter 自动汇率与缓存、缺失汇率告警、手动刷新。
- 站内未来 30 天提醒、Bark、自建 Bark、持久化投递日志、去重及失败重试。
- JSON / CSV 导入预览、逐行错误、事务式导入；结构化导出。
- 每日完整备份、保留 14 份、下载和恢复，恢复前自动备份当前数据并注销会话。

## 费用与日期口径

所有费用都是**按录入规则推算**，不是银行扣款或实际账单。今天之前也只表示历史推算，今天之后为预测。

- 1 月 31 日的月付在 2 月末续费、3 月回到 31 日；2 月 29 日年付在非闰年取 2 月末。
- 首笔付款默认在开始日。永久买断只在购买日产生一次费用。
- 到期日为服务结束边界，当天不再生成续费费用。
- 归档不改变费用和提醒；停止付费应关闭自动续费并填写到期日。
- “修正录入错误”会按新规则重算全部历史；“从下一期变更”保留既有历史并从下次续费建立新周期锚点。
- 金额存为各币种最小单位整数，转换使用 Decimal；显示时按币种小数位舍入。
- 所有统计区间按最新可用参考汇率折算，不使用历史结算汇率。无汇率时保留原币、排除折算总额并告警。
- 统计默认人民币，时区默认 Asia/Shanghai，均可在设置修改。
- CSV 是当前规则的扁平交换格式；需要保留多个历史规则，请用 JSON。Logo 迁移需要 ZIP 完整备份。
- 一次统计查询最长 20 年；导入最多 10,000 条，规则版本最多 1,000 个。

## Bark 配置

1. 在 iPhone 的 Bark 应用中获取设备 Key。
2. 在“偏好设置”填写服务器（默认 `https://api.day.app`）、设备 Key 和通知分组。
3. 配置提前天数，例如 `7,1,0`。单个订阅可覆盖全局值；空白表示继承。
4. 保存后点击“发送测试通知”，在 iPhone 确认收到。服务器地址支持服务器根地址、`/push` 接口或包含设备 Key 的完整 Bark 链接，发送前会规范化，避免将 `push` 误当通知正文。
5. 如需通知图标及点击通知打开应用，填写从手机可访问的应用 URL。正式提醒携带对应项目 Logo；未上传或图片缺失时使用订阅集 Logo。设置里的测试通知使用订阅集 Logo，未配置应用 URL 时使用当前请求地址。

通知通过 Bark 的 `icon` 参数携带图片地址（[Bark 官方说明](https://github.com/Finb/Bark/blob/master/README.zh.md)）。图片接口使用独立签名，无需手机登录，输出 PNG；签名仅允许读取指定图片，不授予其他 API 权限。手机必须能够访问应用地址并信任其 HTTPS 证书；后台提醒未配置应用 URL 时只发送文字。更换 ENCRYPTION_KEY 会使旧图片链接失效。

正式提醒的标题显示应用名称和剩余天数，正文显示续费日期与原币预计扣款金额；已关闭续费的到期事件说明本次不计扣款。后台每分钟扫描，当地时间 09:00 后发送当日应投递提醒。停机恢复仅补发当天，过去日期不补发。失败按 1、5、30 分钟重试，之后标记失败。请求超时可能已经送达，日志会标明不确定状态。密钥用 AES-256-GCM 加密；独立保存 `.env` 中的 ENCRYPTION_KEY，丢失时重新录入 Bark Key。

## 备份、恢复、升级和回滚

“偏好设置 → 备份与恢复”可立即创建、下载 ZIP，或选择 ZIP 恢复。自动备份在服务启动及每日后台扫描中执行，容器停止期间不会运行。

备份使用 SQLite Online Backup API，写操作与图片上传串行化，包含数据库快照、Logo、版本清单。恢复校验 ZIP 路径、大小、数据库完整性、结构和订阅规则，预先创建当前备份，然后事务式替换数据和图片目录。恢复会覆盖当前数据并清除会话。备份包含管理员密码哈希和加密配置，不应公开分享；普通 JSON 导出不包含它们。

升级：

1. 在设置创建并下载备份，独立保存 `.env`。
2. 保留当前镜像标签，再更新源码 / 镜像。
3. `docker compose up -d --build`，检查 `docker compose ps` 和登录功能。
4. 不兼容迁移时，回到旧镜像，并恢复升级前备份；不要让旧版本直接读取新数据库。

当前数据库版本为 1，结构初始化记录在 `migrations` 表中。后续引入新版本迁移前需加入迁移脚本和升级前备份步骤。

忘记密码：

```sh
# NEW_ADMIN_PASSWORD 通过终端安全输入，不把实际密码写进历史命令
read -s NEW_ADMIN_PASSWORD
export NEW_ADMIN_PASSWORD
docker compose exec -e NEW_ADMIN_PASSWORD subscriptions node dist-server/server/reset-password.js
unset NEW_ADMIN_PASSWORD
```

## 本地开发与测试

```sh
npm ci
npm run init
npm run dev       # 后端 http://127.0.0.1:3000，读取 .env
# 另开终端
npm run dev:web   # Vite http://127.0.0.1:5173，代理 /api

npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

测试数据放在临时目录或 `work/`，不写入正式 Docker 卷。自动化覆盖计费规则、鉴权、导入、汇率断网、Bark 成功 / 失败 / 超时 / 去重、备份恢复及桌面和移动页面。Bark 测试使用 mock，不发送真实通知。

容器冒烟测试会创建独立测试容器和数据卷，结束时清理，只接触自己创建的资源：

```sh
docker build -t subscription-manager:1.0.0 .
node scripts/container-smoke.mjs subscription-manager:1.0.0 linux/arm64
# AMD64 宿主机改为 linux/amd64
```

脚本验证登录、PNG 上传、备份下载、重启数据保留，以及 2 核 / 2 GB 限制下 1,000 个订阅的年度统计。QEMU 模拟架构的性能结果不可当作原生性能结论。

多架构镜像：

```sh
docker buildx build --platform linux/amd64,linux/arm64 -t YOUR_REGISTRY/subscription-manager:1.0.0 --push .
```

仓库内提供 CI 工作流，在 ARM64 和 AMD64 runner 上测试及构建。镜像发布需要你自己的 registry；本项目不会自动发布到公共仓库。

## 接口与代码

认证后访问 `/api/v1/openapi.json` 查看接口清单及核心订阅 schema。写接口携带登录 / me 接口返回的 `x-csrf-token`。

- `shared/model.ts`：共享校验、金额和日历事件计算。
- `server/`：API、Drizzle 表定义、原生 SQLite 访问、提醒、备份、恢复。
- `src/`：React、TanStack Query、React Hook Form、Tailwind、shadcn 风格 Button、ECharts。
- `tests/`：单元 / API / 后台服务测试；`e2e/`：Playwright。
- `scripts/`：配置初始化和容器冒烟测试。

事件 API 统一服务列表、日历、趋势和提醒计算；不预建无限未来账单。订阅规则版本保存在订阅 JSON 中，通过 SQLite 事务原子替换。仅登录用户能访问数据库导出、原始 Logo、备份及配置；通知图片可通过对应签名链接读取。前端资源不依赖外部字体或 CDN。

下一版本可增加实际账单确认、预算和更多通知渠道。当前不包含多用户、银行同步、退款、试用期或分摊。

## 安卓 Chrome 安装（PWA）

应用已提供 manifest、192/512 图标、独立窗口模式、设置页安装入口和离线提示。安装后仍需连接服务器；Service Worker 不缓存 API、订阅、会话或备份。新版在关闭旧窗口后重新打开时生效。

局域网安装需要手机信任 HTTPS 证书。在 `.env` 中设置实际固定局域网 IP：

```dotenv
BIND_ADDRESS=0.0.0.0
LAN_HOST=192.168.31.153
COMPOSE_PROFILES=lan-https
```

运行 `docker compose up -d --build`，HTTPS 地址为 `https://你的局域网IP:3443`。Caddy 自动签发和续期本地证书。导出**公开根证书**并提供手机下载：

```sh
docker compose cp lan-https:/data/caddy/pki/authorities/local/root.crt ./Subscriptions-LAN-CA.crt
docker compose cp ./Subscriptions-LAN-CA.crt subscriptions:/data/lan-ca.crt
docker compose exec -T --user root subscriptions chmod 644 /data/lan-ca.crt
```

手机连接同一局域网，从原 HTTP 地址的 `/lan-ca.crt` 下载证书。安卓系统设置中搜索“安装证书”，选择 **CA 证书**，安装该文件（不是 VPN/应用证书）。不同手机菜单名称有所不同。重新打开 Chrome，访问 HTTPS 地址，确认没有证书警告，登录后通过菜单“安装应用”或“添加到主屏幕 → 安装”完成；设置页也会在浏览器允许时显示安装按钮。Chrome 的安装选项受设备及浏览器版本影响，实际手机安装需要手动完成。

保留 `subscriptions-tls` 和 `subscriptions-tls-config` 卷，切勿泄露其中的 CA 私钥。删除 TLS 卷后需要重新给手机安装新证书。建议路由器为服务器保留固定 IP；更改地址后需使用新地址重新安装应用。保留 HTTP 是为了兼容原入口，日常请使用 HTTPS。若关闭 HTTP，可同时设置 `COOKIE_SECURE=true`。此方案无需把服务暴露到公网。

## 个人信息

点击右上角头像或桌面侧栏个人账户进入个人信息页。支持上传、裁剪、移除头像（PNG/JPEG/WebP，最大 5 MB），以及修改登录用户名。点击“保存个人信息”生效，下次登录使用新用户名，密码不变。修改密码和退出登录位于此页，新密码至少 10 位，修改后需重新登录。个人信息和头像随完整备份保存。

## 汇率刷新规则

偏好设置展示 Frankfurter 汇率日期、成功更新时间、下次计划及可展开的原币折算明细。支持开启/关闭自动刷新、每天或每周指定星期与时间，按应用时区执行；默认每天 09:00，点击“保存设置”后生效。后台每分钟检查，停机恢复后补刷最近错过的计划；失败保留缓存并每 15 分钟重试。手动刷新不受自动开关限制。汇率日期是数据提供方的日期，休市期间刷新成功也可能保持原日期。

趋势统计不再手动输入起止日期：按月显示选中年份并左右切年；按日显示选中月份并左右切月；按年自动覆盖最早录入年份至当前年份（包含已录入的未来开始、到期和规则生效年份），不无限推演自动续费。超过 20 年的范围分段查询后合并展示。

### 从常用服务添加订阅

点击“添加订阅”先打开服务查找列表，支持按名称、中文别名、官网和分类搜索。选择服务后带入名称、官网与内置 Logo，再填写实际价格和计费周期；“自定义订阅”始终可用，打开空白表单。编辑已有订阅仍直接打开详情。

内置 32 项常用服务，图标来自 [Dashboard Icons](https://github.com/homarr-labs/dashboard-icons)，文件保存在 `public/service-icons`，使用时无需访问外部图标服务。目录和搜索别名在 `src/service-catalog.ts` 维护；来源和上游许可随图片一同保存。保存时图标通过现有上传接口规范化，兼容 Logo 展示、备份恢复和 Bark 通知。可以移除内置图标或上传自己的图片替换。
