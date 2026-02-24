import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const keys = Object.keys(prisma);
console.log('Prisma keys:', keys.filter(k => !k.startsWith('$') && !k.startsWith('_')));
process.exit(0);
