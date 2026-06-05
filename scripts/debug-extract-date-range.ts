import logger from "../src/lib/logger";

function extractDateRange(question: string): { dateFrom?: string; dateTo?: string } {
  const monthYearMatch = question.match(/(\w+)\s+(\d{4})/);
  if (monthYearMatch) {
    const [, month, year] = monthYearMatch;
    const monthIndex = new Date(`${month} 1, 2000`).getMonth();
    const dateFrom = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const daysInMonth = new Date(Number(year), monthIndex + 1, 0).getDate();
    const dateTo = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${daysInMonth}`;
    return { dateFrom, dateTo };
  }
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

function debug() {
  const questions = [
    "Do I have rent transactions in 2030?",
    "How much did I spend on food in January 2025?"
  ];

  for (const q of questions) {
    const result = extractDateRange(q);
    logger.info(`Question: ${q}`);
    logger.info(`Result: ${JSON.stringify(result)}`);
    logger.info(`dateFrom Date: ${new Date(result.dateFrom || "")}`);
    logger.info(`dateTo Date: ${new Date(result.dateTo || "")}`);
  }
}

debug();
