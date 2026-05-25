import '../src/bootstrap';
import { loadPulseConfig } from '../src/config';
import { getLogger } from '../src/logging';
import { sendNotifications } from '../src/notify';

const log = getLogger('e2e:notify');

async function main() {
  loadPulseConfig();
  await sendNotifications([{ region: 'Test', headlines: [], attempts: 0 }]);
  log.info('Test notification pipeline completed');
}

main().catch((err) => {
  log.error(String(err));
  process.exit(1);
});
