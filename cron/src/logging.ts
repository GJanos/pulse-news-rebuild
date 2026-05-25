import winston from 'winston';
import type { PulseConfig } from '@shared/config';

const { combine, timestamp, printf, colorize } = winston.format;

const customFormat = printf((info) => {
  return `${info['timestamp']} ${info.level} (${info['component']}) ${info.message}`;
});

let logger: winston.Logger;

export function initializeLogger(config: PulseConfig): void {
  const level = config.log.level;

  logger = winston.createLogger({
    level,
    format: combine(timestamp(), colorize(), customFormat),
    transports: [new winston.transports.Console()],
  });
}

export function getLogger(component: string): winston.Logger {
  if (!logger) {
    throw new Error('Logger not initialized. Call initializeLogger first.');
  }
  return logger.child({ component });
}
