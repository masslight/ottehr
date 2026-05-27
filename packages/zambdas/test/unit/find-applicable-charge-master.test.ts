import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub shared module so the handler can be imported without real secrets/auth
// Note: vi.mock is hoisted, so we must inline the constant rather than referencing a variable.
vi.mock('../../src/shared', () => ({
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  createOystehrClient: vi.fn(),
  RCM_TAG_SYSTEM: 'https://fhir.zapehr.com/r4/StructureDefinitions/rcm',
  wrapHandler: (_name: string, handler: any) => handler,
  ZambdaInput: {},
}));

const RCM_TAG_SYSTEM = 'https://fhir.zapehr.com/r4/StructureDefinitions/rcm';

import { getPayerUrl } from 'utils';
import { index as _handler } from '../../src/rcm/charge-masters/find-applicable-charge-master/index';
import { createOystehrClient } from '../../src/shared';
import { ZambdaInput } from '../../src/shared/types';

// Our mock replaces wrapHandler so it returns the raw single-arg function, not the 3-arg Lambda handler.
const handler = _handler as unknown as (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

// ---------------------------------------------------------------------------
// Deterministic UUIDs used in place of plain-string IDs so validation passes
// ---------------------------------------------------------------------------
const PAYER_1 = '00000000-0000-4000-8000-000000000001';
const EMPLOYER_1 = '00000000-0000-4000-8000-000000000002';
const EMPLOYER_NO_MATCH = '00000000-0000-4000-8000-000000000003';
const PAYER_UNKNOWN = '00000000-0000-4000-8000-000000000004';
const LOC_1 = '00000000-0000-4000-8000-000000000005';
const LOC_OTHER = '00000000-0000-4000-8000-000000000006';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeChargeMaster(
  overrides: Partial<ChargeItemDefinition> & { id: string; date: string }
): ChargeItemDefinition {
  return {
    resourceType: 'ChargeItemDefinition',
    url: `http://example.com/cm/${overrides.id}`,
    status: 'active',
    ...overrides,
  } as ChargeItemDefinition;
}

function cmWithOrg(
  id: string,
  orgRef: string,
  date: string,
  extra?: Partial<ChargeItemDefinition>
): ChargeItemDefinition {
  return makeChargeMaster({
    id,
    date,
    useContext: [{ code: { code: 'payer' }, valueReference: { reference: orgRef } } as any],
    ...extra,
  });
}

function cmWithOrgAndLocation(id: string, orgRef: string, locationId: string, date: string): ChargeItemDefinition {
  return makeChargeMaster({
    id,
    date,
    useContext: [
      { code: { code: 'payer' }, valueReference: { reference: orgRef } } as any,
      { code: { code: 'venue' }, valueReference: { reference: `Location/${locationId}` } } as any,
    ],
  });
}

function cmDefault(id: string, date: string): ChargeItemDefinition {
  return makeChargeMaster({
    id,
    date,
    meta: {
      tag: [
        { system: RCM_TAG_SYSTEM, code: 'charge-master' },
        { system: RCM_TAG_SYSTEM, code: 'default-insurance' },
      ],
    },
  });
}

function cmSelfPay(id: string, date: string): ChargeItemDefinition {
  return makeChargeMaster({
    id,
    date,
    meta: {
      tag: [
        { system: RCM_TAG_SYSTEM, code: 'charge-master' },
        { system: RCM_TAG_SYSTEM, code: 'self-pay' },
      ],
    },
  });
}

function stubSearch(chargeMasters: ChargeItemDefinition[]): void {
  (createOystehrClient as any).mockReturnValue({
    fhir: {
      search: vi.fn().mockResolvedValue({ unbundle: () => chargeMasters }),
    },
  });
}

function makeInput(body: Record<string, any>): any {
  return { body: JSON.stringify(body), headers: null, secrets: { FHIR_API: 'x', PROJECT_API: 'x' } } as any;
}

function parseBody(result: any): any {
  return JSON.parse(result.body);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('find-applicable-charge-master', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Employer-specific
  // -----------------------------------------------------------------------
  describe('employer-specific resolution', () => {
    it('returns employer-specific charge master when employer matches', async () => {
      const cm = cmWithOrg('cm-emp', `Organization/${EMPLOYER_1}`, '2025-01-01');
      stubSearch([cm]);

      const result = await handler(makeInput({ employerOrganizationId: EMPLOYER_1, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      expect(result.statusCode).toBe(200);
      expect(body.source).toBe('employer-specific');
      expect(body.chargeMaster.id).toBe('cm-emp');
    });

    it('prefers employer over payer when both are provided', async () => {
      const cmEmp = cmWithOrg('cm-emp', `Organization/${EMPLOYER_1}`, '2025-01-01');
      const cmPayer = cmWithOrg('cm-payer', getPayerUrl(PAYER_1), '2025-01-01');
      stubSearch([cmEmp, cmPayer]);

      const result = await handler(
        makeInput({
          employerOrganizationId: EMPLOYER_1,
          payerOrganizationId: PAYER_1,
          dateOfService: '2025-06-01',
        })
      );

      const body = parseBody(result);
      expect(body.source).toBe('employer-specific');
      expect(body.chargeMaster.id).toBe('cm-emp');
    });

    it('falls back to payer when employer has no match', async () => {
      const cmPayer = cmWithOrg('cm-payer', getPayerUrl(PAYER_1), '2025-01-01');
      stubSearch([cmPayer]);

      const result = await handler(
        makeInput({
          employerOrganizationId: EMPLOYER_NO_MATCH,
          payerOrganizationId: PAYER_1,
          dateOfService: '2025-06-01',
        })
      );

      const body = parseBody(result);
      expect(body.source).toBe('payer-specific');
      expect(body.chargeMaster.id).toBe('cm-payer');
    });
  });

  // -----------------------------------------------------------------------
  // Payer (insurance)-specific
  // -----------------------------------------------------------------------
  describe('payer-specific resolution', () => {
    it('returns payer-specific charge master', async () => {
      const cm = cmWithOrg('cm-payer', getPayerUrl(PAYER_1), '2025-01-01');
      stubSearch([cm]);

      const result = await handler(makeInput({ payerOrganizationId: PAYER_1, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      expect(body.source).toBe('payer-specific');
      expect(body.chargeMaster.id).toBe('cm-payer');
    });

    it('selects the most recent effective date on or before dateOfService', async () => {
      const cmOld = cmWithOrg('cm-old', getPayerUrl(PAYER_1), '2024-01-01');
      const cmRecent = cmWithOrg('cm-recent', getPayerUrl(PAYER_1), '2025-03-01');
      const cmFuture = cmWithOrg('cm-future', getPayerUrl(PAYER_1), '2025-07-01');
      stubSearch([cmOld, cmRecent, cmFuture]);

      const result = await handler(makeInput({ payerOrganizationId: PAYER_1, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      expect(body.chargeMaster.id).toBe('cm-recent');
    });

    it('ignores inactive charge masters', async () => {
      const cmInactive = cmWithOrg('cm-inactive', getPayerUrl(PAYER_1), '2025-01-01', { status: 'retired' });
      const cmActive = cmWithOrg('cm-active', getPayerUrl(PAYER_1), '2024-06-01');
      stubSearch([cmInactive, cmActive]);

      const result = await handler(makeInput({ payerOrganizationId: PAYER_1, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      expect(body.chargeMaster.id).toBe('cm-active');
    });
  });

  // -----------------------------------------------------------------------
  // Default insurance fallback
  // -----------------------------------------------------------------------
  describe('default-insurance fallback', () => {
    it('falls back to default-insurance when payer has no specific match', async () => {
      const cmDefault1 = cmDefault('cm-default', '2025-01-01');
      stubSearch([cmDefault1]);

      const result = await handler(makeInput({ payerOrganizationId: PAYER_UNKNOWN, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      expect(body.source).toBe('default-insurance');
      expect(body.chargeMaster.id).toBe('cm-default');
    });

    it('falls back to default-insurance when employer has no specific match and no payer match', async () => {
      const cmDef = cmDefault('cm-default', '2025-01-01');
      stubSearch([cmDef]);

      const result = await handler(
        makeInput({
          employerOrganizationId: EMPLOYER_NO_MATCH,
          payerOrganizationId: PAYER_UNKNOWN,
          dateOfService: '2025-06-01',
        })
      );

      const body = parseBody(result);
      expect(body.source).toBe('default-insurance');
    });
  });

  // -----------------------------------------------------------------------
  // Self-pay
  // -----------------------------------------------------------------------
  describe('self-pay resolution', () => {
    it('returns self-pay when no payer or employer is provided', async () => {
      const cm = cmSelfPay('cm-selfpay', '2025-01-01');
      stubSearch([cm]);

      const result = await handler(makeInput({ dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      expect(body.source).toBe('self-pay');
      expect(body.chargeMaster.id).toBe('cm-selfpay');
    });

    it('does NOT return self-pay when a payer is provided but has no match', async () => {
      const cm = cmSelfPay('cm-selfpay', '2025-01-01');
      stubSearch([cm]);

      const result = await handler(makeInput({ payerOrganizationId: PAYER_UNKNOWN, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      // Self-pay is only for when no payer/employer at all; should fall to default-insurance or null
      expect(body.source).not.toBe('self-pay');
    });
  });

  // -----------------------------------------------------------------------
  // Location filtering
  // -----------------------------------------------------------------------
  describe('location filtering', () => {
    it('prefers location-specific charge master over general', async () => {
      const cmGeneral = cmWithOrg('cm-general', getPayerUrl(PAYER_1), '2025-01-01');
      const cmLocation = cmWithOrgAndLocation('cm-loc', getPayerUrl(PAYER_1), LOC_1, '2025-01-01');
      stubSearch([cmGeneral, cmLocation]);

      const result = await handler(
        makeInput({ payerOrganizationId: PAYER_1, dateOfService: '2025-06-01', locationId: LOC_1 })
      );

      const body = parseBody(result);
      expect(body.chargeMaster.id).toBe('cm-loc');
    });

    it('falls back to charge master with no location when locationId does not match', async () => {
      const cmGeneral = cmWithOrg('cm-general', getPayerUrl(PAYER_1), '2025-01-01');
      const cmOtherLoc = cmWithOrgAndLocation('cm-other-loc', getPayerUrl(PAYER_1), LOC_OTHER, '2025-01-01');
      stubSearch([cmGeneral, cmOtherLoc]);

      const result = await handler(
        makeInput({ payerOrganizationId: PAYER_1, dateOfService: '2025-06-01', locationId: LOC_1 })
      );

      const body = parseBody(result);
      // cm-general has no location associations, so it's the fallback
      expect(body.chargeMaster.id).toBe('cm-general');
    });

    it('returns null when locationId is provided but only location-specific CMs exist for other locations', async () => {
      const cmOtherLoc = cmWithOrgAndLocation('cm-other-loc', getPayerUrl(PAYER_1), LOC_OTHER, '2025-01-01');
      stubSearch([cmOtherLoc]);

      const result = await handler(
        makeInput({ payerOrganizationId: PAYER_1, dateOfService: '2025-06-01', locationId: LOC_1 })
      );

      const body = parseBody(result);
      // No location match and no fallback without location — goes to default-insurance or null
      expect(body.chargeMaster).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // No match at all
  // -----------------------------------------------------------------------
  describe('no match', () => {
    it('returns null when no charge masters exist', async () => {
      stubSearch([]);

      const result = await handler(makeInput({ payerOrganizationId: PAYER_1, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      expect(body.chargeMaster).toBeNull();
      expect(body.source).toBeNull();
    });

    it('returns null when all charge masters are in the future', async () => {
      const cmFuture = cmWithOrg('cm-future', getPayerUrl(PAYER_1), '2026-01-01');
      stubSearch([cmFuture]);

      const result = await handler(makeInput({ payerOrganizationId: PAYER_1, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      expect(body.chargeMaster).toBeNull();
      expect(body.source).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Non-UUID payer IDs (Oystehr RCM API payer IDs)
  // -----------------------------------------------------------------------
  describe('non-UUID payer ID support', () => {
    it('accepts a non-UUID alphanumeric payer ID and matches via payer URL', async () => {
      const payerId = '60054';
      const cm = cmWithOrg('cm-rcm-payer', getPayerUrl(payerId), '2025-01-01');
      stubSearch([cm]);

      const result = await handler(makeInput({ payerOrganizationId: payerId, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      expect(result.statusCode).toBe(200);
      expect(body.source).toBe('payer-specific');
      expect(body.chargeMaster.id).toBe('cm-rcm-payer');
    });

    it('accepts an alphanumeric payer ID with letters', async () => {
      const payerId = 'J1859';
      const cm = cmWithOrg('cm-alpha-payer', getPayerUrl(payerId), '2025-01-01');
      stubSearch([cm]);

      const result = await handler(makeInput({ payerOrganizationId: payerId, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      expect(result.statusCode).toBe(200);
      expect(body.source).toBe('payer-specific');
      expect(body.chargeMaster.id).toBe('cm-alpha-payer');
    });
  });
});
