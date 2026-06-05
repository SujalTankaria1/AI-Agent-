
import "dotenv/config";
import express from "express";
import { z } from "zod";
import { askTara } from "../src/agent/tara";
import logger from "../src/lib/logger";
import http from "http";

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

const server = app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);

  // Test request now
  try {
    const postData = JSON.stringify({
      question: "Do I have rent transactions in 2030?"
    });

    const options = {
      hostname: "localhost",
      port: PORT,
      path: "/ask",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        logger.info("Test request response:");
        logger.info(data);
        // Close server after test
        server.close(() => {
          process.exit(0);
        });
      });
    });

    req.on("error", (error) => {
      logger.error(error);
      server.close(() => {
        process.exit(1);
      });
    });

    req.write(postData);
    req.end();
  } catch (error) {
    logger.error(error);
    server.close(() => {
      process.exit(1);
    });
  }
});
