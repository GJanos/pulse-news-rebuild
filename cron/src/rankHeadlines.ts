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
function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!_client) _client = new Anthropic({ apiKey });
  return _client;
}

// Sonnet pricing as of 2026 — update here if Anthropic changes rates.
const COST_PER_INPUT_TOKEN = 3.0 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 15.0 / 1_000_000;

const RANKING_TOOL: Anthropic.Tool = {
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

const GLOBAL_TOOL: Anthropic.Tool = {
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

/**
 * Reorders headlines by country importance using Claude.
 * Falls back to original order if the ranking call fails or returns an invalid result.
 */
export async function rankHeadlines(
  headlines: RegionHeadline[],
  region: string,
  config: PulseConfig,
): Promise<RankingResult> {
  if (!config.api.ranking.local.enabled || headlines.length <= 1) {
    return { headlines, usage: null };
  }

  const log = getLogger('rankHeadlines');
  const client = getClient();
  if (!client) {
    log.warn('ANTHROPIC_API_KEY not set — skipping ranking');
    return { headlines, usage: null };
  }

  const { model, maxTokens } = config.api.ranking.local;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: buildRankingSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: buildRankingUserPrompt(
            region,
            headlines.map((h) => ({ title: h.title, summary: h.summary ?? '' })),
          ),
        },
      ],
      tools: [RANKING_TOOL],
      tool_choice: { type: 'any' },
    });

    const { input_tokens, output_tokens } = response.usage;
    const costUsd = input_tokens * COST_PER_INPUT_TOKEN + output_tokens * COST_PER_OUTPUT_TOKEN;
    const usage: DigestUsage = {
      promptTokens: input_tokens,
      completionTokens: output_tokens,
      totalTokens: input_tokens + output_tokens,
      costUsd,
    };
    log.info(
      `[${region}] ranking — ${input_tokens}+${output_tokens}=${usage.totalTokens} tokens | $${costUsd.toFixed(6)}`,
    );

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (!toolUse) throw new Error('No tool_use block in response');

    const input = toolUse.input as { ranking: unknown };
    if (!Array.isArray(input.ranking)) throw new Error('ranking is not an array');

    const indices = input.ranking as number[];
    if (indices.length !== headlines.length) {
      throw new Error(`Expected ${headlines.length} indices, got ${indices.length}`);
    }

    const seen = new Set<number>();
    for (const idx of indices) {
      if (!Number.isInteger(idx) || idx < 1 || idx > headlines.length) {
        throw new Error(`Invalid index ${idx}`);
      }
      if (seen.has(idx)) throw new Error(`Duplicate index ${idx}`);
      seen.add(idx);
    }

    log.info(`[${region}] Ranked: ${indices.join(' > ')}`);
    return { headlines: indices.map((i) => headlines[i - 1]!), usage };
  } catch (err) {
    log.warn(
      `[${region}] Ranking failed (${err instanceof Error ? err.message : String(err)}) — using original order`,
    );
    return { headlines, usage: null };
  }
}
