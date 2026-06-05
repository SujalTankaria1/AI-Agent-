# Tara - Finance Research Agent

## Overview

Tara is a production-grade AI finance research agent that answers questions about your transactions, mutual funds, and portfolio.

## Features

- **Transaction Analysis**: Spending totals, biggest expenses, category breakdowns
- **Merchant Normalization**: Handles merchant name variations
- **Recurring Transaction Detection**: Finds subscriptions/EMIs
- **Fund Analysis**: Fund returns, best performers
- **Portfolio Tracking**: Current value, realized returns
- **Observability**: Logs all queries, tool usage, and latency

## Tech Stack

- **Backend**: Node.js + Express 5 + TypeScript
- **ORM**: Prisma 5
- **DB**: PostgreSQL 16
- **Validation**: Zod
- **Logging**: Winston

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 16+ (local or Neon)

### Installation

```bash
npm install
```

### Configure Database

Set your `DATABASE_URL` in `.env`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/tara?schema=public"
```


### Run Migrations

```bash
npx prisma migrate dev --name init
```

### Ingest Data

```bash
DATA_DIR=./data/data/sample_a npm run ingest
```

### Start the Server

```bash
npm run dev
```

## API

### POST /ask

Ask Tara a question!

Request body:
```json
{
  "question": "What is my portfolio worth today?"
}
```

Response:
```json
{
  "requestId": "uuid",
  "answer": "Your portfolio has a total current value of ₹123456.78..."
}
```

## Evaluation

To run the evaluation suite:
```bash
npm run eval
```
Output/Screenshot:<img src="Screenshots/Eval.png" width="800">

## Observability evidence 

Screenshots:<img src="Screenshots/Observability.png" width="800">

## Prisma Studio

Screenshots:<img src="Screenshots/Prisma_Studio.png" width="800">

## Deployment

### Railway

1. Connect your GitHub repo
2. Add a PostgreSQL service (or use Neon)
3. Set `DATABASE_URL` environment variable
4. Deploy

### Render

1. Connect your GitHub repo
2. Create a new Web Service
3. Add a PostgreSQL database (or use Neon)
4. Set environment variables
5. Deploy with build command `npm run build` and start command `npm start`


## My Deployment 

### Railway

# Live Deployment Link
https://ai-agent-production-76b9.up.railway.app

# Screenshot

<img src="Screenshots/Deployment.png" width="800">