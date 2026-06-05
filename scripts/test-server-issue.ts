
import "dotenv/config";
import { askTara } from "../src/agent/tara";
import logger from "../src/lib/logger";
import express from "express";
import http from "http";
import { z } from "zod";

async function testDirect() {
  logger.info("=== DIRECT CALL ===");
  const result = await askTara("Do I have rent transactions in 2030?");
  logger.info(JSON.stringify(result, null, 2));
}

async function testServer() {
  logger.info("=== SERVER CALL ===");
  const app = express();
  const PORT = 0;
  app.use(express.json());
  const AskBody = z.object({ question: z.string() });

  app.post("/ask", async (req, res) => {
    try {
      const body = AskBody.parse(req.body);
      logger.info("=== SERVER received ask request ===");
      logger.info("Calling askTara with question: " + body.question);
      const result = await askTara(body.question);
      logger.info("askTara returned: " + JSON.stringify(result));
      res.json(result);
    } catch (e) {
      logger.error(e);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  return new Promise((resolve) => {
    const server = app.listen(PORT, async () => {
      logger.info(`Server listening on port ${(server.address() as any).port}`);
      try {
        const postData = JSON.stringify({ question: "Do I have rent transactions in 2030?" });
        const options = {
          hostname: "localhost",
          port: (server.address() as any).port,
          path: "/ask",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
          },
        };
        const req = http.request(options, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            logger.info("Response data:", data);
            server.close(() => resolve(data));
          });
        });
        req.on("error", (error) => {
          logger.error("Request error:", error);
          server.close(() => resolve(null));
        });
        req.write(postData);
        req.end();
      } catch (e) {
        logger.error("Error sending request:", e);
        server.close(() => resolve(null));
      }
    });
  });
}

async function main() {
  await testDirect();
  await testServer();
}

main().catch((e) => logger.error(e));
