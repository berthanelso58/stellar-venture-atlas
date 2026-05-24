import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, celestialBodiesTable } from "@workspace/db";
import {
  ListCelestialBodiesParams,
  CreateCelestialBodyParams,
  CreateCelestialBodyBody,
  UpdateCelestialBodyParams,
  UpdateCelestialBodyBody,
  DeleteCelestialBodyParams,
} from "@workspace/api-zod";

const router: IRouter = Router({ mergeParams: true });

router.get("/games/:gameId/celestial", async (req, res): Promise<void> => {
  const params = ListCelestialBodiesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const bodies = await db.select().from(celestialBodiesTable).where(eq(celestialBodiesTable.gameId, params.data.gameId));
  res.json(bodies);
});

router.post("/games/:gameId/celestial", async (req, res): Promise<void> => {
  const params = CreateCelestialBodyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateCelestialBodyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [body] = await db.insert(celestialBodiesTable).values({ ...parsed.data, gameId: params.data.gameId }).returning();
  res.status(201).json(body);
});

router.patch("/games/:gameId/celestial/:celestialId", async (req, res): Promise<void> => {
  const params = UpdateCelestialBodyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCelestialBodyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [body] = await db.update(celestialBodiesTable).set(parsed.data).where(and(eq(celestialBodiesTable.id, params.data.celestialId), eq(celestialBodiesTable.gameId, params.data.gameId))).returning();
  if (!body) {
    res.status(404).json({ error: "Celestial body not found" });
    return;
  }
  res.json(body);
});

router.delete("/games/:gameId/celestial/:celestialId", async (req, res): Promise<void> => {
  const params = DeleteCelestialBodyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(celestialBodiesTable).where(and(eq(celestialBodiesTable.id, params.data.celestialId), eq(celestialBodiesTable.gameId, params.data.gameId)));
  res.sendStatus(204);
});

export default router;
