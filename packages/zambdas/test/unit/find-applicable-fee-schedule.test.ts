import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub shared module
// Note: vi.mock is hoisted, so we must inline the constant rather than referencing a variable.
vi.mock('../../src/shared', () => ({
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  createOystehrClient: vi.fn(),
  RCM_TAG_SYSTEM: 'https://fhir.zapehr.com/r4/StructureDefinitions/rcm',
  wrapHandler: (_name: string, handler: any) => handler,
  ZambdaInput: {},
}));

import { getPayerUrl } from 'utils';
import { index as _handler } from '../../src/rcm/fee-schedules/find-applicable-fee-schedule/index';
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
const OTHER_PAYER = '00000000-0000-4000-8000-000000000007';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeFeeSchedule(
  overrides: Partial<ChargeItemDefinition> & { id: string; date: string }
): ChargeItemDefinition {
  return {
    resourceType: 'ChargeItemDefinition',
    url: `http://example.com/fs/${overrides.id}`,
    status: 'active',
    ...overrides,
  } as ChargeItemDefinition;
}

function fsWithOrg(
  id: string,
  orgId: string,
  date: string,
  extra?: Partial<ChargeItemDefinition>
): ChargeItemDefinition {
  return makeFeeSchedule({
    id,
    date,
    useContext: [{ code: { code: 'payer' }, valueReference: { reference: getPayerUrl(orgId) } } as any],
    ...extra,
  });
}

function fsWithOrgAndLocation(id: string, orgId: string, locationId: string, date: string): ChargeItemDefinition {
  return makeFeeSchedule({
    id,
    date,
    useContext: [
      { code: { code: 'payer' }, valueReference: { reference: getPayerUrl(orgId) } } as any,
      { code: { code: 'venue' }, valueReference: { reference: `Location/${locationId}` } } as any,
    ],
  });
}

