/**
 * Example data seeder / mutator.
 * 
 * Usage (from project root, after `pnpm db:up`):
 *   DATABASE_URL=postgres://dev:dev@localhost:5432/starfield_dev \
 *   pnpm --filter @workspace/scripts run seed
 *
 * You can modify this file during chat to create specific demo data,
 * or I (the AI) can create temporary scripts for one-off data changes.
 */

import { db, gamesTable, playersTable, milestonesTable, tasksTable, risksTable, kpisTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Seeding demo data...");

  // For demo purposes, clear previous data so we can re-seed easily during development
  // In real use you'd make this conditional or have a separate reset script.
  await db.delete(gamesTable).where(eq(gamesTable.name, "Stellar Dynamics"));

  const [existing] = await db.select().from(gamesTable).limit(1);
  if (existing) {
    console.log("Other data exists, but proceeding to add demo game anyway.");
  }

  const [game] = await db
    .insert(gamesTable)
    .values({
      name: "Stellar Dynamics",
      mission: "Make space travel accessible and sustainable for humanity.",
      description: "Internal strategy game for aligning our 2026-2027 initiatives.",
      playerCount: 5,
    })
    .returning();

  console.log("Created game:", game.name, "(id:", game.id + ")");

  // Add some players (note: avatarColor, not color)
  await db.insert(playersTable).values([
    { gameId: game.id, name: "Alex Rivera", role: "CEO", avatarColor: "#60a5fa" },
    { gameId: game.id, name: "Sam Chen", role: "CTO", avatarColor: "#a78bfa" },
    { gameId: game.id, name: "Jordan Hale", role: "Head of Product", avatarColor: "#34d399" },
  ]);

  // Add milestones (positions are required with defaults, but we can override)
  const [m1] = await db
    .insert(milestonesTable)
    .values({
      gameId: game.id,
      title: "Q2 Prototype Complete",
      description: "Working end-to-end prototype of the new propulsion module.",
      status: "blooming",
      targetDate: "2025-06-30",
      starsValue: 3,
      positionX: 35,
      positionY: 40,
    })
    .returning();

  const [m2] = await db
    .insert(milestonesTable)
    .values({
      gameId: game.id,
      title: "First Pilot Customer Signed",
      description: "Letter of intent + deposit from a serious launch partner.",
      status: "growing",
      targetDate: "2025-09-15",
      starsValue: 5,
      positionX: 65,
      positionY: 55,
    })
    .returning();

  // Tasks
  await db.insert(tasksTable).values([
    { gameId: game.id, milestoneId: m1.id, title: "Finish thermal simulation", status: "doing", priority: "high" },
    { gameId: game.id, milestoneId: m1.id, title: "Integrate sensor firmware", status: "plan", priority: "medium" },
    { gameId: game.id, milestoneId: m2.id, title: "Prepare pilot proposal deck", status: "check", priority: "critical" },
  ]);

  // Risks (uses "name", has likelihood + impact + mitigationPlan + positions)
  await db.insert(risksTable).values([
    { 
      gameId: game.id, 
      name: "Key engineer might leave", 
      severity: "high", 
      likelihood: 4, 
      impact: 5, 
      status: "active", 
      mitigationPlan: "Retention package + knowledge transfer sessions",
      positionX: 20,
      positionY: 70,
    },
    { 
      gameId: game.id, 
      name: "Regulatory approval delayed", 
      severity: "medium", 
      likelihood: 3, 
      impact: 4, 
      status: "active",
      positionX: 80,
      positionY: 25,
    },
  ]);

  // KPIs
  await db.insert(kpisTable).values([
    { gameId: game.id, milestoneId: m1.id, name: "Propulsion Efficiency", unit: "%", current: 72, target: 95 },
    { gameId: game.id, name: "Pilot Conversion Rate", unit: "%", current: 18, target: 40 },
  ]);

  console.log("Demo data seeded successfully for game", game.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
