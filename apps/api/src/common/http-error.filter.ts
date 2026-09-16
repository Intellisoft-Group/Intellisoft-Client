import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Production-safe HTTP errors: never leak stacks or Prisma internals to clients.
 */
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly log = new Logger('HttpError');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const prod = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Something went wrong. Please try again.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const m = (body as { message?: string | string[] }).message;
        message = m ?? exception.message;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      this.log.error(`${req.method} ${req.url} — ${exception.message}`, exception.stack);
      if (!prod) message = exception.message;
    } else {
      this.log.error(`${req.method} ${req.url} — unknown error`);
    }

    if (prod && status >= 500) {
      message = 'Something went wrong. Please try again.';
    }

    res.status(status).json({
      statusCode: status,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
