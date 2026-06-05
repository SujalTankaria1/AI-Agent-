import { analyzeSpending } from "../src/tools";
import logger from "../src/lib/logger";

async function debug() {
  try {
    const result = await analyzeSpending({
      category: "rent",
      dateFrom: "2030-01-01",
      dateTo: "2030-12-31"
    });
    logger.info("Result:");
    logger.info(JSON.stringify(result, null, 2));
  } catch (e) {
    logger.error("ERROR:");
    logger.error(e);
  }
}

debug();
