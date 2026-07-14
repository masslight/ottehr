import * as fs from 'fs';
import * as path from 'path';
import { generateRulesEngineDocumentation } from 'utils';

// Renders the billing rules-engine reference (supported conditions and actions) from the field
// catalog and rule schemas in packages/utils/lib/types/data/billing/. Run via
// `npm run docs:billing-rules` after changing the catalog; a unit test in utils
// (rules-engine.docs.test.ts) fails when the committed file is stale.

const target = path.resolve(__dirname, '../docs/billing-rules-engine.md');
fs.writeFileSync(target, generateRulesEngineDocumentation());
console.log(`Wrote ${target}`);
