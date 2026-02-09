import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

type ErrorBody = {
  statusCode: number;
  message: string | string[];
  error?: string;
  code?: string;
  path?: string;
  timestamp: string;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    const mapped = this.map(exception);

    const statusCode = mapped.getStatus();
    const response = mapped.getResponse();

    // HttpException response’idan message/error ni to‘g‘ri chiqaramiz
    const { message, error } = this.extractHttpResponse(response, mapped);

    const body: ErrorBody = {
      statusCode,
      message,
      error,
      code: (response as any)?.code,
      path: req?.originalUrl || req?.url,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(body);
  }

  private extractHttpResponse(
    response: string | object,
    ex: HttpException,
  ): { message: string | string[]; error?: string } {
    if (typeof response === 'string') {
      return { message: response, error: ex.name };
    }
    const r = response as any;
    const msg = r?.message ?? ex.message ?? 'Error';
    const err = r?.error ?? ex.name;
    return { message: msg, error: err };
  }

  private map(exception: unknown): HttpException {
    if (exception instanceof HttpException) return exception;

    // Prisma: known request errors (FK, unique, not found, etc.)
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return new ConflictException({
            message: 'Unique constraint violation',
            code: 'UNIQUE_VIOLATION',
          });
        case 'P2003':
          return new BadRequestException({
            message: 'Invalid reference (foreign key)',
            code: 'FK_VIOLATION',
          });
        case 'P2025':
          return new NotFoundException({
            message: 'Record not found',
            code: 'RECORD_NOT_FOUND',
          });
        case 'P2000':
          return new BadRequestException({
            message: 'Invalid value',
            code: 'INVALID_VALUE',
          });
        default:
          return new InternalServerErrorException({
            message: 'Database error',
            code: 'DB_ERROR',
          });
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return new BadRequestException({
        message: 'Invalid request data',
        code: 'DB_VALIDATION',
      });
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return new ServiceUnavailableException({
        message: 'Database unavailable',
        code: 'DB_INIT_ERROR',
      });
    }

    if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      return new InternalServerErrorException({
        message: 'Database unknown error',
        code: 'DB_UNKNOWN',
      });
    }

    // fallback
    return new InternalServerErrorException({
      message: 'Internal server error',
      code: 'INTERNAL',
    });
  }
}
