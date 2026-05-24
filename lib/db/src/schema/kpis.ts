import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gamesTable } from "./games";
import { milestonesTable } from "./milestones";

export const kpisTable = pgTable("kpis", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  milestoneId: integer("milestone_id").references(() => milestonesTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  unit: text("unit").notNull().default(""),
  target: real("target").notNull().default(100),
  current: real("current").notNull().default(0),
  trend: text("trend"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const kpiEntriesTable = pgTable("kpi_entries", {
  id: serial("id").primaryKey(),
  kpiId: integer("kpi_id").notNull().references(() => kpisTable.id, { onDelete: "cascade" }),
  value: real("value").notNull(),
  note: text("note"),
  date: text("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertKpiSchema = createInsertSchema(kpisTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKpi = z.infer<typeof insertKpiSchema>;
export type Kpi = typeof kpisTable.$inferSelect;

export const insertKpiEntrySchema = createInsertSchema(kpiEntriesTable).omit({ id: true, createdAt: true });
export type InsertKpiEntry = z.infer<typeof insertKpiEntrySchema>;
export type KpiEntry = typeof kpiEntriesTable.$inferSelect;
