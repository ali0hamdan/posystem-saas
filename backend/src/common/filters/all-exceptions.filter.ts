import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { Request, Response } from 'express';
import { captureApiException } from '../../instrumentation/sentry.instrumentation';

type ErrorBody = {
  statusCode: number;
  message: string | string[] | Record<string, unknown>;
  error: string;
  code?: string;
  timestamp: string;
  path: string;
  requestId?: string;
};

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max)}…`;
}

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProd = this.config.get<string>('app.nodeEnv') === 'production';
    const requestId = request.id ?? (request.headers['x-request-id'] as string | undefined) ?? undefined;
    const userId = request.user?.id ?? null;
    const route = request.route?.path ?? request.originalUrl ?? request.url ?? '';
    const method = request.method;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: ErrorBody['message'] = 'Internal server error';
    let errorName = 'Internal Server Error';
    let code: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, unknown>;
        message =
          (body.message as ErrorBody['message']) ?? exception.message ?? message;
        errorName = (typeof body.error === 'string' && body.error) || errorName;
        if (typeof body.code === 'string' && body.code.trim()) {
          code = body.code.trim();
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = this.mapPrismaStatus(exception.code);
      message = isProd ? this.mapPrismaMessageProd(exception.code) : exception.message;
      errorName = 'Database Error';
      code = exception.code;
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = isProd ? 'Invalid query or payload' : exception.message;
      errorName = 'Validation Error';
      code = 'PRISMA_VALIDATION';
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2010'
    ) {
      status = HttpStatus.BAD_REQUEST;
      const path = request.originalUrl ?? request.url ?? '';
      const reportLike = path.includes('/reports') || path.includes('/products');
      code = 'REPORT_QUERY_FAILED';
      errorName = 'Query Error';
      if (isProd || !reportLike) {
        message = 'The request could not be completed.';
      } else {
        message = `Report query failed (${method} ${path}): ${exception.message}`;
      }
      this.logger.error(
        {
          context: 'report.query',
          requestId: requestId ?? null,
          route: path,
          method,
          prismaCode: exception.code,
          ...(isProd ? {} : { detail: exception.message }),
        },
        'Raw SQL query failed',
      );
    } else if (exception instanceof Error) {
      message = isProd ? 'Internal server error' : exception.message;
    }

    const errMessageForLog =
      typeof message === 'string'
        ? message
        : Array.isArray(message)
          ? message.join('; ')
          : 'See error payload';

    const logPayload: Record<string, unknown> = {
      context: 'http.exception',
      requestId: requestId ?? null,
      userId,
      route,
      method,
      statusCode: status,
      errorMessage: truncate(String(errMessageForLog), 2000),
    };

    if (!isProd && exception instanceof Error && exception.stack) {
      logPayload.stack = exception.stack;
    }

    if (status >= 500) {
      this.logger.error(logPayload, 'HTTP error');
    } else {
      this.logger.warn(logPayload, 'HTTP client error');
    }

    if (status >= 500) {
      captureApiException(exception instanceof Error ? exception : new Error(String(message)), {
        requestId: requestId ?? 'unknown',
        route,
        method,
        statusCode: status,
        userId: userId ?? 'anonymous',
      });
    }

    const body: ErrorBody = {
      statusCode: status,
      message,
      error: errorName,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url ?? '',
    };
    if (code) {
      body.code = code;
    }
    if (requestId) {
      body.requestId = requestId;
    }

    response.status(status).json(body);
  }

  private mapPrismaStatus(code: string): number {
    switch (code) {
      case 'P2002':
        return HttpStatus.CONFLICT;
      case 'P2025':
        return HttpStatus.NOT_FOUND;
      case 'P2003':
        return HttpStatus.BAD_REQUEST;
      default:
        return HttpStatus.BAD_REQUEST;
    }
  }

  private mapPrismaMessageProd(code: string): string {
    switch (code) {
      case 'P2002':
        return 'A record with this value already exists.';
      case 'P2025':
        return 'Record not found.';
      case 'P2003':
        return 'Related record is missing or invalid.';
      default:
        return 'The request could not be completed.';
    }
  }
}
