import { ConsoleLogger, Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

@Injectable()
export class AppLogger implements LoggerService {
  private readonly winston: winston.Logger;
  private readonly fallback = new ConsoleLogger();

  constructor(config: ConfigService) {
    const level = config.get<string>('LOG_LEVEL') ?? 'info';
    const dir = config.get<string>('LOG_DIR') ?? 'logs';
    const isProd = config.get<string>('NODE_ENV') === 'production';

    const jsonFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    );

    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf((info) => {
        const ctx = info.context ? ` [${info.context as string}]` : '';
        const reqId = info.requestId ? ` (${info.requestId as string})` : '';
        const stack =
          info.stack && typeof info.stack === 'string'
            ? `\n${info.stack}`
            : '';
        return `${info.timestamp as string} ${info.level}${ctx}${reqId} ${info.message as string}${stack}`;
      }),
    );

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: isProd ? jsonFormat : consoleFormat,
      }),
    ];

    if (isProd || process.env.LOG_TO_FILE === 'true') {
      const DailyRotateFile = (winston.transports as unknown as {
        DailyRotateFile: new (opts: unknown) => winston.transport;
      }).DailyRotateFile;
      transports.push(
        new DailyRotateFile({
          dirname: path.resolve(dir),
          filename: 'app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
          level,
          format: jsonFormat,
        }),
        new DailyRotateFile({
          dirname: path.resolve(dir),
          filename: 'error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d',
          level: 'error',
          format: jsonFormat,
        }),
      );
    }

    this.winston = winston.createLogger({
      level,
      format: jsonFormat,
      transports,
      exitOnError: false,
    });
  }

  log(message: unknown, context?: string) {
    this.winston.info(this.stringify(message), { context });
  }

  error(message: unknown, stackOrContext?: string, context?: string) {
    const looksLikeStack =
      stackOrContext && stackOrContext.includes('\n');
    this.winston.error(this.stringify(message), {
      context: looksLikeStack ? context : stackOrContext ?? context,
      stack: looksLikeStack ? stackOrContext : undefined,
    });
  }

  warn(message: unknown, context?: string) {
    this.winston.warn(this.stringify(message), { context });
  }

  debug(message: unknown, context?: string) {
    this.winston.debug(this.stringify(message), { context });
  }

  verbose(message: unknown, context?: string) {
    this.winston.verbose(this.stringify(message), { context });
  }

  private stringify(message: unknown): string {
    if (typeof message === 'string') return message;
    try {
      return JSON.stringify(message);
    } catch {
      this.fallback.error('Failed to stringify log message');
      return String(message);
    }
  }
}
