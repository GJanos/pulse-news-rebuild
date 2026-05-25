import { initializeLogger, getLogger } from '../logging';
import { loadPulseConfig } from '../config';

describe('getLogger', () => {
  it('throws when called before initializeLogger', () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getLogger: fresh } = require('../logging');
    expect(() => fresh('test')).toThrow('Logger not initialized');
  });
});

describe('initializeLogger + getLogger', () => {
  it('returns a child logger with info/warn/debug after init', () => {
    const config = loadPulseConfig();
    initializeLogger(config);
    const log = getLogger('test-component');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.debug).toBe('function');
  });

  it('returns a new child logger on each getLogger call', () => {
    const log1 = getLogger('a');
    const log2 = getLogger('b');
    expect(log1).not.toBe(log2);
  });
});
