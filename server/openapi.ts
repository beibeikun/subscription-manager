import { z } from "zod";
import { subscriptionSchema } from "../shared/model.js";
const routes: [string, string, string][] = [
  ["/auth/login", "post", "管理员登录"],
  ["/auth/me", "get", "当前会话与 CSRF token"],
  ["/auth/profile", "put", "修改用户名与头像"],
  ["/auth/logout", "post", "退出登录"],
  ["/auth/password", "post", "修改密码并注销会话"],
  ["/subscriptions", "get", "订阅列表与下次事件"],
  ["/subscriptions", "post", "新增订阅"],
  ["/subscriptions/{id}", "put", "编辑订阅；editMode 为 correction 或 next"],
  ["/subscriptions/{id}", "delete", "永久删除订阅"],
  ["/categories", "get", "分类列表"],
  ["/categories", "post", "创建或更新分类颜色"],
  ["/categories/{name}", "delete", "删除分类并迁移至未分类"],
  ["/logos", "post", "上传并规范化 Logo"],
  ["/logos/{name}", "get", "读取 Logo"],
  ["/events", "get", "按时间范围计算费用和到期事件，用于汇总、趋势与日历"],
  ["/settings", "get", "读取脱敏设置和汇率状态"],
  ["/settings", "put", "更新设置"],
  ["/rates/refresh", "post", "刷新汇率缓存"],
  ["/bark/test", "post", "发送 Bark 测试消息"],
  ["/notifications", "get", "近期投递日志"],
  ["/notifications/{id}/retry", "post", "手动重试投递"],
  ["/export", "get", "导出 JSON 或 CSV"],
  ["/import/preview", "post", "校验导入并返回逐行错误"],
  ["/import", "post", "事务式追加导入"],
  ["/backups", "get", "备份列表"],
  ["/backups", "post", "创建一致性备份"],
  ["/backups/{name}", "get", "下载完整备份"],
  ["/restore", "post", "从完整备份恢复"],
];
export const openapi: any = {
  openapi: "3.1.0",
  info: { title: "订阅集 API", version: "1.0.0" },
  servers: [{ url: "/api/v1" }],
  security: [{ sessionCookie: [] }],
  components: {
    securitySchemes: {
      sessionCookie: { type: "apiKey", in: "cookie", name: "sid" },
    },
    schemas: { Subscription: z.toJSONSchema(subscriptionSchema) },
  },
  paths: {},
};
for (const [path, method, summary] of routes) {
  const parameters: any[] = [
    ...[...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "string" },
    })),
    ...(method === "get"
      ? []
      : [
          {
            name: "x-csrf-token",
            in: "header",
            required: path !== "/auth/login",
            schema: { type: "string" },
          },
        ]),
  ];
  openapi.paths[path] ??= {};
  openapi.paths[path][method] = {
    summary,
    parameters,
    responses: {
      200: { description: "成功" },
      400: { description: "输入无效" },
      401: { description: "未登录" },
      403: { description: "来源或 CSRF 校验失败" },
    },
  };
}
openapi.paths["/auth/login"].post.security = [];
openapi.paths["/subscriptions"].post.requestBody = {
  required: true,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Subscription" },
    },
  },
};
openapi.paths["/subscriptions/{id}"].put.requestBody = {
  required: true,
  content: {
    "application/json": {
      schema: {
        allOf: [
          { $ref: "#/components/schemas/Subscription" },
          {
            type: "object",
            properties: {
              editMode: { type: "string", enum: ["correction", "next"] },
            },
          },
        ],
      },
    },
  },
};
openapi.paths["/events"].get.parameters = [
  "from",
  "to",
  "category",
  "kind",
  "currency",
].map((name) => ({
  name,
  in: "query",
  required: ["from", "to"].includes(name),
  schema: { type: "string" },
}));
