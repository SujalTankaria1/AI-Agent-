import {
  queryTransactions,
  analyzeSpending,
  analyzeFunds,
  analyzeHoldings,
  detectRecurringTransactions,
} from "../tools";
import prisma, { getCapturedQueries, clearCapturedQueries } from "../lib/prisma";
import logger from "../lib/logger";
import { randomUUID } from "crypto";

function extractDateRange(question: string): { dateFrom?: string; dateTo?: string } {
  // List of valid month names to match
  const validMonths = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
    "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec"
  ];

  // Only match month names, not random words like "in"
  const monthYearMatch = question.match(/(\w+)\s+(\d{4})/);
  let monthYearMatched = false;
  
  if (monthYearMatch) {
    const [, month, year] = monthYearMatch;
    if (validMonths.includes(month.toLowerCase())) {
      const monthIndex = new Date(`${month} 1, 2000`).getMonth();
      if (!isNaN(monthIndex)) {
        const dateFrom = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
        const daysInMonth = new Date(Number(year), monthIndex + 1, 0).getDate();
        const dateTo = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${daysInMonth}`;
        monthYearMatched = true;
        return { dateFrom, dateTo };
      }
    }
  }
  
  // If no valid month-year, check for just year
  const yearOnlyMatch = question.match(/(\d{4})/);
  if (yearOnlyMatch) {
    const year = yearOnlyMatch[1];
    return {
      dateFrom: `${year}-01-01`,
      dateTo: `${year}-12-31`
    };
  }
  return {};
}

function extractCategory(question: string): string | undefined {
  const predefinedCategories = ["food", "travel", "health", "rent", "groceries", "entertainment", "shopping", "transport", "subscription", "utilities"];
  for (const cat of predefinedCategories) {
    if (question.toLowerCase().includes(cat)) return cat;
  }
  // Fallback: extract any word after "on" or "for"
  const lowerQuestion = question.toLowerCase();
  const onMatch = lowerQuestion.match(/on\s+([a-z]+)/i);
  if (onMatch) {
    const candidate = onMatch[1].toLowerCase();
    // Don't extract common words
    if (!["my", "the", "this", "that", "these", "those", "our", "your", "a", "an"].includes(candidate)) {
      return candidate;
    }
  }
  const forMatch = lowerQuestion.match(/for\s+([a-z]+)/i);
  if (forMatch) {
    const candidate = forMatch[1].toLowerCase();
    if (!["my", "the", "this", "that", "these", "those", "our", "your", "a", "an"].includes(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function extractMerchant(question: string): string | undefined {
  // Only extract merchant if question mentions "at <merchant>"
  const lowerQuestion = question.toLowerCase();
  if (!lowerQuestion.includes(" at ")) return undefined;
  
  // Don't extract merchant if we have a category keyword
  const categories = ["food", "travel", "health", "rent", "groceries", "entertainment", "shopping", "transport", "subscription", "utilities"];
  const hasCategory = categories.some(cat => lowerQuestion.includes(cat));
  if (hasCategory) return undefined;

  // Match merchant, stopping before any prepositions like "in"
  const match = lowerQuestion.match(/at\s+([a-z0-9\s]+?)(?:\s+(?:in|on|at|for|of|to|from|by)\b|$|\?|,|\.)/i);
  if (match) {
    const candidate = match[1].trim();
    if (candidate.length > 2 && !["my", "the", "this", "that", "these", "those", "our", "your"].includes(candidate.toLowerCase())) {
      return candidate;
    }
  }
  // Fallback to simpler match if first one didn't find anything
  const fallbackMatch = lowerQuestion.match(/at\s+([a-z0-9\s]+?)(?:\?|$|,|\.)/i);
  if (fallbackMatch) {
    const candidate = fallbackMatch[1].trim();
    if (candidate.length > 2 && !["my", "the", "this", "that", "these", "those", "our", "your"].includes(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return undefined;
}

const TARA_PROMPT = `You are Tara, a friendly and helpful financial research assistant. 
Your responses must be clear, concise, and easy to understand. 
Never make up numbers or data - all numbers must come directly from tool outputs. 
Always explain your calculations in a straightforward way.
You have access to the following tools:
1. queryTransactions
2. analyzeSpending
3. analyzeFunds
4. analyzeHoldings
5. detectRecurringTransactions
When answering questions, first determine which tool to use, execute it, and then use the results to craft your answer.`;

export async function askTara(question: string) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const toolsUsed: string[] = [];
  let success = true;
  let answer = "";
  clearCapturedQueries();
  logger.info("=== askTara start ===");

  try {
    logger.info("Step 1: initialize variables");
    let toolResult = null;
    const questionLower = question.toLowerCase();
    const dateRange = extractDateRange(question);
    const category = extractCategory(question);
    const merchant = extractMerchant(question);
    logger.info(`question: ${question}`);
    logger.info(`category extracted: ${category}`);
    logger.info(`merchant extracted: ${merchant}`);

    if (
      questionLower.includes("portfolio") ||
      questionLower.includes("holding") ||
      questionLower.includes("current value") ||
      questionLower.includes("realized return")
    ) {
      logger.info("Step 2: analyzeHoldings");
      toolsUsed.push("analyzeHoldings");
      toolResult = await analyzeHoldings({});
    } else if (
      questionLower.includes("fund") ||
      questionLower.includes("return") ||
      questionLower.includes("best") ||
      questionLower.includes("nav")
    ) {
      logger.info("Step 2: analyzeFunds");
      toolsUsed.push("analyzeFunds");
      toolResult = await analyzeFunds({ dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo });
    } else if (
      questionLower.includes("recurring") ||
      questionLower.includes("subscription") ||
      questionLower.includes("emi") ||
      questionLower.includes("sip")
    ) {
      logger.info("Step 2: detectRecurringTransactions");
      toolsUsed.push("detectRecurringTransactions");
      toolResult = await detectRecurringTransactions({});
    } else if (
      questionLower.includes("compare")
    ) {
      logger.info("Step 2: analyzeSpending (compare)");
      toolsUsed.push("analyzeSpending");
      toolResult = await analyzeSpending({});
    } else if (merchant) {
      logger.info("Step 2: analyzeSpending (merchant)");
      toolsUsed.push("analyzeSpending");
      toolResult = await analyzeSpending({ merchant, category, dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo });
    } else {
      logger.info("Step 2: analyzeSpending (default)");
      toolsUsed.push("analyzeSpending");
      toolResult = await analyzeSpending({ category, dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo });
    }

    logger.info("Step 3: formatAnswer");
    answer = formatAnswer(question, toolResult, toolsUsed, { category, merchant });
  } catch (e) {
    success = false;
    logger.error("=== askTara ERROR ===");
    logger.error("FULL ERROR DETAILS:", e);
    if (e instanceof Error) {
      logger.error("ERROR MESSAGE:", e.message);
      logger.error("ERROR STACK:", e.stack);
    }
    answer = "I'm sorry, I encountered an error while processing your question.";
  } finally {
    logger.info("Step 4: finally block");
    const sqlQueries = getCapturedQueries();
    const latency = Date.now() - startTime;
    try {
      logger.info("Step 4a: write AgentLog");
      await prisma.agentLog.create({
        data: {
          requestId,
          question,
          toolsUsed,
          sqlQueries,
          latency,
          success,
        },
      });
      logger.info("Step 4a: AgentLog written");
    } catch (logError) {
      logger.error("Failed to write AgentLog:", logError);
      if (logError instanceof Error) {
        logger.error(logError.stack);
      }
    }
  }

  logger.info("=== askTara end ===");
  return { requestId, answer };
}

function formatAnswer(question: string, toolResult: any, toolsUsed: string[], { category, merchant }: { category?: string; merchant?: string }) {
  let answer = "";
  const questionLower = question.toLowerCase();

  // Handle "No data found" scenarios
  if (toolsUsed.includes("analyzeHoldings") && !toolResult.holdings?.length) {
    return "No data found.";
  }
  if (toolsUsed.includes("analyzeFunds") && !toolResult.funds?.length) {
    return "No data found.";
  }
  if ((toolsUsed.includes("analyzeSpending") || toolsUsed.includes("queryTransactions")) && toolResult.transactionCount === 0) {
    // Create a specific no-data message
    if (category) {
      const yearMatch = question.match(/(\d{4})/);
      if (yearMatch) {
        const year = yearMatch[1];
        return `No ${category} transactions found in ${year}.`;
      }
      return `No ${category} transactions found.`;
    } else if (merchant) {
      const yearMatch = question.match(/(\d{4})/);
      if (yearMatch) {
        const year = yearMatch[1];
        return `No transactions for ${merchant} found in ${year}.`;
      }
      return `No transactions for ${merchant} found.`;
    } else {
      return "No matching transactions found.";
    }
  }

  if (toolsUsed.includes("analyzeHoldings")) {
    if (questionLower.includes("realized return") && !questionLower.includes("portfolio")) {
      // Per-holding returns
      answer = "Your holding realized returns:\n";
      toolResult.holdings.forEach((h: any) => {
        answer += `- ${h.fundName}: ${h.realizedReturn.toFixed(2)}% (cost: ₹${h.cost.toFixed(2)}, current value: ₹${h.currentValue.toFixed(2)})\n`;
      });
    } else {
      answer = `Your portfolio has a total current value of ₹${toolResult.totalCurrentValue.toFixed(
        2
      )}. The total cost was ₹${toolResult.totalCost.toFixed(2)}, resulting in a profit of ₹${toolResult.totalProfit.toFixed(
        2
      )} (${toolResult.portfolioReturnPercent}% return).`;
    }
  } else if (toolsUsed.includes("analyzeFunds")) {
    if (questionLower.includes("rank")) {
      answer = "Fund returns ranked:\n";
      toolResult.funds.forEach((f: any, i: number) => {
        answer += `${i + 1}. ${f.fundName}: ${f.returnPercent ? `${f.returnPercent.toFixed(2)}%` : "N/A"}\n`;
      });
    } else {
      answer = `The best performing fund is ${toolResult.bestPerformer.fundName} with a return of ${toolResult.bestPerformer.returnPercent}%.`;
    }
  } else if (toolsUsed.includes("detectRecurringTransactions")) {
    const candidates = toolResult.recurringTransactions;
    if (candidates.length > 0) {
      answer = `I found ${candidates.length} potential recurring transactions:\n`;
      candidates.slice(0, 5).forEach((c: any) => {
        answer += `- ${c.merchant} (confidence: ${(c.confidence * 100).toFixed(0)}%)\n`;
      });
    } else {
      answer = "I didn't find any clear recurring transactions in your data.";
    }
  } else {
    if (questionLower.includes("compare")) {
      // Compare two categories
      const categoryTotals = toolResult.categoryTotals;
      answer = "Category comparison:\n";
      for (const [cat, total] of Object.entries(categoryTotals)) {
        answer += `- ${cat}: ₹${(total as number).toFixed(2)}\n`;
      }
    } else if (questionLower.includes("how much") && merchant) {
      answer = `You spent ₹${toolResult.totalSpend.toFixed(2)} at ${merchant}${
        toolResult.transactionCount > 0 ? ` across ${toolResult.transactionCount} transactions` : ""
      }.`;
    } else if (questionLower.includes("how much") && category) {
      answer = `You spent ₹${toolResult.totalSpend.toFixed(2)} on ${category}${
        toolResult.transactionCount > 0 ? ` across ${toolResult.transactionCount} transactions` : ""
      }.`;
    } else {
      let baseAnswer = `You spent a total of ₹${toolResult.totalSpend.toFixed(2)} across ${toolResult.transactionCount} transactions.`;
      if (toolResult.biggestExpense) {
        baseAnswer += ` Your biggest expense was at ${toolResult.biggestExpense.merchant} for ₹${toolResult.biggestExpense.amount.toFixed(2)}.`;
      }
      answer = baseAnswer;
    }
  }

  return answer;
}
