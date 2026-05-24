import type { IncomingMessage, ServerResponse } from 'http';
import type { PulseConfig } from '@shared/config';

describe('loadPulseConfig', () => {
  it('loads shared/pulse.config.json and returns a valid PulseConfig', () => {
    const { loadPulseConfig } = require('../config');
    const cfg: PulseConfig = loadPulseConfig();
    expect(cfg.model.name).toBeTruthy();
    expect(Array.isArray(cfg.api.regions)).toBe(true);
    expect(cfg.api.regions.length).toBeGreaterThan(0);
    expect(typeof cfg.api.fetch.count).toBe('number');
    expect(typeof cfg.db.evict).toBe('boolean');
    expect(['debug', 'info', 'warn', 'error']).toContain(cfg.log.level);
  });

  it('falls back to defaultConfig when config file is absent', () => {
    const { loadPulseConfig } = require('../config');
    const cfg: PulseConfig = loadPulseConfig('/nonexistent/pulse.config.json');
    expect(cfg.model.name).toBe('sonar');
  });
});

describe('mergeConfig', () => {
  it('returns defaults unchanged when overrides is empty', () => {
    const { mergeConfig, defaultConfig } = require('../config');
    const result = mergeConfig(defaultConfig, {});
    expect(result.model.name).toBe('sonar');
    expect(result.db.evict).toBe(true);
  });

  it('deep-merges a partial override without clobbering sibling keys', () => {
    const { mergeConfig, defaultConfig } = require('../config');
    const result = mergeConfig(defaultConfig, { model: { name: 'sonar-pro' } });
    expect(result.model.name).toBe('sonar-pro');
    expect(result.model.temperature).toBe(0.2);
  });

  it('replaces arrays outright rather than merging them', () => {
    const { mergeConfig, defaultConfig } = require('../config');
    const result = mergeConfig(defaultConfig, { api: { regions: ['Hungary'] } });
    expect(result.api.regions).toEqual(['Hungary']);
    expect(result.api.fetch.count).toBe(5); // sibling untouched
  });
});

describe('checkCronSecret', () => {
  function makeReq(auth?: string): IncomingMessage {
    return { headers: { authorization: auth } } as unknown as IncomingMessage;
  }

  function makeRes(): ServerResponse & { statusCode: number; ended: boolean } {
    const res = {
      statusCode: 0,
      ended: false,
      writeHead(code: number) {
        this.statusCode = code;
        return this;
      },
      end() {
        this.ended = true;
        return this;
      },
    };
    return res as unknown as ServerResponse & { statusCode: number; ended: boolean };
  }

  it('returns true and does not write when CRON_SECRET is unset', () => {
    delete process.env.CRON_SECRET;
    const { checkCronSecret } = require('../config');
    const res = makeRes();
    expect(checkCronSecret(makeReq(), res)).toBe(true);
    expect(res.ended).toBe(false);
  });

  it('returns true when Authorization matches the secret', () => {
    process.env.CRON_SECRET = 'abc123';
    jest.resetModules();
    const { checkCronSecret } = require('../config');
    const res = makeRes();
    expect(checkCronSecret(makeReq('Bearer abc123'), res)).toBe(true);
    expect(res.ended).toBe(false);
    delete process.env.CRON_SECRET;
    jest.resetModules();
  });

  it('returns false and writes 401 when secret is wrong', () => {
    process.env.CRON_SECRET = 'abc123';
    jest.resetModules();
    const { checkCronSecret } = require('../config');
    const res = makeRes();
    expect(checkCronSecret(makeReq('Bearer wrong'), res)).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.ended).toBe(true);
    delete process.env.CRON_SECRET;
    jest.resetModules();
  });

  it('returns false and writes 401 when Authorization header is missing', () => {
    process.env.CRON_SECRET = 'abc123';
    jest.resetModules();
    const { checkCronSecret } = require('../config');
    const res = makeRes();
    expect(checkCronSecret(makeReq(), res)).toBe(false);
    expect(res.statusCode).toBe(401);
    delete process.env.CRON_SECRET;
    jest.resetModules();
  });
});
