import Oystehr from '@oystehr/sdk';
import { ChargeItemDefinition } from 'fhir/r4b';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { vi } from 'vitest';
import { performEffect } from '../../../src/billing/create-charge-item-definition/index';
import {
  CreateChargeItemDefinitionParams,
  validateRequestParameters,
} from '../../../src/billing/create-charge-item-definition/validateRequestParameters';
import { CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM, CHARGE_ITEM_DEFINITION_TYPE_SYSTEM } from '../../../src/billing/shared';

describe('create-charge-item-definition', () => {
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
        expect.objectContaining(INVALID_INPUT_ERROR('Validation error: Required at "type"; Required at "name"'))
      );
    });
    it('throws validation error on invalid enums', async () => {
      const body = {
        type: 'purple-people-eater',
        name: 'test',
        default: 'loan',
      };
      expect(() => validateRequestParameters({ headers: null, body: JSON.stringify(body), secrets: {} })).toThrow(
        expect.objectContaining(
          INVALID_INPUT_ERROR(
            "Validation error: Invalid enum value. Expected 'charge-master' | 'fee-schedule', received 'purple-people-eater' at \"type\"; Invalid enum value. Expected 'insurance' | 'self-pay', received 'loan' at \"default\""
          )
        )
      );
    });
    it('succeeds with minimal input', async () => {
      const body = { type: 'charge-master', name: 'test' };
      const input = validateRequestParameters({
        headers: null,
        body: JSON.stringify(body),
        secrets: {},
      });
      expect(input).toStrictEqual({ type: 'charge-master', name: 'test', secrets: {} });
    });
    it('succeeds with maximal input', async () => {
      const body = {
        type: 'charge-master',
        name: 'test',
        effectiveDate: '2026-01-01',
        description: 'test description',
        default: 'insurance',
      };
      const input = validateRequestParameters({
        headers: null,
        body: JSON.stringify(body),
        secrets: {},
      });
      expect(input).toStrictEqual({
        type: 'charge-master',
        name: 'test',
        effectiveDate: '2026-01-01',
        description: 'test description',
        default: 'insurance',
        secrets: {},
      });
    });
  });
  describe('performEffect', () => {
    it('creates CID with minimal input and name with special characters', async () => {
      const params: CreateChargeItemDefinitionParams = {
        type: 'charge-master',
        name: 'Fun ny T3s! n4me __',
        secrets: {},
      };
      const completeResource: ChargeItemDefinition = {
        resourceType: 'ChargeItemDefinition',
        id: 'some-uuid',
        title: 'Fun ny T3s! n4me __',
        status: 'active',
        url: 'urn:uuid:charge-master:fun-ny-t3s-n4me',
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
          create: vi.fn().mockResolvedValueOnce(completeResource),
        },
      } as unknown as Oystehr;
      const result = await performEffect(oystehr, params);
      expect(result).toEqual({
        id: 'some-uuid',
        type: 'charge-master',
        name: 'Fun ny T3s! n4me __',
        status: 'active',
        procedureCodes: [],
      });
      expect(oystehr.fhir.create).toHaveBeenCalledWith({ ...completeResource, id: undefined });
    });
    it('creates CID with maximal input', async () => {
      const params: CreateChargeItemDefinitionParams = {
        type: 'charge-master',
        name: 'test',
        effectiveDate: '2026-01-01',
        description: 'test description',
        default: 'self-pay',
        secrets: {},
      };
      const completeResource: ChargeItemDefinition = {
        resourceType: 'ChargeItemDefinition',
        id: 'some-uuid',
        title: 'test',
        description: 'test description',
        status: 'active',
        date: '2026-01-01',
        url: 'urn:uuid:charge-master:test',
        meta: {
          tag: [
            {
              system: CHARGE_ITEM_DEFINITION_TYPE_SYSTEM,
              code: 'charge-master',
            },
            { system: CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM, code: 'self-pay' },
          ],
        },
      };
      const oystehr = {
        fhir: {
          create: vi.fn().mockResolvedValueOnce(completeResource),
        },
      } as unknown as Oystehr;
      const result = await performEffect(oystehr, params);
      expect(result).toEqual({
        id: 'some-uuid',
        type: 'charge-master',
        name: 'test',
        description: 'test description',
        status: 'active',
        effectiveDate: '2026-01-01',
        default: 'self-pay',
        procedureCodes: [],
      });
      expect(oystehr.fhir.create).toHaveBeenCalledWith({ ...completeResource, id: undefined });
    });
  });
});
