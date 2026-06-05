import "dotenv/config";
import express from "express";
import { z } from "zod";
import { askTara } from "./agent/tara";
import logger from "./lib/logger";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const AskBody = z.object({
  question: z.string(),
});

app.post("/ask", async (req, res) => {
  try {
    const body = AskBody.parse(req.body);
    const result = await askTara(body.question);
    res.json(result);
  } catch (e) {
    logger.error(e);
    res.status(400).json({ error: "Invalid request" });
  }
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
