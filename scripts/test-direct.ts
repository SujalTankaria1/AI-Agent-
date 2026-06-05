
import { askTara } from "../src/agent/tara";
import logger from "../src/lib/logger";

async function main() {
  try {
    const result = await askTara("Do I have rent transactions in 2030?");
    logger.info("Success!");
    logger.info(JSON.stringify(result, null, 2));
  } catch (error) {
    logger.error("Error:");
    logger.error(error);
    if (error instanceof Error) {
      logger.error(error.stack);
    }
  }
}

main();
