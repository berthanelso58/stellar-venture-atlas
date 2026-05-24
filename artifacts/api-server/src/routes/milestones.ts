import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import { db, milestonesTable, tasksTable } from "@workspace/db";
import {
  ListMilestonesParams,
  CreateMilestoneParams,
  CreateMilestoneBody,
  UpdateMilestoneParams,
  UpdateMilestoneBody,
  DeleteMilestoneParams,
} from "@workspace/api-zod";

const router: IRouter = Router({ mergeParams: true });

router.get("/games/:gameId/milestones", async (req, res): Promise<void> => {
  const params = ListMilestonesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const milestones = await db.select().from(milestonesTable).where(eq(milestonesTable.gameId, params.data.gameId));

  const withCounts = await Promise.all(milestones.map(async (m) => {
    const [{ total }] = await db.select({ total: count() }).from(tasksTable).where(eq(tasksTable.milestoneId, m.id));
    const [{ done }] = await db.select({ done: count() }).from(tasksTable).where(and(eq(tasksTable.milestoneId, m.id), eq(tasksTable.status, "next_plan")));
    return { ...m, taskCount: Number(total), completedTaskCount: Number(done) };
  }));

  res.json(withCounts);
});

router.post("/games/:gameId/milestones", async (req, res): Promise<void> => {
  const params = CreateMilestoneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateMilestoneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [milestone] = await db.insert(milestonesTable).values({ ...parsed.data, gameId: params.data.gameId }).returning();
  res.status(201).json({ ...milestone, taskCount: 0, completedTaskCount: 0 });
});

router.patch("/games/:gameId/milestones/:milestoneId", async (req, res): Promise<void> => {
  const params = UpdateMilestoneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMilestoneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [milestone] = await db.update(milestonesTable).set({ ...parsed.data, updatedAt: new Date() }).where(and(eq(milestonesTable.id, params.data.milestoneId), eq(milestonesTable.gameId, params.data.gameId))).returning();
  if (!milestone) {
    res.status(404).json({ error: "Milestone not found" });
    return;
  }
  const [{ total }] = await db.select({ total: count() }).from(tasksTable).where(eq(tasksTable.milestoneId, milestone.id));
  const [{ done }] = await db.select({ done: count() }).from(tasksTable).where(and(eq(tasksTable.milestoneId, milestone.id), eq(tasksTable.status, "next_plan")));
  res.json({ ...milestone, taskCount: Number(total), completedTaskCount: Number(done) });
});

router.delete("/games/:gameId/milestones/:milestoneId", async (req, res): Promise<void> => {
  const params = DeleteMilestoneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(milestonesTable).where(and(eq(milestonesTable.id, params.data.milestoneId), eq(milestonesTable.gameId, params.data.gameId)));
  res.sendStatus(204);
});

export default router;
