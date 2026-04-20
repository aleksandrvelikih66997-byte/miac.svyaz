
import { rebuildAsteriskConfig } from '../lib/asterisk-bridge-logic.js';

console.log('Starting Asterisk Bridge Rebuild...');

try {
  rebuildAsteriskConfig();
  console.log('SUCCESS: Asterisk configurations have been synchronized.');
} catch (error) {
  console.error('ERROR during synchronization:', error);
  process.exit(1);
}
