import { askTara } from "../src/agent/tara";
import logger from "../src/lib/logger";

async function testNoData() {
  const question = "Do I have rent transactions in 2030?";
  logger.info(`Question: ${question}`);
  try {
    const result = await askTara(question);
    logger.info(`Result answer: ${JSON.stringify(result)}`);
  } catch (error) {
    logger.error("FULL ERROR:");
    logger.error(error);
  }
}

testNoData();
