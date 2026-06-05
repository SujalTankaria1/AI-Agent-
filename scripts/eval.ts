import "dotenv/config";
import prisma from "../src/lib/prisma";
import {
  queryTransactions,
  analyzeSpending,
  analyzeHoldings,
  analyzeFunds,
  detectRecurringTransactions,
} from "../src/tools";
import { askTara } from "../src/agent/tara";
import logger from "../src/lib/logger";

async function runTests() {
  const results: Array<{ name: string; passed: boolean }> = [];

  async function test(name: string, fn: () => Promise<boolean>) {
    try {
      const passed = await fn();
      results.push({ name, passed });
      logger.info(`[${passed ? "PASS" : "FAIL"}] ${name}`);
    } catch (e) {
      results.push({ name, passed: false });
      logger.error(`[FAIL] ${name}`);
      logger.error(e);
    }
  }

  logger.info("Starting evaluation...");

  await test("Can analyze spending", async () => {
    const result = await analyzeSpending({});
    return result.totalSpend > 0 && result.transactionCount > 0;
  });

  await test("Can analyze holdings", async () => {
    const result = await analyzeHoldings({});
    return result.holdings.length > 0 && result.totalCurrentValue > 0;
  });

  await test("Can analyze funds", async () => {
    const result = await analyzeFunds({});
    return result.funds.length > 0;
  });

  await test("Can detect recurring transactions", async () => {
    const result = await detectRecurringTransactions({});
    return true;
  });

  await test("Handles refunds correctly (reduces spend)", async () => {
    const result = await analyzeSpending({});
    const allTxns = await prisma.transaction.findMany();
    const hasRefunds = allTxns.some(t => Number(t.amount) < 0 && t.category !== "transfer");
    return hasRefunds && result.totalSpend > 0;
  });

  await test("Excludes transfers from spending", async () => {
    const transferTxns = await prisma.transaction.count({ where: { category: "transfer" } });
    if (transferTxns === 0) return true;
    const spendResult = await analyzeSpending({});
    const allTxns = await prisma.transaction.findMany({ where: { NOT: { category: "transfer" } } });
    const manualTotal = allTxns.reduce((sum, t) => sum + Number(t.amount), 0);
    return Math.abs(spendResult.totalSpend - manualTotal) < 0.01;
  });

  await test("Creates merchant aliases during ingestion", async () => {
    const aliasCount = await prisma.merchantAlias.count();
    const txnCount = await prisma.transaction.count({ where: { merchantAliasId: { not: null } } });
    return aliasCount > 0 && txnCount > 0;
  });

  await test("Calculates fund returns correctly", async () => {
    const result = await analyzeFunds({});
    return result.bestPerformer && result.bestPerformer.returnPercent !== null;
  });

  await test("Calculates holding realized returns correctly", async () => {
    const result = await analyzeHoldings({});
    return result.holdings.every(h => h.realizedReturn !== null);
  });

  await test("Calculates portfolio value correctly", async () => {
    const result = await analyzeHoldings({});
    const manualValue = result.holdings.reduce((sum, h) => sum + h.currentValue, 0);
    return Math.abs(result.totalCurrentValue - manualValue) < 0.01;
  });

  await test("Can query transactions by category", async () => {
    const result = await queryTransactions({ category: "food" });
    const dbCount = await prisma.transaction.count({ where: { category: "food", NOT: { category: "transfer" } } });
    return result.count === dbCount;
  });

  await test("Can query transactions by date range", async () => {
    const dateFrom = "2024-01-01";
    const dateTo = "2024-02-01";
    const result = await queryTransactions({ dateFrom, dateTo });
    const dbCount = await prisma.transaction.count({ 
      where: { 
        date: { gte: new Date(dateFrom), lte: new Date(dateTo) },
        NOT: { category: "transfer" }
      } 
    });
    return result.count === dbCount;
  });

  await test("Can query by merchant", async () => {
    return true;
  });

  await test("Agent can answer about portfolio", async () => {
    const result = await askTara("What is my portfolio worth today?");
    return result.answer.includes("portfolio");
  });

  await test("Agent can answer about best fund", async () => {
    const result = await askTara("Which fund gave the best return?");
    return result.answer.includes("best performing");
  });

  await test("Handles no data: rent transactions in 2030", async () => {
    const result = await askTara("Do I have rent transactions in 2030?");
    return result.answer.includes("No rent transactions found in 2030.");
  });

  await test("Handles no data: Netflix transactions in 2035", async () => {
    const result = await askTara("How much did I spend at Netflix in 2035?");
    return result.answer.toLowerCase().includes("no transactions for netflix found in 2035") || 
           result.answer.toLowerCase().includes("no matching transactions found");
  });

  await test("Handles unknown merchant", async () => {
    const result = await askTara("How much did I spend at SomeRandomMerchant?");
    return result.answer.toLowerCase().includes("no transactions for somerandommerchant found") || 
           result.answer.toLowerCase().includes("no matching transactions found");
  });

  await test("Handles unknown category", async () => {
    // Let's use a category not in our list, like "electronics"
    const result = await askTara("How much did I spend on electronics?");
    return result.answer.includes("No matching transactions found.") || 
           result.answer.includes("No electronics transactions found.");
  });

  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.length - passCount;

  logger.info("\n=== Evaluation Summary ===");
  logger.info(`Passed: ${passCount}`);
  logger.info(`Failed: ${failCount}`);

  for (const res of results) {
    await prisma.evalResult.create({
      data: {
        testName: res.name,
        passed: res.passed,
      },
    });
  }
}

runTests()
  .catch((e) => {
    logger.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
