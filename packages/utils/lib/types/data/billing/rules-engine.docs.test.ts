import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateRulesEngineDocumentation } from './rules-engine.docs';
import { RULE_FIELD_CATALOG, SERVICE_LINE_PROPERTY_CATALOG } from './rules-engine.field-catalog';
import { RULE_OPERATOR_METADATA, RULE_OPERATORS } from './rules-engine.schemas';

// docs/billing-rules-engine.md at the repo root, relative to this file
// (packages/utils/lib/types/data/billing/).
const DOC_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../../docs/billing-rules-engine.md');

describe('rules-engine documentation', () => {
  it('mentions every catalog field, every service line property, and every operator', () => {
    const doc = generateRulesEngineDocumentation();
    for (const field of RULE_FIELD_CATALOG) {
      expect(doc, `field ${field.id} missing from docs`).toContain(`\`${field.id}\``);
    }
    for (const property of SERVICE_LINE_PROPERTY_CATALOG) {
      expect(doc, `service line property ${property.id} missing from docs`).toContain(`\`${property.id}\``);
    }
    for (const op of RULE_OPERATORS) {
      expect(doc, `operator ${op} missing from docs`).toContain(RULE_OPERATOR_METADATA[op].label);
    }
  });

  // The committed markdown is generated from the catalog/schemas; this keeps it that way. If this
  // fails you changed the rules engine's fields, operators, or actions without regenerating the
  // reference doc.
  it('docs/billing-rules-engine.md is up to date (run `npm run docs:billing-rules` if this fails)', () => {
    const committed = readFileSync(DOC_PATH, 'utf-8');
    expect(committed).toBe(generateRulesEngineDocumentation());
  });
});
