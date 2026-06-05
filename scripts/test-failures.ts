import { askTara } from "../src/agent/tara";
import logger from "../src/lib/logger";

async function test() {
  const test1 = await askTara("How much did I spend at Netflix in 2035?");
  logger.info(`Netflix test: ${JSON.stringify(test1.answer)}`);

  const test2 = await askTara("How much did I spend at SomeRandomMerchant?");
  logger.info(`SomeRandomMerchant test: ${JSON.stringify(test2.answer)}`);
}

test();