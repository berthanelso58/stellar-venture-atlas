import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, risksTable } from "@workspace/db";
import {
  ListRisksParams,
  CreateRiskParams,
  CreateRiskBody,
  UpdateRiskParams,
  UpdateRiskBody,
  DeleteRiskParams,
} from "@workspace/api-zod";

const router: IRouter = Router({ mergeParams: true });

router.get("/games/:gameId/risks", async (req, res): Promise<void> => {
  const params = ListRisksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const risks = await db.select().from(risksTable).where(eq(risksTable.gameId, params.data.gameId));
  res.json(risks);
});

router.post("/games/:gameId/risks", async (req, res): Promise<void> => {
  const params = CreateRiskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateRiskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [risk] = await db.insert(risksTable).values({ ...parsed.data, gameId: params.data.gameId }).returning();
  res.status(201).json(risk);
});

router.patch("/games/:gameId/risks/:riskId", async (req, res): Promise<void> => {
  const params = UpdateRiskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateRiskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [risk] = await db.update(risksTable).set({ ...parsed.data, updatedAt: new Date() }).where(and(eq(risksTable.id, params.data.riskId), eq(risksTable.gameId, params.data.gameId))).returning();
  if (!risk) {
    res.status(404).json({ error: "Risk not found" });
    return;
  }
  res.json(risk);
});

router.delete("/games/:gameId/risks/:riskId", async (req, res): Promise<void> => {
  const params = DeleteRiskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(risksTable).where(and(eq(risksTable.id, params.data.riskId), eq(risksTable.gameId, params.data.gameId)));
  res.sendStatus(204);
});

export default router;
