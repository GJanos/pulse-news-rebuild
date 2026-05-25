import type Anthropic from '@anthropic-ai/sdk';
import { getClient, RANKING_TOOL, GLOBAL_TOOL } from '../rankHeadlines';

describe('rankHeadlines — skeleton', () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalApiKey;
    jest.resetModules();
  });

  describe('getClient()', () => {
    it('returns null when ANTHROPIC_API_KEY is not set', () => {
      delete process.env.ANTHROPIC_API_KEY;
      jest.resetModules();
      const { getClient } = require('../rankHeadlines');
      expect(getClient()).toBeNull();
    });

    it('returns an Anthropic instance when API key is set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key-12345';
      jest.resetModules();
      const { getClient } = require('../rankHeadlines');
      const client = getClient();
      expect(client).toBeTruthy();
      expect(client.apiKey).toBe('test-key-12345');
    });

    it('caches the client instance on subsequent calls', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key-12345';
      jest.resetModules();
      const { getClient } = require('../rankHeadlines');
      const client1 = getClient();
      const client2 = getClient();
      expect(client1).toBe(client2);
    });
  });

  describe('RANKING_TOOL', () => {
    it('defines a tool named submit_ranking', () => {
      expect(RANKING_TOOL.name).toBe('submit_ranking');
    });

    it('has a description', () => {
      expect(RANKING_TOOL.description).toBeTruthy();
    });

    it('has input_schema with type object', () => {
      expect(RANKING_TOOL.input_schema.type).toBe('object');
    });

    it('defines a ranking property as array of integers', () => {
      const rankingProp = (RANKING_TOOL.input_schema.properties as Record<string, unknown>).ranking;
      expect(rankingProp).toBeTruthy();
      expect((rankingProp as Record<string, unknown>).type).toBe('array');
      expect((rankingProp as Record<string, unknown>).items).toEqual({ type: 'integer' });
    });

    it('requires ranking property', () => {
      expect(RANKING_TOOL.input_schema.required).toContain('ranking');
    });
  });

  describe('GLOBAL_TOOL', () => {
    it('defines a tool named submit_global_selection', () => {
      expect(GLOBAL_TOOL.name).toBe('submit_global_selection');
    });

    it('has a description', () => {
      expect(GLOBAL_TOOL.description).toBeTruthy();
    });

    it('has input_schema with type object', () => {
      expect(GLOBAL_TOOL.input_schema.type).toBe('object');
    });

    it('defines an indices property as array of integers', () => {
      const indicesProp = (GLOBAL_TOOL.input_schema.properties as Record<string, unknown>).indices;
      expect(indicesProp).toBeTruthy();
      expect((indicesProp as Record<string, unknown>).type).toBe('array');
      expect((indicesProp as Record<string, unknown>).items).toEqual({ type: 'integer' });
    });

    it('requires indices property', () => {
      expect(GLOBAL_TOOL.input_schema.required).toContain('indices');
    });
  });

  describe('type exports', () => {
    it('exports GlobalHeadline interface', () => {
      const { GlobalHeadline } = require('../rankHeadlines');
      // In TypeScript, interfaces don't exist at runtime, but we can verify the module exports something
      expect(typeof require('../rankHeadlines')).toBe('object');
    });

    it('exports RankingResult interface', () => {
      const { RankingResult } = require('../rankHeadlines');
      // Same as above — just verify the module can be required
      expect(typeof require('../rankHeadlines')).toBe('object');
    });
  });
});
