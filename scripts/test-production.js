
require("dotenv").config();
const express = require("express");
const http = require("http");
const { z } = require("zod");
const { askTara } = require("../dist/agent/tara");
const logger = require("../dist/lib/logger").default;

const app = express();
const PORT = 0;

app.use(express.json());
const AskBody = z.object({ question: z.string() });
app.post("/ask", async (req, res) => {
  try {
    const body = AskBody.parse(req.body);
    logger.info("=== PROD Server received ask request ===");
    logger.info("Calling askTara with question: " + body.question);
    const result = await askTara(body.question);
    logger.info("askTara returned: " + JSON.stringify(result));
    res.json(result);
  } catch (e) {
    logger.error(e);
    res.status(400).json({ error: "Invalid request" });
  }
});

const server = app.listen(PORT, async () => {
  logger.info(`Prod server listening on port ${server.address().port}`);
  try {
    const postData = JSON.stringify({
      question: "Do I have rent transactions in 2030?"
    });
    const options = {
      hostname: "localhost",
      port: server.address().port,
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
        logger.info("Response data from prod server: ", data);
        server.close(() => process.exit(0));
      });
    });
    req.on("error", (error) => {
      logger.error("Error sending request:", error);
      server.close(() => process.exit(1));
    });
    req.write(postData);
    req.end();
  } catch (e) {
    logger.error("Error sending request: ", e);
    server.close(() => process.exit(1));
  }
});
