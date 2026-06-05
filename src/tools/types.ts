import { z } from "zod";

export const QueryTransactionsInput = z.object({
  category: z.string().optional(),
  merchant: z.string().optional(),
  dateFrom: z.string().optional(), 
  dateTo: z.string().optional(), 
  groupBy: z.enum(["category", "merchant", "month"]).optional(),
});

export const AnalyzeSpendingInput = z.object({
  category: z.string().optional(),
  merchant: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const AnalyzeFundsInput = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  fundIds: z.array(z.string()).optional(),
});

export const AnalyzeHoldingsInput = z.object({});

export const DetectRecurringTransactionsInput = z.object({});
