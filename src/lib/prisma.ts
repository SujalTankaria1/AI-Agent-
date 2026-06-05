import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
  ],
});

const capturedQueries: string[] = [];

prisma.$on('query', (e) => {
  capturedQueries.push(e.query);
});

export function getCapturedQueries() {
  return [...capturedQueries];
}

export function clearCapturedQueries() {
  capturedQueries.length = 0;
}

export default prisma;
