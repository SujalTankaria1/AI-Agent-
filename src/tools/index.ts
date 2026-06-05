import { z } from "zod";
import prisma from "../lib/prisma";
import { getCanonicalMerchant, normalizeMerchant } from "../lib/merchant-alias";
import {
  QueryTransactionsInput,
  AnalyzeSpendingInput,
  AnalyzeFundsInput,
  AnalyzeHoldingsInput,
  DetectRecurringTransactionsInput,
} from "./types";

export async function queryTransactions(input: z.infer<typeof QueryTransactionsInput>) {
  const where: any = {
    NOT: {
      category: "transfer",
    },
  };

  if (input.category) {
    where.category = input.category;
  }
  if (input.merchant) {
    where.merchant = {
      contains: input.merchant,
      mode: "insensitive",
    };
  }
  
  // Defensive date handling
  if (input.dateFrom || input.dateTo) {
    const dateFilter: any = {};
    if (input.dateFrom) {
      const fromDate = new Date(input.dateFrom);
      if (!isNaN(fromDate.getTime())) {
        dateFilter.gte = fromDate;
      }
    }
    if (input.dateTo) {
      const toDate = new Date(input.dateTo);
      if (!isNaN(toDate.getTime())) {
        dateFilter.lte = toDate;
      }
    }
    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return {
    transactions,
    count: transactions.length,
  };
}

export async function analyzeSpending(input: z.infer<typeof AnalyzeSpendingInput>) {
  const where: any = {
    NOT: {
      category: "transfer",
    },
  };

  if (input.category) {
    where.category = input.category;
  }
  if (input.merchant) {
    where.merchant = {
      contains: input.merchant,
      mode: "insensitive",
    };
  }
  
  // Defensive date handling
  if (input.dateFrom || input.dateTo) {
    const dateFilter: any = {};
    if (input.dateFrom) {
      const fromDate = new Date(input.dateFrom);
      if (!isNaN(fromDate.getTime())) {
        dateFilter.gte = fromDate;
      }
    }
    if (input.dateTo) {
      const toDate = new Date(input.dateTo);
      if (!isNaN(toDate.getTime())) {
        dateFilter.lte = toDate;
      }
    }
    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }
  }

  const transactions = await prisma.transaction.findMany({
    where,
  });

  let totalSpend = 0;
  let biggestExpense: { id: string; merchant: string; amount: number; date: Date } | null = null;
  const categoryTotals = new Map<string, number>();

  for (const txn of transactions) {
    const amount = Number(txn.amount);
    totalSpend += amount;

    if (!biggestExpense || amount > biggestExpense.amount) {
      biggestExpense = {
        id: txn.id,
        merchant: txn.merchant,
        amount: amount,
        date: txn.date,
      };
    }

    const current = categoryTotals.get(txn.category) || 0;
    categoryTotals.set(txn.category, current + amount);
  }

  return {
    totalSpend,
    biggestExpense,
    categoryTotals: Object.fromEntries(categoryTotals),
    transactionCount: transactions.length,
  };
}

export async function analyzeFunds(input: z.infer<typeof AnalyzeFundsInput>) {
  const funds = await prisma.fund.findMany({
    include: {
      navHistory: {
        orderBy: { date: "asc" },
      },
    },
  });

  const fundReturns = funds.map((fund) => {
    let startNav = null;
    let endNav = null;

    if (input.dateFrom && input.dateTo) {
      const start = fund.navHistory.find((n) => n.date >= new Date(input.dateFrom!));
      const end = [...fund.navHistory].reverse().find((n) => n.date <= new Date(input.dateTo!));
      startNav = start;
      endNav = end;
    } else {
      startNav = fund.navHistory[0];
      endNav = fund.navHistory[fund.navHistory.length - 1];
    }

    if (!startNav || !endNav) {
      return {
        fundId: fund.id,
        fundName: fund.name,
        returnPercent: null,
      };
    }

    const returnPercent = ((Number(endNav.value) - Number(startNav.value)) / Number(startNav.value)) * 100;

    return {
      fundId: fund.id,
      fundName: fund.name,
      category: fund.category,
      startNav: Number(startNav.value),
      endNav: Number(endNav.value),
      returnPercent: Number(returnPercent.toFixed(2)),
    };
  });

  fundReturns.sort((a, b) => (b.returnPercent || 0) - (a.returnPercent || 0));

  return {
    funds: fundReturns,
    bestPerformer: fundReturns[0],
  };
}

