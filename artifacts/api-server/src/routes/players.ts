import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";
import {
  ListPlayersParams,
  CreatePlayerParams,
  CreatePlayerBody,
  UpdatePlayerParams,
  UpdatePlayerBody,
  DeletePlayerParams,
} from "@workspace/api-zod";

const router: IRouter = Router({ mergeParams: true });

router.get("/games/:gameId/players", async (req, res): Promise<void> => {
  const params = ListPlayersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const players = await db.select().from(playersTable).where(eq(playersTable.gameId, params.data.gameId));
  res.json(players);
});

router.post("/games/:gameId/players", async (req, res): Promise<void> => {
  const params = CreatePlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreatePlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [player] = await db.insert(playersTable).values({ ...parsed.data, gameId: params.data.gameId }).returning();
  res.status(201).json(player);
});

router.patch("/games/:gameId/players/:playerId", async (req, res): Promise<void> => {
  const params = UpdatePlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [player] = await db.update(playersTable).set(parsed.data).where(and(eq(playersTable.id, params.data.playerId), eq(playersTable.gameId, params.data.gameId))).returning();
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.json(player);
});

router.delete("/games/:gameId/players/:playerId", async (req, res): Promise<void> => {
  const params = DeletePlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(playersTable).where(and(eq(playersTable.id, params.data.playerId), eq(playersTable.gameId, params.data.gameId)));
  res.sendStatus(204);
});

export default router;
