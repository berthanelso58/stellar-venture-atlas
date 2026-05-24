import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gamesRouter from "./games";
import playersRouter from "./players";
import celestialRouter from "./celestial";
import milestonesRouter from "./milestones";
import tasksRouter from "./tasks";
import risksRouter from "./risks";
import kpisRouter from "./kpis";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(gamesRouter);
router.use(playersRouter);
router.use(celestialRouter);
router.use(milestonesRouter);
router.use(tasksRouter);
router.use(risksRouter);
router.use(kpisRouter);
router.use(dashboardRouter);

export default router;