export async function analyzeHoldings(input: z.infer<typeof AnalyzeHoldingsInput>) {
  const holdings = await prisma.holding.findMany({
    include: {
      fund: {
        include: {
          navHistory: {
            orderBy: { date: "desc" },
          },
        },
      },
    },
  });

  let totalCurrentValue = 0;
  let totalCost = 0;

  const holdingsDetails = holdings.map((holding) => {
    const latestNav = holding.fund.navHistory[0];
    const cost = Number(holding.units) * Number(holding.purchaseNav);
    const currentValue = Number(holding.units) * Number(latestNav.value);
    const realizedReturn = ((currentValue - cost) / cost) * 100;

    totalCost += cost;
    totalCurrentValue += currentValue;

    return {
      holdingId: holding.id,
      fundId: holding.fundId,
      fundName: holding.fundName,
      units: Number(holding.units),
      purchaseDate: holding.purchaseDate,
      purchaseNav: Number(holding.purchaseNav),
      latestNav: Number(latestNav.value),
      cost,
      currentValue,
      realizedReturn: Number(realizedReturn.toFixed(2)),
    };
  });

  const totalProfit = totalCurrentValue - totalCost;
  const portfolioReturnPercent = ((totalCurrentValue - totalCost) / totalCost) * 100;

  return {
    holdings: holdingsDetails,
    totalCost,
    totalCurrentValue,
    totalProfit,
    portfolioReturnPercent: Number(portfolioReturnPercent.toFixed(2)),
  };
}

export async function detectRecurringTransactions(
  input: z.infer<typeof DetectRecurringTransactionsInput>
) {
  const transactions = await prisma.transaction.findMany({
    where: {
      NOT: { category: "transfer" },
    },
    orderBy: { date: "asc" },
  });

  const merchantGroups = new Map<string, typeof transactions>();

  for (const txn of transactions) {
    const key = txn.merchant;
    if (!merchantGroups.has(key)) {
      merchantGroups.set(key, []);
    }
    merchantGroups.get(key)!.push(txn);
  }

  const recurringCandidates: Array<{
    merchant: string;
    transactions: typeof transactions;
    confidence: number;
  }> = [];

  for (const [merchant, txns] of merchantGroups) {
    if (txns.length >= 3) {
      let intervalConsistency = 0;
      let amountConsistency = 0;

      const intervals = [];
      for (let i = 1; i < txns.length; i++) {
        const diff = txns[i].date.getTime() - txns[i - 1].date.getTime();
        intervals.push(diff);
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const intervalVariance =
        intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
      const intervalStdDev = Math.sqrt(intervalVariance);

      if (intervalStdDev < avgInterval * 0.5) {
        intervalConsistency = 0.5;
      }

      const amounts = txns.map((t) => Number(t.amount));
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const amountVariance =
        amounts.reduce((sum, val) => sum + Math.pow(val - avgAmount, 2), 0) / amounts.length;
      const amountStdDev = Math.sqrt(amountVariance);

      if (amountStdDev < avgAmount * 0.3) {
        amountConsistency = 0.5;
      }

      const confidence = intervalConsistency + amountConsistency;

      if (confidence >= 0.5) {
        recurringCandidates.push({
          merchant,
          transactions: txns,
          confidence,
        });
      }
    }
  }

  recurringCandidates.sort((a, b) => b.confidence - a.confidence);

  return {
    recurringTransactions: recurringCandidates,
  };
}
