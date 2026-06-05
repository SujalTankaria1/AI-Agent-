# Design Document for Tara - Finance Research Agent

## Architecture Overview

Tara follows a modular, layered architecture designed for scalability, maintainability, and correctness.

### Directory Structure

```
.
├── prisma/              # Prisma schema and migrations
├── src/
│   ├── agent/           # Agent orchestration and persona
│   ├── lib/             # Shared utilities (Prisma, logger, merchant normalization)
│   ├── tools/           # Agent tools (queryTransactions, analyzeSpending, etc.)
│   └── index.ts         # Express API entry point
├── scripts/             # Ingestion and evaluation scripts
├── tests/               # Test files
└── data/                # Input datasets
```

## Database Design

### Tables

1.  **Transaction**: Stores individual transactions
    - Indexes on `date`, `category`, `merchant`, `merchantAliasId` for fast filtering
2.  **MerchantAlias**: Normalizes merchant names to canonical forms
    - Stores aliases for flexible matching
3.  **Fund**: Stores mutual fund metadata
4.  **FundNavHistory**: Stores NAV history per fund (unique constraint on fundId + date)
5.  **Holding**: Stores user's holdings in funds
6.  **AgentLog**: Observability logs (requestId, question, toolsUsed, latency, etc.)
7.  **EvalResult**: Stores evaluation test results
8.  **AsyncJob**: For future async processing

### Key Design Decisions

- **Transfer filtering**: Exclude transactions with category "transfer" from spending calculations
- **Refund handling**: Negative amounts are properly summed into net spend
- **Merchant normalization**: Uses tokenization and canonical forms to group similar merchants
- **Index strategy**: Optimized for the most common query patterns (date ranges, category/merchant filters)

## Tools Design

### Tool List

1.  `queryTransactions`: Flexible transaction querying with filters and grouping
2.  `analyzeSpending`: Spending totals, averages, category breakdowns, biggest expense
3.  `analyzeFunds`: Period returns, rankings, NAV calculations
4.  `analyzeHoldings`: Realized return, current value, portfolio metrics
5.  `detectRecurringTransactions`: Subscription/recurring payment detection

### Tool Design Principles

- Minimal, powerful tools instead of many tiny ones
- Zod schemas for strict input validation
- Deterministic calculations
- All data from PostgreSQL queries, no hardcoding

## Merchant Normalization

### Approach

1.  **Normalization**: Lowercase, remove special chars and common suffixes/prefixes
2.  **Canonical form**: Use first significant word as canonical name
3.  **Alias grouping**: Group similar merchants under the same canonical form

## Recurring Transaction Detection

### Algorithm

- Groups by merchant
- Checks for consistent intervals between transactions
- Checks for consistent amounts
- Returns a confidence score (0-1)

## Fund Calculations

### Fund Period Return
```
Return % = ((NAV_end - NAV_start) / NAV_start) * 100
```

### Holding Realized Return
```
Investment Cost = units × purchase_nav
Current Value = units × latest_nav
Realized Return % = ((Current Value - Cost) / Cost) × 100
```

### Portfolio Value
```
Total Current Value = Sum of all holding current values
Total Profit = Total Current Value - Total Cost
Portfolio Return % = (Total Profit / Total Cost) × 100
```

## Observability & Logging

- Logs request ID, question, tools used, SQL queries, latency, success/failure
- Stored in `AgentLog` table for auditing and debugging
- Uses Winston for structured logging

## Evaluation Suite

Tests:
1.  Spending analysis
2.  Holdings analysis
3.  Funds analysis
4.  Recurring transaction detection

## Deployment

Uses Neon PostgreSQL for database, and either Render or Railway for hosting the Node service.
