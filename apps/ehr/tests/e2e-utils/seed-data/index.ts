/**
 * Merges all seed data resources from the resources/ directory into a FHIR transaction bundle.
 * This file is static and does not change - only the JSON files in resources/ are updated.
 */

import type { Bundle, BundleEntry } from 'fhir/r4b';
import { readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const resourcesDir = join(__dirname, 'resources');

let entries: BundleEntry[] = [];

try {
  const files = readdirSync(resourcesDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  entries = files.map((file) => {
    const content = readFileSync(join(resourcesDir, file), 'utf-8');
    return JSON.parse(content) as BundleEntry;
  });
} catch {
  // Resources directory doesn't exist yet - will be created on first seed generation
}

const bundle: Bundle = {
  resourceType: 'Bundle',
  type: 'transaction',
  entry: entries,
};

export default bundle;
