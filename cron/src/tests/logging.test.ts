import { configureLogger, getLogger } from '../logging';
import { loadPulseConfig } from '../config';

describe('getLogger', () => {
  it('returns a child logger with info/warn/debug before configureLogger is called', () => {
    const log = getLogger('pre-config');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.debug).toBe('function');
  });
});

describe('configureLogger + getLogger', () => {
  it('returns a child logger with info/warn/debug after configuration', () => {
    const config = loadPulseConfig();
    configureLogger(config);
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
