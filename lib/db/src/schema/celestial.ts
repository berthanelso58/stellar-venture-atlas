import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gamesTable } from "./games";
import { playersTable } from "./players";

export const celestialBodiesTable = pgTable("celestial_bodies", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  playerId: integer("player_id").references(() => playersTable.id, { onDelete: "set null" }),
  type: text("type").notNull().default("moon"),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  targetDate: text("target_date"),
  progress: integer("progress").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCelestialBodySchema = createInsertSchema(celestialBodiesTable).omit({ id: true, createdAt: true });
export type InsertCelestialBody = z.infer<typeof insertCelestialBodySchema>;
export type CelestialBody = typeof celestialBodiesTable.$inferSelect;
