import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Optional: serve the built Starfield frontend from the same origin (single-service deploys).
// Set SERVE_FRONTEND=1 and ensure the frontend has been built.
// You can override with FRONTEND_DIST env var (absolute path preferred in production).
// This makes the Express server act as a full-stack server (API + SPA).
if (process.env.SERVE_FRONTEND) {
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  // Try several locations so it works in both local monorepo dev and deployed single-service setups.
  const candidates = [
    process.env.FRONTEND_DIST,
    // When running the bundled server from api-server/dist (common after esbuild)
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../starfield/dist/public"),
    // When running from project root (Render build root, start from root)
    path.resolve(process.cwd(), "artifacts/starfield/dist/public"),
    // Fallback if frontend build was copied next to the server dist
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "public"),
  ].filter(Boolean) as string[];

  let frontendDist: string | null = null;
  for (const candidate of candidates) {
    try {
      // Simple existence check via stat (sync for simplicity in this setup code)
      const fs = await import("node:fs");
      if (fs.existsSync(path.join(candidate, "index.html"))) {
        frontendDist = candidate;
        break;
      }
    } catch {}
  }

  if (frontendDist) {
    app.use(express.static(frontendDist));
    // SPA fallback for client-side routes (wouter)
    app.get("*", (_req, res) => {
      res.sendFile(path.join(frontendDist!, "index.html"));
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn("[server] SERVE_FRONTEND=1 but no frontend dist found. SPA will not be served.");
  }
}

export default app;
