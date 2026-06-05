import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import prisma from "../src/lib/prisma";
import logger from "../src/lib/logger";
import { getCanonicalMerchant, normalizeMerchant } from "../src/lib/merchant-alias";

async function main() {
  const dataDir = process.env.DATA_DIR || "./data/data/sample_a";
  
  logger.info(`Starting ingestion from ${dataDir}`);

  const transactionsPath = path.join(dataDir, "transactions.json");
  const fundsPath = path.join(dataDir, "funds.json");
  const holdingsPath = path.join(dataDir, "holdings.json");

  const [transactionsRaw, fundsRaw, holdingsRaw] = await Promise.all([
    fs.readFile(transactionsPath, "utf-8"),
    fs.readFile(fundsPath, "utf-8"),
    fs.readFile(holdingsPath, "utf-8"),
  ]);

  const transactions = JSON.parse(transactionsRaw);
  const funds = JSON.parse(fundsRaw);
  const holdings = JSON.parse(holdingsRaw);

  await prisma.transaction.deleteMany();
  await prisma.merchantAlias.deleteMany();
  await prisma.fundNavHistory.deleteMany();
  await prisma.holding.deleteMany();
  await prisma.fund.deleteMany();

  for (const fund of funds) {
    await prisma.fund.create({
      data: {
        id: fund.id,
        name: fund.name,
        category: fund.category,
        navHistory: {
          create: fund.nav.map((nav: any) => ({
            date: new Date(nav.date),
            value: nav.value,
          })),
        },
      },
    });
  }

  for (const holding of holdings) {
    await prisma.holding.create({
      data: {
        fundId: holding.fund_id,
        fundName: holding.fund_name,
        units: holding.units,
        purchaseDate: new Date(holding.purchase_date),
        purchaseNav: holding.purchase_nav,
      },
    });
  }

  const merchantMap = new Map<string, string[]>();

  for (const txn of transactions) {
    const canonical = getCanonicalMerchant(txn.merchant);
    const normalized = normalizeMerchant(txn.merchant);

    if (!merchantMap.has(canonical)) {
      merchantMap.set(canonical, []);
    }
    const existingAliases = merchantMap.get(canonical)!;
    if (!existingAliases.includes(normalized)) {
      existingAliases.push(normalized);
    }
  }

  const canonicalToId = new Map<string, string>();
  for (const [canonical, aliases] of merchantMap) {
    const merchantAlias = await prisma.merchantAlias.create({
      data: {
        canonical,
        aliases,
      },
    });
    canonicalToId.set(canonical, merchantAlias.id);
  }

  for (const txn of transactions) {
    const canonical = getCanonicalMerchant(txn.merchant);
    const merchantAliasId = canonicalToId.get(canonical);

    await prisma.transaction.create({
      data: {
        id: txn.id,
        date: new Date(txn.date),
        merchant: txn.merchant,
        category: txn.category,
        amount: txn.amount,
        description: txn.memo || "",
        merchantAliasId,
      },
    });
  }

  logger.info("Ingestion complete!");
}

main()
  .catch((e) => {
    logger.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

  