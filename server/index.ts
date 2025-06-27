import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleMusicSearch } from "./routes/music-search";
import { handleTrendAnalysis } from "./routes/trend-analysis";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    res.json({ message: "Hello from Express server v2!" });
  });

  app.get("/api/demo", handleDemo);

  // Music trend analysis API routes
  app.get("/api/music/search", handleMusicSearch);
  app.post("/api/music/trend-analysis", handleTrendAnalysis);

  return app;
}
