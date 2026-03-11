/**
 * Helper script: Imports a single config module and outputs its config as JSON.
 * Called by verify-config-equivalence.ts in a subprocess for isolation.
 *
 * Usage: npx tsx scripts/verify-single-module.ts <module> <configKey>
 */

import * as path from 'path';

async function main(): Promise<void> {
  const mod = process.argv[2];
  const configKey = process.argv[3];

  if (!mod || !configKey) {
    process.exit(1);
  }

  const CORE_CONFIG = path.join(__dirname, '..', 'packages', 'utils', 'lib', 'ottehr-config');

  // Import the full utils barrel first for proper init order
  await import(path.join(__dirname, '..', 'packages', 'utils', 'lib', 'main.ts'));

  const moduleExports = await import(path.join(CORE_CONFIG, mod, 'index.ts'));
  const config = moduleExports[configKey];

  if (!config) {
    console.error(`Config key '${configKey}' not found`);
    process.exit(1);
  }

  // Output as JSON
  process.stdout.write(JSON.stringify(config, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
