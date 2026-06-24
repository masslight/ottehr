import Oystehr from '@oystehr/sdk';
import { ChargeItemDefinition } from 'fhir/r4b';
import {
  CPT_CODE_SYSTEM,
  CPT_MODIFIER_EXTENSION_URL,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  UpdateChargeItemDefinitionInput,
} from 'utils';
import { vi } from 'vitest';
import { CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM, CHARGE_ITEM_DEFINITION_TYPE_SYSTEM } from '../../../src/billing/shared';
import { performEffect } from '../../../src/billing/update-charge-item-definition/index';
import {
  complexValidation,
  UpdateChargeItemDefinitionParams,
  validateRequestParameters,
} from '../../../src/billing/update-charge-item-definition/validateRequestParameters';

describe('update-charge-item-definition', () => {
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
    it('throws validation error on non-json body', async () => {
      expect(() => validateRequestParameters({ headers: null, body: 'some text', secrets: {} })).toThrow(
        expect.objectContaining(INVALID_INPUT_ERROR('Invalid JSON in request body'))
      );
    });
    it('throws validation error on missing required fields', async () => {
      expect(() => validateRequestParameters({ headers: null, body: '{}', secrets: {} })).toThrow(
        expect.objectContaining(
          INVALID_INPUT_ERROR('Validation error: Required at "type"; Required at "chargeItemDefinitionId"')
        )
      );
    });
    it('throws validation error on invalid param types', async () => {
      const body = {
        type: 'purple-people-eater',
        chargeItemDefinitionId: 'some-not-uuid',
      };
      expect(() => validateRequestParameters({ headers: null, body: JSON.stringify(body), secrets: {} })).toThrow(
        expect.objectContaining(
          INVALID_INPUT_ERROR(
            "Validation error: Invalid enum value. Expected 'charge-master' | 'fee-schedule', received 'purple-people-eater' at \"type\"; Invalid uuid at \"chargeItemDefinitionId\""
          )
        )
      );
    });
    it('throws error with no updated params', async () => {
      const body = { type: 'charge-master', chargeItemDefinitionId: '0f8a9b3c-fd93-42a1-8560-6ca4bc9446c9' };
      expect(() => validateRequestParameters({ headers: null, body: JSON.stringify(body), secrets: {} })).toThrow(
        expect.objectContaining(INVALID_INPUT_ERROR('At least one field must be updated'))
      );
    });
    it('succeeds with minimal input', async () => {
      const body = {
        type: 'charge-master',
        chargeItemDefinitionId: '0f8a9b3c-fd93-42a1-8560-6ca4bc9446c9',
        name: 'test',
      };
      const input = validateRequestParameters({
        headers: null,
        body: JSON.stringify(body),
        secrets: {},
      });
      expect(input).toStrictEqual({
        type: 'charge-master',
        chargeItemDefinitionId: '0f8a9b3c-fd93-42a1-8560-6ca4bc9446c9',
        name: 'test',
        secrets: {},
      });
    });
    it('succeeds with maximal input', async () => {
      // CW TODO
      const body: UpdateChargeItemDefinitionInput = {
        type: 'charge-master',
        chargeItemDefinitionId: '0f8a9b3c-fd93-42a1-8560-6ca4bc9446c9',
        name: 'test',
        effectiveDate: '2026-01-01',
        description: 'test description',
        default: 'insurance',
        status: 'retired',
        procedureCodes: [
          {
            code: '90101',
            amount: 25.15,
          },
          {
            code: '10109',
            modifier: '22',
            amount: 5,
          },
        ],
      };
      const input = validateRequestParameters({
        headers: null,
        body: JSON.stringify(body),
        secrets: {},
      });
      expect(input).toStrictEqual({
        type: 'charge-master',
        chargeItemDefinitionId: '0f8a9b3c-fd93-42a1-8560-6ca4bc9446c9',
        name: 'test',
        effectiveDate: '2026-01-01',
        description: 'test description',
        default: 'insurance',
        status: 'retired',
        procedureCodes: [
          {
            code: '90101',
            amount: 25.15,
          },
          {
            code: '10109',
            modifier: '22',
            amount: 5,
          },
        ],
        secrets: {},
      });
    });
    it('succeeds with only removing optional fields input', async () => {
      // CW TODO
      const body: UpdateChargeItemDefinitionInput = {
        type: 'charge-master',
        chargeItemDefinitionId: '0f8a9b3c-fd93-42a1-8560-6ca4bc9446c9',
        effectiveDate: null,
        description: null,
        default: null,
      };
      const input = validateRequestParameters({
        headers: null,
        body: JSON.stringify(body),
        secrets: {},
      });
      expect(input).toStrictEqual({
        type: 'charge-master',
        chargeItemDefinitionId: '0f8a9b3c-fd93-42a1-8560-6ca4bc9446c9',
        effectiveDate: null,
        description: null,
        default: null,
        secrets: {},
      });
    });
  });
  describe('complexValidation', () => {
    it('throws validation error on mismatched type and id', async () => {
      const params: UpdateChargeItemDefinitionParams = {
        type: 'charge-master',
        chargeItemDefinitionId: '0f8a9b3c-fd93-42a1-8560-6ca4bc9446c9',
        secrets: {},
      };
      const oystehr = {
        fhir: {
          search: vi.fn().mockResolvedValueOnce({ unbundle: () => [] }),
        },
      } as unknown as Oystehr;
      await expect(async () => complexValidation(oystehr, params)).rejects.toThrow(
        expect.objectContaining({
          code: 4017,
          message: 'The requested charge-master could not be found',
        })
      );
      expect(oystehr.fhir.search).toHaveBeenCalledWith({
        resourceType: 'ChargeItemDefinition',
        params: [
          {
            name: '_tag',
            value: `${CHARGE_ITEM_DEFINITION_TYPE_SYSTEM}|charge-master`,
          },
          { name: '_id', value: '0f8a9b3c-fd93-42a1-8560-6ca4bc9446c9' },
        ],
      });
    });
    it('passes validation', async () => {
      const params: UpdateChargeItemDefinitionParams = {
        type: 'charge-master',
        chargeItemDefinitionId: '0f8a9b3c-fd93-42a1-8560-6ca4bc9446c9',
        secrets: {},
      };
      const completeResource: ChargeItemDefinition = {
        resourceType: 'ChargeItemDefinition',
        id: '0f8a9b3c-fd93-42a1-8560-6ca4bc9446c9',
        title: 'test',
        status: 'active',
        url: 'urn:uuid:charge-master:test',
        meta: {
          tag: [
            {
              system: CHARGE_ITEM_DEFINITION_TYPE_SYSTEM,
              code: 'charge-master',
            },
          ],
        },
      };
      const oystehr = {
        fhir: {
          search: vi.fn().mockResolvedValueOnce({ unbundle: () => [completeResource] }),
        },
      } as unknown as Oystehr;
      const cvo = await complexValidation(oystehr, params);
      expect(cvo).toEqual({ definition: completeResource });
      expect(oystehr.fhir.search).toHaveBeenCalledWith({
        resourceType: 'ChargeItemDefinition',
        params: [
          {
            name: '_tag',
            value: `${CHARGE_ITEM_DEFINITION_TYPE_SYSTEM}|charge-master`,
          },
          { name: '_id', value: '0f8a9b3c-fd93-42a1-8560-6ca4bc9446c9' },
        ],
      });
    });
  });
  describe('performEffect', () => {
    it('updates CID with minimal input and name with special characters', async () => {
      const params: UpdateChargeItemDefinitionParams = {
        type: 'charge-master',
        chargeItemDefinitionId: '565e1b1a-a48f-4c0b-9192-60f5b0cec59c',
        name: 'Fun ny T3s! n4me __',
        secrets: {},
      };
      const existingResource: ChargeItemDefinition = {
        resourceType: 'ChargeItemDefinition',
        id: 'some-uuid',
        title: 'test',
        status: 'active',
        url: 'urn:uuid:charge-master:test',
        date: '2026-01-01',
        description: 'test description',
        propertyGroup: [
          {
            priceComponent: [
              {
                type: 'base',
                code: {
                  coding: [
                    {
                      system: CPT_CODE_SYSTEM,
                      code: '77777',
                    },
                  ],
                },
                amount: {
                  value: 10,
                  currency: 'USD',
                },
              },
            ],
          },
        ],
        meta: {
          tag: [
            {
              system: CHARGE_ITEM_DEFINITION_TYPE_SYSTEM,
              code: 'charge-master',
            },
            { system: CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM, code: 'self-pay' },
          ],
          versionId: 'some-version',
        },
      };
      const updatedResource = {
        ...existingResource,
        title: 'Fun ny T3s! n4me __',
        url: 'urn:uuid:charge-master:fun-ny-t3s-n4me',
        meta: {
          tag: existingResource.meta?.tag,
        },
      };
      const oystehr = {
        fhir: {
          update: vi.fn().mockResolvedValueOnce(updatedResource),
        },
      } as unknown as Oystehr;
      const result = await performEffect(oystehr, params, { definition: existingResource });
      expect(result).toEqual({
        id: 'some-uuid',
        type: 'charge-master',
        name: 'Fun ny T3s! n4me __',
        description: 'test description',
        default: 'self-pay',
        effectiveDate: '2026-01-01',
        status: 'active',
        procedureCodes: [{ code: '77777', amount: 10 }],
      });
      expect(oystehr.fhir.update).toHaveBeenCalledWith(updatedResource, { optimisticLockingVersionId: 'some-version' });
    });
    it('updates CID with maximal input', async () => {
      const params: UpdateChargeItemDefinitionParams = {
        type: 'charge-master',
        chargeItemDefinitionId: '565e1b1a-a48f-4c0b-9192-60f5b0cec59c',
        name: 'Fun ny T3s! n4me __',
        description: 'fun D3scription',
        default: 'insurance',
        effectiveDate: '2027-01-01',
        status: 'retired',
        procedureCodes: [
          {
            code: '90101',
            amount: 25.15,
          },
          {
            code: '10109',
            modifier: '22',
            amount: 5,
          },
        ],
        secrets: {},
      };
      const existingResource: ChargeItemDefinition = {
        resourceType: 'ChargeItemDefinition',
        id: 'some-uuid',
        title: 'test',
        status: 'active',
        url: 'urn:uuid:charge-master:test',
        date: '2026-01-01',
        description: 'test description',
        propertyGroup: [
          {
            priceComponent: [
              {
                type: 'base',
                code: {
                  coding: [
                    {
                      system: CPT_CODE_SYSTEM,
                      code: '77777',
                    },
                  ],
                },
                amount: {
                  value: 10,
                  currency: 'USD',
                },
              },
            ],
          },
        ],
        meta: {
          tag: [
            {
              system: CHARGE_ITEM_DEFINITION_TYPE_SYSTEM,
              code: 'charge-master',
            },
            { system: CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM, code: 'self-pay' },
          ],
          versionId: 'some-version',
        },
      };
      const updatedResource: ChargeItemDefinition = {
        ...existingResource,
        title: 'Fun ny T3s! n4me __',
        url: 'urn:uuid:charge-master:fun-ny-t3s-n4me',
        description: 'fun D3scription',
        date: '2027-01-01',
        status: 'retired',
        propertyGroup: [
          {
            priceComponent: [
              {
                type: 'base',
                code: {
                  coding: [
                    {
                      system: CPT_CODE_SYSTEM,
                      code: '90101',
                    },
                  ],
                },
                amount: {
                  value: 25.15,
                  currency: 'USD',
                },
              },
            ],
          },
          {
            priceComponent: [
              {
                type: 'base',
                code: {
                  coding: [
                    {
                      system: CPT_CODE_SYSTEM,
                      code: '10109',
                    },
                  ],
                },
                extension: [
                  {
                    url: CPT_MODIFIER_EXTENSION_URL,
                    valueCode: '22',
                  },
                ],
                amount: {
                  value: 5,
                  currency: 'USD',
                },
              },
            ],
          },
        ],
        meta: {
          tag: [
            {
              system: CHARGE_ITEM_DEFINITION_TYPE_SYSTEM,
              code: 'charge-master',
            },
            { system: CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM, code: 'insurance' },
          ],
        },
      };
      const oystehr = {
        fhir: {
          update: vi.fn().mockResolvedValueOnce(updatedResource),
        },
      } as unknown as Oystehr;
      const result = await performEffect(oystehr, params, { definition: existingResource });
      expect(result).toEqual({
        id: 'some-uuid',
        type: 'charge-master',
        name: 'Fun ny T3s! n4me __',
        description: 'fun D3scription',
        effectiveDate: '2027-01-01',
        status: 'retired',
        default: 'insurance',
        procedureCodes: [
          { code: '90101', amount: 25.15 },
          { code: '10109', modifier: '22', amount: 5 },
        ],
      });
      expect(oystehr.fhir.update).toHaveBeenCalledWith(updatedResource, { optimisticLockingVersionId: 'some-version' });
    });
    it('updates CID with only removing optional fields input', async () => {
      const params: UpdateChargeItemDefinitionParams = {
        type: 'charge-master',
        chargeItemDefinitionId: '565e1b1a-a48f-4c0b-9192-60f5b0cec59c',
        description: null,
        default: null,
        effectiveDate: null,
        secrets: {},
      };
      const existingResource: ChargeItemDefinition = {
        resourceType: 'ChargeItemDefinition',
        id: 'some-uuid',
        title: 'test',
        status: 'active',
        url: 'urn:uuid:charge-master:test',
        date: '2026-01-01',
        description: 'test description',
        propertyGroup: [
          {
            priceComponent: [
              {
                type: 'base',
                code: {
                  coding: [
                    {
                      system: CPT_CODE_SYSTEM,
                      code: '77777',
                    },
                  ],
                },
                amount: {
                  value: 10,
                  currency: 'USD',
                },
              },
            ],
          },
        ],
        meta: {
          tag: [
            {
              system: CHARGE_ITEM_DEFINITION_TYPE_SYSTEM,
              code: 'charge-master',
            },
            { system: CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM, code: 'self-pay' },
          ],
          versionId: 'some-version',
        },
      };
      const updatedResource: ChargeItemDefinition = {
        ...existingResource,
        description: undefined,
        date: undefined,
        meta: {
          tag: [
            {
              system: CHARGE_ITEM_DEFINITION_TYPE_SYSTEM,
              code: 'charge-master',
            },
          ],
        },
      };
      const oystehr = {
        fhir: {
          update: vi.fn().mockResolvedValueOnce(updatedResource),
        },
      } as unknown as Oystehr;
      const result = await performEffect(oystehr, params, { definition: existingResource });
      expect(result).toEqual({
        id: 'some-uuid',
        type: 'charge-master',
        name: 'test',
        status: 'active',
        procedureCodes: [{ code: '77777', amount: 10 }],
      });
      expect(oystehr.fhir.update).toHaveBeenCalledWith(updatedResource, { optimisticLockingVersionId: 'some-version' });
    });
  });
});
