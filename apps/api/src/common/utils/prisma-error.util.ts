import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function rethrowPrismaAsHttp(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') throw new ConflictException('DUPLICATE');
    if (e.code === 'P2003') throw new BadRequestException('INVALID_REFERENCE');
    if (e.code === 'P2025') throw new NotFoundException('NOT_FOUND');
    throw new InternalServerErrorException('DB_ERROR');
  }

  if (e instanceof Prisma.PrismaClientValidationError) {
    throw new BadRequestException('INVALID_DATA');
  }

  throw new InternalServerErrorException('INTERNAL');
}
