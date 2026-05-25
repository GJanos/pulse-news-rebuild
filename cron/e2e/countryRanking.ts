import '../src/bootstrap';
import { createClient } from '@supabase/supabase-js';
import { loadPulseConfig } from '../src/config';
import { getLogger } from '../src/logging';
import { rankHeadlines } from '../src/rankHeadlines';
import type { RegionDigest, RegionHeadline } from '../src/types';
import { printHeadlines } from './print';

const log = getLogger('e2e:countryRanking');

function buildClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
  return createClient(url, key);
}

async function main() {
  const codes = process.argv.slice(2);
  if (codes.length === 0) {
    log.error('Usage: npm run e2e:countryRanking -- <REGION> [REGION ...]');
    log.error('Example: npm run e2e:countryRanking -- US GB DE');
    process.exit(1);
  }

  const config = loadPulseConfig();
  const db = buildClient();
  const today = new Date().toISOString().slice(0, 10);
  const normalised = codes.map((c) => c.toUpperCase());

  log.info(`Fetching digests for ${today} — regions: ${normalised.join(', ')}`);
  const { data, error } = await db
    .from('digests')
    .select('region, payload')
    .eq('date', today)
    .in('region', normalised);

  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
  if (!data || data.length === 0) {
    log.info('No matching digests found for today. Run the cron first.');
    return;
  }

  const digests: RegionDigest[] = data.map((row) => ({
    region: row.region as string,
    headlines: (row.payload as { headlines: RegionHeadline[] }).headlines,
    attempts: 1,
  }));

  for (const digest of digests) {
    log.info(`\nRanking ${digest.region} (${digest.headlines.length} headlines)…`);
    const { headlines } = await rankHeadlines(digest.headlines, digest.region, config);
    printHeadlines({ ...digest, headlines });
  }
}

main().catch((err) => {
  log.error(String(err));
  process.exit(1);
});
