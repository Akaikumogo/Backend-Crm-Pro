import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppLogger } from './logger/app-logger.service';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  requestId?: string;
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const r = res as Record<string, unknown>;
        if (typeof r.message === 'string' || Array.isArray(r.message)) {
          message = r.message as string | string[];
        }
        if (typeof r.error === 'string') {
          error = r.error;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      message,
      error,
      requestId: request.id,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    const stack =
      exception instanceof Error ? exception.stack : undefined;
    const logMeta = `${request.method} ${request.url} -> ${status}` +
      (request.id ? ` [reqId=${request.id}]` : '');

    if (status >= 500) {
      this.logger.error(
        `${logMeta} ${typeof message === 'string' ? message : JSON.stringify(message)}`,
        stack,
        'ExceptionFilter',
      );
    } else if (status >= 400) {
      this.logger.warn(
        `${logMeta} ${typeof message === 'string' ? message : JSON.stringify(message)}`,
        'ExceptionFilter',
      );
    }

    response.status(status).json(body);
  }
}
