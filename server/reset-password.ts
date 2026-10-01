import { get, set, passwordHash, db } from "./db.js";
const password = process.env.NEW_ADMIN_PASSWORD;
if (!password || password.length < 10)
  throw new Error("请通过 NEW_ADMIN_PASSWORD 设置至少 10 位的新密码");
const admin = get("admin", null);
if (!admin) throw new Error("尚未初始化");
set("admin", { ...admin, hash: passwordHash(password) });
db.exec("DELETE FROM sessions");
console.log("密码已重置，所有会话已注销。");
