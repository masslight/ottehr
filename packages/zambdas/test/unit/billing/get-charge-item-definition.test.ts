import Oystehr from '@oystehr/sdk';
import { ChargeItemDefinition } from 'fhir/r4b';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { vi } from 'vitest';
import { performEffect } from '../../../src/billing/get-charge-item-definition/index';
import {
  GetChargeItemDefinitionParams,
  validateRequestParameters,
} from '../../../src/billing/get-charge-item-definition/validateRequestParameters';
import { CHARGE_ITEM_DEFINITION_TYPE_SYSTEM } from '../../../src/billing/shared';

describe('get-charge-item-definition', () => {
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
        expect.objectContaining(INVALID_INPUT_ERROR('Validation error: Required at "type"; Required at "id"'))
      );
    });
    it('throws validation error on invalid param types', async () => {
      const body = {
        type: 'purple-people-eater',
        id: 'some-not-uuid',
      };
      expect(() => validateRequestParameters({ headers: null, body: JSON.stringify(body), secrets: {} })).toThrow(
        expect.objectContaining(
          INVALID_INPUT_ERROR(
            "Validation error: Invalid enum value. Expected 'charge-master' | 'fee-schedule', received 'purple-people-eater' at \"type\"; Invalid uuid at \"id\""
          )
        )
      );
    });
    it('succeeds with correct input', async () => {
      const body = { type: 'charge-master', id: '0f8a9b3c-fd93-42a1-8560-6ca4bc9446c9' };
      const input = validateRequestParameters({
        headers: null,
        body: JSON.stringify(body),
        secrets: {},
      });
      expect(input).toStrictEqual({ type: 'charge-master', id: '0f8a9b3c-fd93-42a1-8560-6ca4bc9446c9', secrets: {} });
    });
  });
  describe('performEffect', () => {
    it('throws validation error on mismatched type and id', async () => {
      const params: GetChargeItemDefinitionParams = {
        type: 'charge-master',
        id: '0f8a9b3c-fd93-42a1-8560-6ca4bc9446c9',
        secrets: {},
      };
      const oystehr = {
        fhir: {
          search: vi.fn().mockResolvedValueOnce({ unbundle: () => [] }),
        },
      } as unknown as Oystehr;
      await expect(async () => performEffect(oystehr, params)).rejects.toThrow(
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
    it('gets cid', async () => {
      const params: GetChargeItemDefinitionParams = {
        type: 'charge-master',
        id: '0f8a9b3c-fd93-42a1-8560-6ca4bc9446c9',
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
      const result = await performEffect(oystehr, params);
      expect(result).toEqual(completeResource);
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
});
