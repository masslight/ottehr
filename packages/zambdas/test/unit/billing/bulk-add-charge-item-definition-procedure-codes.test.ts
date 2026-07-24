import Oystehr from '@oystehr/sdk';
import { ChargeItemDefinition } from 'fhir/r4b';
import { CPT_CODE_SYSTEM, EXTENSION_URL_CPT_MODIFIER, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { vi } from 'vitest';
import { performEffect } from '../../../src/billing/bulk-add-charge-item-definition-procedure-codes/index';
import {
  BulkAddChargeItemDefinitionProcedureCodesParams,
  validateRequestParameters,
} from '../../../src/billing/bulk-add-charge-item-definition-procedure-codes/validateRequestParameters';
import { CHARGE_ITEM_DEFINITION_TYPE_SYSTEM } from '../../../src/billing/shared';

function mockOystehr(): { update: ReturnType<typeof vi.fn>; oystehr: Oystehr } {
  const update = vi.fn(async (resource: ChargeItemDefinition) => resource);
  return { update, oystehr: { fhir: { update } } as unknown as Oystehr };
}

function definition(overrides: Partial<ChargeItemDefinition> = {}): ChargeItemDefinition {
  return {
    resourceType: 'ChargeItemDefinition',
    id: 'cid-1',
    url: 'urn:uuid:charge-master:test',
    status: 'active',
    title: 'Test Charge Master',
    meta: { versionId: '7', tag: [{ system: CHARGE_ITEM_DEFINITION_TYPE_SYSTEM, code: 'charge-master' }] },
    propertyGroup: [
      {
        priceComponent: [
          {
            type: 'base',
            code: { coding: [{ system: CPT_CODE_SYSTEM, code: '11111', display: 'Existing' }] },
            amount: { value: 10, currency: 'USD' },
          },
        ],
      },
    ],
    ...overrides,
  };
}

function params(
  overrides: Partial<BulkAddChargeItemDefinitionProcedureCodesParams> = {}
): BulkAddChargeItemDefinitionProcedureCodesParams {
  return {
    type: 'charge-master',
    chargeItemDefinitionId: 'cid-1',
    procedureCodes: [{ code: '99213', description: 'Visit', modifier: '25', amount: 150 }],
    replaceAll: false,
    secrets: null,
    ...overrides,
  };
}

describe('bulk-add-charge-item-definition-procedure-codes', () => {
  describe('validation', () => {
    it('throws validation error on empty secrets', async () => {
      expect(() => validateRequestParameters({ headers: null, body: '{}', secrets: null })).toThrow(
        expect.objectContaining(MISSING_REQUEST_SECRETS)
      );
    });
    it('throws validation error on empty body', async () => {
      expect(() => validateRequestParameters({ headers: null, body: null, secrets: {} })).toThrow(
        expect.objectContaining(MISSING_REQUEST_BODY)
      );
    });
  });

  describe('effect', () => {
    it('appends mapped property groups and updates with optimistic locking', async () => {
      const { update, oystehr } = mockOystehr();

      const result = await performEffect(oystehr, params(), { definition: definition() });

      const [updated, options] = update.mock.calls[0];
      expect(updated.propertyGroup).toHaveLength(2);
      expect(updated.propertyGroup[1].priceComponent[0]).toEqual({
        type: 'base',
        code: { coding: [{ system: CPT_CODE_SYSTEM, code: '99213', display: 'Visit' }] },
        amount: { value: 150, currency: 'USD' },
        extension: [{ url: EXTENSION_URL_CPT_MODIFIER, valueCode: '25' }],
      });
      expect(options).toEqual({ optimisticLockingVersionId: '7' });
      expect(result.procedureCodes.map((pc) => pc.code)).toEqual(['11111', '99213']);
    });

    it('replaces all property groups when replaceAll is true', async () => {
      const { update, oystehr } = mockOystehr();

      const result = await performEffect(oystehr, params({ replaceAll: true }), { definition: definition() });

      expect(update.mock.calls[0][0].propertyGroup).toHaveLength(1);
      expect(result.procedureCodes.map((pc) => pc.code)).toEqual(['99213']);
    });

    it('omits the modifier extension when no modifier is given and keeps zero amounts in the response', async () => {
      const { oystehr } = mockOystehr();

      const result = await performEffect(
        oystehr,
        params({ procedureCodes: [{ code: '99490', description: 'Zero dollar', amount: 0 }], replaceAll: true }),
        { definition: definition() }
      );

      expect(result.procedureCodes).toEqual([
        { code: '99490', description: 'Zero dollar', modifier: undefined, amount: 0 },
      ]);
    });
  });
});
