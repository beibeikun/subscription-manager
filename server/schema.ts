import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
});
export const categories = sqliteTable("categories", {
  name: text("name").primaryKey(),
  color: text("color").notNull(),
});
export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  csrf: text("csrf").notNull(),
  expires: integer("expires").notNull(),
});
export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  status: text("status").notNull(),
  attempt: integer("attempt").default(0).notNull(),
  next: integer("next").notNull(),
  error: text("error"),
});
