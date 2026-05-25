import winston from 'winston';
import type { PulseConfig } from '@shared/config';

const { combine, timestamp, printf, colorize } = winston.format;

const customFormat = printf((info) => {
  return `${info['timestamp']} ${info.level} (${info['component']}) ${info.message}`;
});

const logger = winston.createLogger({
  level: 'info',
  format: combine(timestamp(), colorize(), customFormat),
  transports: [new winston.transports.Console()],
});

export function configureLogger(config: PulseConfig): void {
  logger.level = config.log.level;
}

export function getLogger(component: string): winston.Logger {
  return logger.child({ component });
}
