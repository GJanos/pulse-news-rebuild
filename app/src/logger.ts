import { config } from './config';

export interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

const minLevel: number = LEVELS[config.logLevel];
const noop = (): void => {};

function ts(): string {
  return new Date().toISOString();
}

function makeMethod(level: Level, tag: string): (msg: string) => void {
  if (LEVELS[level] < minLevel) return noop;
  const prefix = `${level.toUpperCase().padEnd(5)} ${tag}`;
  return (msg: string) => console.log(`${ts()} ${prefix} ${msg}`);
}

/**
 * Returns a named logger scoped to a component or module.
 * Declare once at module level: `const log = getLogger('myModule')`.
 * Active levels are controlled by `logLevel` in pulse.config.json.
 */
export function getLogger(component: string): Logger {
  const tag = `(${component})`;
  return {
    debug: makeMethod('debug', tag),
    info: makeMethod('info', tag),
    warn: makeMethod('warn', tag),
    error: makeMethod('error', tag),
  };
}
