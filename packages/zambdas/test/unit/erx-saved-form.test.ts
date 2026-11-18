import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic } from 'fhir/r4b';
import { ErxSavedForm, ErxSavedFormResponse } from 'utils/lib/types/api/erx.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { APIErrorCode, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZambdaInput } from '../../src/shared/types/common';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  search: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  // As auth.ts's own, with the signed-in user mocked (its getUser call is internal to the module).
  requireUserWithRole: async (_token: string, _secrets: unknown, allowed: string[]) => {
    const user = await mocks.getUser();
    if (!user?.roles?.some((role: { name: string }) => allowed.includes(role.name))) throw NOT_AUTHORIZED;
    return user;
  },
}));
vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  createClinicalOystehrClient: vi.fn(() => ({
    fhir: { search: mocks.search, get: mocks.get, create: mocks.create, update: mocks.update, delete: mocks.delete },
  })),
}));
vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

import { index } from '../../src/ehr/erx-saved-form';
import {
  ERX_SAVED_FORM_CODE,
  ERX_SAVED_FORM_SYSTEM,
  makeErxSavedFormBasic,
} from '../../src/ehr/erx-saved-form/helpers';

const INVALID = { code: APIErrorCode.INVALID_INPUT };
const ENCOUNTER_ID = '5f1c3c3e-7a1e-4f3b-9d1e-2a6b8c9d0e1f';
const userWith = (role: RoleType): unknown => ({
  id: 'user-1',
  name: 'jamie@example.com',
  profile: 'Practitioner/prac-1',
  roles: [{ name: role }],
});

const line = (overrides: Record<string, unknown> = {}): ErxSavedForm['lines'][number] => ({
  key: 1,
  drug: null,
  medication: null,
  route: '',
  dose: '',
  frequency: '',
  durationDays: '',
  steps: [],
  instructions: '',
  urgent: false,
  quantityValue: '',
  quantityUnit: '',
  daysSupply: '',
  numberOfRefills: '0',
  substitutionAllowed: true,
  patientInstructions: '',
  noteToPharmacy: '',
  diagnosis: null,
  generated: { patientInstructions: '', quantityValue: '', daysSupply: '' },
  quickPicked: null,
  ...overrides,
});
const amoxicillin = line({
  medication: { ndc: '00093416173', description: 'Amoxicillin 400 mg/5ml Susp', schedule: 0 },
  dose: '5',
});
const form: ErxSavedForm = { pharmacy: null, lines: [amoxicillin] };
const emptyForm: ErxSavedForm = { pharmacy: null, lines: [line()] };

const encounterFound = (found: boolean, saved: Basic[] = []): void => {
  mocks.search.mockImplementation(async ({ resourceType }: { resourceType: string }) => ({
    unbundle: () =>
      resourceType === 'Encounter' ? (found ? [{ resourceType: 'Encounter', id: ENCOUNTER_ID }] : []) : saved,
  }));
};
const savedBasic = (id = 'basic-1'): Basic => ({
  ...makeErxSavedFormBasic(ENCOUNTER_ID, form, { reference: 'Practitioner/prac-2', display: 'Jamie Rivera' }),
  id,
  meta: { lastUpdated: '2026-11-18T17:31:00Z' },
});

const call = async (body: unknown): Promise<ErxSavedFormResponse> => {
  const result = await (index as (input: ZambdaInput) => Promise<APIGatewayProxyResult>)(
    createMockZambdaInput(body, { secrets: createMockSecrets() })
  );
  return JSON.parse(result.body);
};

