import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, kpisTable, kpiEntriesTable } from "@workspace/db";
import {
  ListKpisParams,
  CreateKpiParams,
  CreateKpiBody,
  UpdateKpiParams,
  UpdateKpiBody,
  DeleteKpiParams,
  ListKpiEntriesParams,
  CreateKpiEntryParams,
  CreateKpiEntryBody,
} from "@workspace/api-zod";

const router: IRouter = Router({ mergeParams: true });

router.get("/games/:gameId/kpis", async (req, res): Promise<void> => {
  const params = ListKpisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const kpis = await db.select().from(kpisTable).where(eq(kpisTable.gameId, params.data.gameId));
  res.json(kpis.map(k => ({ ...k, linkedTaskIds: [] })));
});

router.post("/games/:gameId/kpis", async (req, res): Promise<void> => {
  const params = CreateKpiParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateKpiBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [kpi] = await db.insert(kpisTable).values({ ...parsed.data, gameId: params.data.gameId }).returning();
  res.status(201).json({ ...kpi, linkedTaskIds: [] });
});

router.patch("/games/:gameId/kpis/:kpiId", async (req, res): Promise<void> => {
  const params = UpdateKpiParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateKpiBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [kpi] = await db.update(kpisTable).set({ ...parsed.data, updatedAt: new Date() }).where(and(eq(kpisTable.id, params.data.kpiId), eq(kpisTable.gameId, params.data.gameId))).returning();
  if (!kpi) {
    res.status(404).json({ error: "KPI not found" });
    return;
  }
  res.json({ ...kpi, linkedTaskIds: [] });
});

router.delete("/games/:gameId/kpis/:kpiId", async (req, res): Promise<void> => {
  const params = DeleteKpiParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(kpisTable).where(and(eq(kpisTable.id, params.data.kpiId), eq(kpisTable.gameId, params.data.gameId)));
  res.sendStatus(204);
});

router.get("/games/:gameId/kpis/:kpiId/entries", async (req, res): Promise<void> => {
  const params = ListKpiEntriesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const entries = await db.select().from(kpiEntriesTable).where(eq(kpiEntriesTable.kpiId, params.data.kpiId)).orderBy(desc(kpiEntriesTable.date));
  res.json(entries);
});

router.post("/games/:gameId/kpis/:kpiId/entries", async (req, res): Promise<void> => {
  const params = CreateKpiEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateKpiEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [entry] = await db.insert(kpiEntriesTable).values({ ...parsed.data, kpiId: params.data.kpiId }).returning();

  const [kpi] = await db.select().from(kpisTable).where(eq(kpisTable.id, params.data.kpiId));
  if (kpi) {
    const entries = await db.select().from(kpiEntriesTable).where(eq(kpiEntriesTable.kpiId, kpi.id)).orderBy(desc(kpiEntriesTable.date));
    const latest = entries[0]?.value ?? 0;
    const prev = entries[1]?.value ?? 0;
    const trend = latest > prev ? "up" : latest < prev ? "down" : "flat";
    await db.update(kpisTable).set({ current: latest, trend, updatedAt: new Date() }).where(eq(kpisTable.id, kpi.id));
  }

  res.status(201).json(entry);
});

export default router;
