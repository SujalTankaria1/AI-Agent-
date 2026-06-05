import { askTara } from "../src/agent/tara";
import logger from "../src/lib/logger";

async function testAll() {
  const questions = [
    "Do I have rent transactions in 2030?",
    "How much did I spend at Netflix in 2035?",
    "How much did I spend at SomeRandomMerchant?",
    "How much did I spend on electronics?",
    "How much did I spend on food in January 2024?",
  ];

  for (let q of questions) {
    const res = await askTara(q);
    logger.info(`Q: ${q}`);
    logger.info(`A: ${res.answer}`);
  }
}

testAll();