describe('erx-saved-form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue(userWith(RoleType.Staff));
    mocks.get.mockResolvedValue({
      resourceType: 'Practitioner',
      id: 'prac-1',
      name: [{ given: ['Jamie'], family: 'Rivera' }],
    });
    mocks.create.mockImplementation(async (basic: Basic) => ({ ...basic, id: 'new', meta: { lastUpdated: 'now' } }));
    mocks.update.mockImplementation(async (basic: Basic) => ({ ...basic, meta: { lastUpdated: 'now' } }));
    encounterFound(true);
  });

  describe('validation', () => {
    it('refuses a missing or malformed encounter id', async () => {
      await expect(call({ action: 'get' })).rejects.toMatchObject(INVALID);
      await expect(call({ action: 'get', encounterId: 'Encounter?_id=x' })).rejects.toMatchObject(INVALID);
    });

    it('refuses more than 20 lines, and text past its bound', async () => {
      const lines = Array.from({ length: 21 }, (_, key) => line({ key }));
      await expect(
        call({ action: 'save', encounterId: ENCOUNTER_ID, form: { pharmacy: null, lines } })
      ).rejects.toMatchObject(INVALID);
      const long = { pharmacy: null, lines: [line({ instructions: 'x'.repeat(5001) })] };
      await expect(call({ action: 'save', encounterId: ENCOUNTER_ID, form: long })).rejects.toMatchObject(INVALID);
      expect(mocks.search).not.toHaveBeenCalled();
    });

    it('refuses a line of the wrong shape', async () => {
      const bad = { pharmacy: null, lines: [{ ...line(), steps: 'take it' }] };
      await expect(call({ action: 'save', encounterId: ENCOUNTER_ID, form: bad })).rejects.toMatchObject(INVALID);
    });
  });

  describe('who may save or load (53f)', () => {
    it('refuses Billing Admin before looking anything up', async () => {
      mocks.getUser.mockResolvedValue(userWith(RoleType.BillingAdmin));
      await expect(call({ action: 'save', encounterId: ENCOUNTER_ID, form })).rejects.toEqual(NOT_AUTHORIZED);
      await expect(call({ action: 'get', encounterId: ENCOUNTER_ID })).rejects.toEqual(NOT_AUTHORIZED);
      expect(mocks.search).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
    });

    it('refuses Inactive and a patient', async () => {
      mocks.getUser.mockResolvedValue(userWith(RoleType.Inactive));
      await expect(call({ action: 'get', encounterId: ENCOUNTER_ID })).rejects.toEqual(NOT_AUTHORIZED);
      mocks.getUser.mockResolvedValue({ id: 'u', name: '+15555550123', profile: 'Patient/p', roles: [] });
      await expect(call({ action: 'get', encounterId: ENCOUNTER_ID })).rejects.toEqual(NOT_AUTHORIZED);
    });

    it('lets every chart role save', async () => {
      for (const role of [
        RoleType.Administrator,
        RoleType.Manager,
        RoleType.CustomerSupport,
        RoleType.Staff,
        RoleType.Provider,
        RoleType.Clinician,
      ]) {
        mocks.getUser.mockResolvedValue(userWith(role));
        await expect(call({ action: 'save', encounterId: ENCOUNTER_ID, form })).resolves.toMatchObject({
          saved: { form },
        });
      }
    });

    it('gives a missing visit the same error as a refused role, and saves nothing', async () => {
      mocks.getUser.mockResolvedValue(userWith(RoleType.BillingAdmin));
      const refused = await call({ action: 'get', encounterId: ENCOUNTER_ID }).catch((error) => error);
      mocks.getUser.mockResolvedValue(userWith(RoleType.Staff));
      encounterFound(false, [savedBasic()]);
      const missing = await call({ action: 'get', encounterId: ENCOUNTER_ID }).catch((error) => error);
      const missingSave = await call({ action: 'save', encounterId: ENCOUNTER_ID, form }).catch((error) => error);
      expect(refused).toEqual(NOT_AUTHORIZED);
      expect(missing).toEqual(refused);
      expect(missingSave).toEqual(refused);
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
    });
  });

  describe('save and load', () => {
    it('searches only by the visit and the saved-form code', async () => {
      await call({ action: 'get', encounterId: ENCOUNTER_ID });
      expect(mocks.search).toHaveBeenCalledWith({
        resourceType: 'Basic',
        params: [
          { name: 'subject', value: `Encounter/${ENCOUNTER_ID}` },
          { name: 'code', value: `${ERX_SAVED_FORM_SYSTEM}|${ERX_SAVED_FORM_CODE}` },
        ],
      });
    });

    it('loads the saved form with who saved it and when', async () => {
      encounterFound(true, [savedBasic()]);
      await expect(call({ action: 'get', encounterId: ENCOUNTER_ID })).resolves.toEqual({
        saved: { form, savedBy: 'Jamie Rivera', savedAt: '2026-11-18T17:31:00Z' },
      });
    });

    it('says none when the visit has no saved form', async () => {
      await expect(call({ action: 'get', encounterId: ENCOUNTER_ID })).resolves.toEqual({ saved: null });
    });

    it('saves a new form as a Basic about the visit, by whoever saved, unfinished lines and all', async () => {
      const unfinished: ErxSavedForm = { pharmacy: null, lines: [amoxicillin, line({ key: 2 })] };
      const response = await call({ action: 'save', encounterId: ENCOUNTER_ID, form: unfinished });
      const created = mocks.create.mock.calls[0][0] as Basic;
      expect(created.resourceType).toBe('Basic');
      expect(created.subject).toEqual({ reference: `Encounter/${ENCOUNTER_ID}` });
      expect(created.author).toEqual({ reference: 'Practitioner/prac-1', display: 'Jamie Rivera' });
      expect(response.saved?.form).toEqual(unfinished);
      expect(response.saved?.savedBy).toBe('Jamie Rivera');
    });

    it("keeps a line's schedule, so the controlled-drug block still applies", async () => {
      const controlled = line({ medication: { ndc: '1', description: 'Methylphenidate 10 mg Tab', schedule: 2 } });
      const response = await call({
        action: 'save',
        encounterId: ENCOUNTER_ID,
        form: { pharmacy: null, lines: [controlled] },
      });
      expect(response.saved?.form.lines[0].medication).toMatchObject({ schedule: 2 });
    });

    it('replaces the saved form', async () => {
      encounterFound(true, [savedBasic()]);
      await call({ action: 'save', encounterId: ENCOUNTER_ID, form });
      expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'basic-1', resourceType: 'Basic' }));
      expect(mocks.create).not.toHaveBeenCalled();
    });

    it('removes the saved form when an empty form is saved', async () => {
      encounterFound(true, [savedBasic()]);
      await expect(call({ action: 'save', encounterId: ENCOUNTER_ID, form: emptyForm })).resolves.toEqual({
        saved: null,
      });
      expect(mocks.delete).toHaveBeenCalledWith({ resourceType: 'Basic', id: 'basic-1' });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
    });

    it('keeps a form with only a pharmacy', async () => {
      const pharmacy = { ncpdpId: '1234567', npi: '1', name: 'CVS', phone: '5555550100', address: '1 Main St' };
      await call({ action: 'save', encounterId: ENCOUNTER_ID, form: { pharmacy, lines: [line()] } });
      expect(mocks.create).toHaveBeenCalled();
    });
  });
});
