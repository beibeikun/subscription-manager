import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
if (existsSync(".env")) {
  console.log(".env 已存在，保持不变。");
  process.exit(0);
}
writeFileSync(
  ".env",
  `INIT_ADMIN_USERNAME=admin\nINIT_ADMIN_PASSWORD=${randomBytes(18).toString("base64url")}\nENCRYPTION_KEY=${randomBytes(32).toString("hex")}\nAPP_PORT=3188\nBIND_ADDRESS=127.0.0.1\nCOOKIE_SECURE=false\n`,
  { mode: 0o600 },
);
console.log("已生成 .env。初始登录凭据和加密密钥保存在该文件内。");