function stubSearch(feeSchedules: ChargeItemDefinition[]): void {
  (createOystehrClient as any).mockReturnValue({
    fhir: {
      search: vi.fn().mockResolvedValue({ unbundle: () => feeSchedules }),
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
describe('find-applicable-fee-schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Employer-specific
  // -----------------------------------------------------------------------
  describe('employer-specific resolution', () => {
    it('returns employer-specific fee schedule when employer matches', async () => {
      const fs = fsWithOrg('fs-emp', EMPLOYER_1, '2025-01-01');
      stubSearch([fs]);

      const result = await handler(makeInput({ employerOrganizationId: EMPLOYER_1, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      expect(result.statusCode).toBe(200);
      expect(body.feeSchedule.id).toBe('fs-emp');
    });

    it('prefers employer over payer when both are provided', async () => {
      const fsEmp = fsWithOrg('fs-emp', EMPLOYER_1, '2025-01-01');
      const fsPayer = fsWithOrg('fs-payer', PAYER_1, '2025-01-01');
      stubSearch([fsEmp, fsPayer]);

      const result = await handler(
        makeInput({
          employerOrganizationId: EMPLOYER_1,
          payerOrganizationId: PAYER_1,
          dateOfService: '2025-06-01',
        })
      );

      const body = parseBody(result);
      expect(body.feeSchedule.id).toBe('fs-emp');
    });

    it('falls back to payer when employer has no match', async () => {
      const fsPayer = fsWithOrg('fs-payer', PAYER_1, '2025-01-01');
      stubSearch([fsPayer]);

      const result = await handler(
        makeInput({
          employerOrganizationId: EMPLOYER_NO_MATCH,
          payerOrganizationId: PAYER_1,
          dateOfService: '2025-06-01',
        })
      );

      const body = parseBody(result);
      expect(body.feeSchedule.id).toBe('fs-payer');
    });
  });

  // -----------------------------------------------------------------------
  // Payer (insurance)-specific
  // -----------------------------------------------------------------------
  describe('payer-specific resolution', () => {
    it('returns payer-specific fee schedule', async () => {
      const fs = fsWithOrg('fs-payer', PAYER_1, '2025-01-01');
      stubSearch([fs]);

      const result = await handler(makeInput({ payerOrganizationId: PAYER_1, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      expect(body.feeSchedule.id).toBe('fs-payer');
    });

    it('selects the most recent effective date on or before dateOfService', async () => {
      const fsOld = fsWithOrg('fs-old', PAYER_1, '2024-01-01');
      const fsRecent = fsWithOrg('fs-recent', PAYER_1, '2025-03-01');
      const fsFuture = fsWithOrg('fs-future', PAYER_1, '2025-07-01');
      stubSearch([fsOld, fsRecent, fsFuture]);

      const result = await handler(makeInput({ payerOrganizationId: PAYER_1, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      expect(body.feeSchedule.id).toBe('fs-recent');
    });

    it('includes inactive fee schedules for historical lookups', async () => {
      const fsInactive = fsWithOrg('fs-inactive', PAYER_1, '2025-02-01', { status: 'retired' });
      const fsOld = fsWithOrg('fs-old', PAYER_1, '2024-01-01');
      stubSearch([fsInactive, fsOld]);

      const result = await handler(makeInput({ payerOrganizationId: PAYER_1, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      // Unlike charge masters, fee schedules include inactive ones; most recent date wins
      expect(body.feeSchedule.id).toBe('fs-inactive');
    });
  });

  // -----------------------------------------------------------------------
  // Location filtering
  // -----------------------------------------------------------------------
  describe('location filtering', () => {
    it('prefers location-specific fee schedule over general', async () => {
      const fsGeneral = fsWithOrg('fs-general', PAYER_1, '2025-01-01');
      const fsLocation = fsWithOrgAndLocation('fs-loc', PAYER_1, LOC_1, '2025-01-01');
      stubSearch([fsGeneral, fsLocation]);

      const result = await handler(
        makeInput({ payerOrganizationId: PAYER_1, dateOfService: '2025-06-01', locationId: LOC_1 })
      );

      const body = parseBody(result);
      expect(body.feeSchedule.id).toBe('fs-loc');
    });

    it('falls back to fee schedule with no location when locationId does not match', async () => {
      const fsGeneral = fsWithOrg('fs-general', PAYER_1, '2025-01-01');
      const fsOtherLoc = fsWithOrgAndLocation('fs-other-loc', PAYER_1, LOC_OTHER, '2025-01-01');
      stubSearch([fsGeneral, fsOtherLoc]);

      const result = await handler(
        makeInput({ payerOrganizationId: PAYER_1, dateOfService: '2025-06-01', locationId: LOC_1 })
      );

      const body = parseBody(result);
      expect(body.feeSchedule.id).toBe('fs-general');
    });

    it('returns null when only location-specific fee schedules exist for other locations', async () => {
      const fsOtherLoc = fsWithOrgAndLocation('fs-other', PAYER_1, LOC_OTHER, '2025-01-01');
      stubSearch([fsOtherLoc]);

      const result = await handler(
        makeInput({ payerOrganizationId: PAYER_1, dateOfService: '2025-06-01', locationId: LOC_1 })
      );

      const body = parseBody(result);
      expect(body.feeSchedule).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // No defaults / no self-pay (unlike charge masters)
  // -----------------------------------------------------------------------
  describe('no fallback defaults', () => {
    it('returns null when payer has no match (no default-insurance fallback)', async () => {
      const fsOther = fsWithOrg('fs-other', OTHER_PAYER, '2025-01-01');
      stubSearch([fsOther]);

      const result = await handler(makeInput({ payerOrganizationId: PAYER_UNKNOWN, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      expect(body.feeSchedule).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // No match at all
  // -----------------------------------------------------------------------
  describe('no match', () => {
    it('returns null when no fee schedules exist', async () => {
      stubSearch([]);

      const result = await handler(makeInput({ payerOrganizationId: PAYER_1, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      expect(body.feeSchedule).toBeNull();
    });

    it('returns null when all fee schedules are in the future', async () => {
      const fsFuture = fsWithOrg('fs-future', PAYER_1, '2026-01-01');
      stubSearch([fsFuture]);

      const result = await handler(makeInput({ payerOrganizationId: PAYER_1, dateOfService: '2025-06-01' }));

      const body = parseBody(result);
      expect(body.feeSchedule).toBeNull();
    });
  });
});
