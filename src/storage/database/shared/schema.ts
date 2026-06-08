import { pgTable, serial, varchar, timestamp, text, index, integer, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const travelRecords = pgTable(
  "travel_records",
  {
    id: serial().primaryKey(),
    user_id: integer("user_id"),
    username: varchar("username", { length: 80 }),
    destination: varchar("destination", { length: 255 }).notNull(),
    travel_time: varchar("travel_time", { length: 255 }).notNull(),
    result: text("result"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("travel_records_created_at_idx").on(table.created_at),
    index("travel_records_user_created_at_idx").on(table.user_id, table.created_at),
  ]
);

export const appUsers = pgTable(
  "app_users",
  {
    id: serial().primaryKey(),
    username: varchar("username", { length: 80 }).notNull(),
    password_hash: text("password_hash").notNull(),
    password_salt: text("password_salt").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("app_users_username_idx").on(table.username),
  ]
);
