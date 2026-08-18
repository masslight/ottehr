// get-chart-data has two classes of field: ones the UNSCOPED call brings by default, and ones it
// fetches ONLY when asked for by name. Omitting one of the second class does not error — it returns an
// empty section. That is how hospitalizations were invisible on the Easy Chart page: the section
// rendered as "no content" and was hidden, indistinguishable from a patient with no history.
//
// This test reads the zambda's own source for the `if (requestedFields?.X)` gates, so a field added
// there later cannot silently go unrequested here.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  REQUEST_ONLY_CHART_FIELDS,
  UNREQUESTED_BY_DESIGN,
} from '../../src/features/easy-chart/hooks/useEasyChartData';

const GET_CHART_DATA = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/zambdas/src/ehr/get-chart-data/index.ts'
);
const EASY_CHART_DATA_HOOK = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/features/easy-chart/hooks/useEasyChartData.ts'
);

/** Fields the zambda only fetches when the caller names them. */
function requestOnlyFieldsInZambda(): string[] {
  const source = readFileSync(GET_CHART_DATA, 'utf8');
  const fields = new Set<string>();
  for (const match of source.matchAll(/if \(requestedFields\?\.(\w+)\)/g)) fields.add(match[1]);
  return [...fields].sort();
}

/** Field names EXTRA_FIELDS asks for. Read from source so the `as const` object stays the one source. */
function fieldsRequestedByTheHook(): string[] {
  const source = readFileSync(EASY_CHART_DATA_HOOK, 'utf8');
  const block = source.slice(source.indexOf('const EXTRA_FIELDS = {'), source.indexOf('} as const;'));
  return [...block.matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1]);
}

describe('the Easy Chart chart-data request', () => {
  it('knows the same request-only field list the zambda gates on', () => {
    expect(
      requestOnlyFieldsInZambda(),
      'get-chart-data gained or lost a `if (requestedFields?.X)` gate. Update REQUEST_ONLY_CHART_FIELDS, ' +
        'and add the field to EXTRA_FIELDS unless there is a reason in UNREQUESTED_BY_DESIGN.'
    ).toEqual([...REQUEST_ONLY_CHART_FIELDS].sort());
  });

  // The actual bug: a request-only field the page renders but never asks for is an empty section, not
  // an error.
  it('asks for every request-only field, or records why it does not', () => {
    const requested = new Set(fieldsRequestedByTheHook());
    const missing = REQUEST_ONLY_CHART_FIELDS.filter(
      (field) => !requested.has(field) && !UNREQUESTED_BY_DESIGN[field]
    );
    expect(
      missing,
      `${missing.join(', ')} are fetched only on request, are not in EXTRA_FIELDS, and have no reason in ` +
        `UNREQUESTED_BY_DESIGN. Each one renders as an empty section rather than failing.`
    ).toEqual([]);
  });

  it('does not carry a stale reason for a field it actually asks for', () => {
    const requested = new Set(fieldsRequestedByTheHook());
    for (const field of Object.keys(UNREQUESTED_BY_DESIGN)) {
      expect(requested.has(field), `${field} has an "unrequested by design" reason but is requested`).toBe(false);
    }
  });

  it('asks for hospitalizations specifically', () => {
    // Named on its own because this is the regression: the section existed, the data never arrived.
    expect(fieldsRequestedByTheHook()).toContain('episodeOfCare');
  });
});
