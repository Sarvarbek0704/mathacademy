import { HttpException, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function rethrowServiceError(e: unknown): never {
  // HttpException’ni buzmaymiz
  if (e instanceof HttpException) throw e;

  // Prisma xatolarini AllExceptionsFilter map qiladi
  if (
    e instanceof Prisma.PrismaClientKnownRequestError ||
    e instanceof Prisma.PrismaClientValidationError
  ) {
    throw e;
  }

  throw new InternalServerErrorException('INTERNAL');
}
