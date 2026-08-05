import { config } from '../config/index.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel | 'silent', number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const ANSI: Record<LogLevel, string> = {
  debug: '\u001b[90m',
  info: '\u001b[36m',
  warn: '\u001b[33m',
  error: '\u001b[31m',
};
const ANSI_DIM = ANSI.debug;
const ANSI_RESET = '\u001b[0m';

export type LogContext = Record<string, unknown>;

/**
 * Dependency-free structured logger.
 *
 * Production emits newline-delimited JSON so log shippers can parse it without
 * configuration; development emits a compact coloured line that stays readable
 * next to Vite's output.
 */
class Logger {
  private readonly bindings: LogContext;

  constructor(bindings: LogContext = {}) {
    this.bindings = bindings;
  }

  /** Returns a logger that stamps every record with additional fields. */
  child(bindings: LogContext): Logger {
    return new Logger({ ...this.bindings, ...bindings });
  }

  debug(message: string, context?: LogContext): void {
    this.write('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.write('error', message, context);
  }

  private enabled(level: LogLevel): boolean {
    return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[config.logging.level];
  }

  private write(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.enabled(level)) return;

    const record = {
      level,
      time: new Date().toISOString(),
      message,
      ...this.bindings,
      ...context,
    };

    const line = config.isProduction
      ? JSON.stringify(record)
      : formatPretty(level, message, { ...this.bindings, ...context });

    if (level === 'error') {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
  }
}

function formatPretty(level: LogLevel, message: string, context: LogContext): string {
  const time = new Date().toISOString().slice(11, 23);
  const label = `${ANSI[level]}${level.toUpperCase().padEnd(5)}${ANSI_RESET}`;
  const entries = Object.entries(context).filter(([, value]) => value !== undefined);
  const suffix = entries.length
    ? ` ${ANSI_DIM}${entries.map(([key, value]) => `${key}=${stringify(value)}`).join(' ')}${ANSI_RESET}`
    : '';
  return `${ANSI_DIM}${time}${ANSI_RESET} ${label} ${message}${suffix}`;
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export const logger = new Logger();
export type { Logger };
