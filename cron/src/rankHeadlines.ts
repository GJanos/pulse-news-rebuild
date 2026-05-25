// cron/src/rankHeadlines.ts
import Anthropic from '@anthropic-ai/sdk';
import type { RegionHeadline, RegionDigest, DigestUsage } from './types';
import type { PulseConfig } from '@shared/config';
import {
  buildRankingSystemPrompt,
  buildRankingUserPrompt,
  buildGlobalSystemPrompt,
  buildGlobalUserPrompt,
} from './prompt';
import { getLogger } from './logging';

// Lazily initialized after dotenv runs — avoids re-instantiation per region call.
let _client: Anthropic | null = null;
export function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!_client) _client = new Anthropic({ apiKey });
  return _client;
}

// Sonnet pricing as of 2026 — update here if Anthropic changes rates.
export const COST_PER_INPUT_TOKEN = 3.0 / 1_000_000;
export const COST_PER_OUTPUT_TOKEN = 15.0 / 1_000_000;

export const RANKING_TOOL: Anthropic.Tool = {
  name: 'submit_ranking',
  description: 'Submit the ranked order of headlines, most important first.',
  input_schema: {
    type: 'object',
    properties: {
      ranking: {
        type: 'array',
        items: { type: 'integer' },
        description:
          '1-based headline indices in descending order of importance. Must contain every index exactly once.',
      },
    },
    required: ['ranking'],
  },
};

export const GLOBAL_TOOL: Anthropic.Tool = {
  name: 'submit_global_selection',
  description: 'Submit the indices of the most globally important headlines, most important first.',
  input_schema: {
    type: 'object',
    properties: {
      indices: {
        type: 'array',
        items: { type: 'integer' },
        description: '1-based headline indices in descending order of global importance.',
      },
    },
    required: ['indices'],
  },
};

export interface GlobalHeadline {
  title: string;
  summary: string;
  detail?: string;
  url: string;
  region: string;
  sourceName?: string;
}

export interface RankingResult {
  headlines: RegionHeadline[];
  usage: DigestUsage | null;
}
