import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import { db, gamesTable, playersTable, milestonesTable, tasksTable, risksTable, kpisTable, kpiEntriesTable } from "@workspace/db";
import { GetGameParams } from "@workspace/api-zod";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/games/:gameId/dashboard", async (req, res): Promise<void> => {
  const params = GetGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { gameId } = params.data;

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  const players = await db.select().from(playersTable).where(eq(playersTable.gameId, gameId));
  const milestones = await db.select().from(milestonesTable).where(eq(milestonesTable.gameId, gameId));
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.gameId, gameId));
  const risks = await db.select().from(risksTable).where(and(eq(risksTable.gameId, gameId), eq(risksTable.status, "active")));
  const kpis = await db.select().from(kpisTable).where(eq(kpisTable.gameId, gameId));

  const milestoneProgress = {
    total: milestones.length,
    harvested: milestones.filter(m => m.status === "harvested").length,
    blooming: milestones.filter(m => m.status === "blooming").length,
    growing: milestones.filter(m => m.status === "growing").length,
    planted: milestones.filter(m => m.status === "planted").length,
    totalStars: milestones.reduce((sum, m) => sum + m.starsValue, 0),
  };

  const taskStats = {
    total: tasks.length,
    done: tasks.filter(t => t.status === "next_plan").length,
    blooming: tasks.filter(t => t.status === "check").length,
    sprouting: tasks.filter(t => t.status === "doing").length,
    seed: tasks.filter(t => t.status === "plan").length,
  };

  const kpiSummary = await Promise.all(kpis.map(async (kpi) => {
    const [latest] = await db.select().from(kpiEntriesTable).where(eq(kpiEntriesTable.kpiId, kpi.id)).orderBy(desc(kpiEntriesTable.date)).limit(1);
    const progressPercent = kpi.target > 0 ? Math.min(100, (kpi.current / kpi.target) * 100) : 0;
    return {
      kpi: { ...kpi, linkedTaskIds: [] },
      latestValue: latest?.value ?? null,
      progressPercent,
    };
  }));

  const recentActivity = [
    ...tasks.slice(-5).map(t => ({ type: "task", title: t.title, timestamp: t.createdAt })),
    ...milestones.slice(-3).map(m => ({ type: "milestone", title: m.title, timestamp: m.createdAt })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 8);

  res.json({
    game,
    players,
    milestoneProgress,
    taskStats,
    activeRisks: risks,
    kpiSummary,
    recentActivity,
  });
});

export default router;
