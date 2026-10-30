import { List } from 'fhir/r4b';
import { AdHocBillingRulesOutputSchema } from 'utils/lib/types/adhoc/datasets/billing-rules';
import { SERVICE_LINE_CONDITION_FIELDS } from 'utils/lib/types/adhoc/datasets/billing-rules';
import { RULE_FIELD_CATALOG } from 'utils/lib/types/data/billing/rules-engine.field-catalog';
import { BillingRule } from 'utils/lib/types/data/billing/rules-engine.schemas';
import { describe, expect, it, vi } from 'vitest';
import { fetchAdHocRuleRows } from '../../../src/billing/adhoc/rules';
import { rulesToList } from '../../../src/billing/rules-engine/serialization';
import { OystehrMock } from '../../helpers/oystehr-mock';

const lineRule: BillingRule = {
  id: 'r-1',
  name: 'Bump E&M units',
  description: '',
  enabled: true,
  conditional: {
    branches: [
      {
        condition: {
          type: 'group',
          logic: 'and',
          conditions: [
            { type: 'field', field: 'payerId', operator: 'eq', value: 'AETNA' },
            { type: 'field', field: 'cptCodes', operator: 'contains', value: '99213' },
          ],
        },
        outcome: {
          type: 'actions',
          actions: [
            {
              type: 'updateServiceLines',
              match: { type: 'field', property: 'cptCode', operator: 'eq', value: '99213' },
              set: { property: 'units', value: '2' },
            },
            { type: 'applyTag', tag: 'Reviewed' },
          ],
        },
      },
    ],
  },
} as BillingRule;

const plainRule: BillingRule = {
  id: 'r-2',
  name: 'Tag self-pay',
  description: 'Tags self-pay claims',
  enabled: false,
  conditional: {
    branches: [
      {
        condition: { type: 'field', field: 'payerId', operator: 'notExists' },
        outcome: { type: 'actions', actions: [{ type: 'applyTag', tag: 'Self-pay' }] },
      },
    ],
  },
} as BillingRule;

describe('fetchAdHocRuleRows (billing-rules dataset)', () => {
  it('lists every rule of every engine with its condition fields and service-line use', async () => {
    const lists: Record<string, List> = {
      'claim-submission': rulesToList('claim-submission', [lineRule, plainRule]),
    };
    const oystehr = {
      fhir: {
        search: vi.fn(async ({ params }: { params: { name: string; value: string }[] }) => {
          const tag = params.find((p) => p.name === '_tag')?.value ?? '';
          const list = Object.entries(lists).find(([, l]) => tag.endsWith(l.meta?.tag?.[0]?.code ?? '?'))?.[1];
          return { unbundle: () => (list ? [list] : []) };
        }),
      },
    } as unknown as OystehrMock;
    const rows = await fetchAdHocRuleRows(oystehr);

    expect(() => AdHocBillingRulesOutputSchema.parse({ rows })).not.toThrow();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      engine: 'claim-submission',
      position: 1,
      name: 'Bump E&M units',
      conditionFields: ['payerId', 'cptCodes'],
      serviceLineConditionFields: ['cptCodes'],
      serviceLineMatchProperties: ['cptCode'],
      hasServiceLineConditions: true,
      actionTypes: ['updateServiceLines', 'applyTag'],
    });
    expect(rows[1]).toMatchObject({
      position: 2,
      enabled: false,
      hasServiceLineConditions: false,
    });
  });

  it('knows every service-line condition field the rules engine offers', () => {
    const catalogIds = new Set(RULE_FIELD_CATALOG.map((field) => field.id));
    for (const field of SERVICE_LINE_CONDITION_FIELDS) expect(catalogIds.has(field), field).toBe(true);
  });
});
