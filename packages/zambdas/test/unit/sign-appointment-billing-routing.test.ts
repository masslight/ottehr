import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { FOLLOWUP_SYSTEMS } from 'utils/lib/fhir/encounter';
import { RoleType } from 'utils/lib/types/api/user.types';
import { TaskIndicator } from 'utils/lib/types/common';
import { PRACTITIONER_CODINGS } from 'utils/lib/types/data/appointments/appointments.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../src/ehr/sign-appointment/index';
import { CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM } from '../../src/shared/candid';
import { sendErrors } from '../../src/shared/errors';
import { FullAppointmentResourcePackage } from '../../src/shared/pdf/visit-details-pdf/types';

const { getUser, getPractitionerRoles, getVisit } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getPractitionerRoles: vi.fn(),
  getVisit: vi.fn(),
}));
vi.mock('../../src/shared/auth', async (original) => ({
  ...(await original<object>()),
  getUser,
  getPractitionerRoles,
}));
vi.mock('../../src/shared/pdf/visit-details-pdf/get-video-resources', () => ({
  getAppointmentAndRelatedResources: getVisit,
}));
vi.mock('utils/lib/ottehr-config/feature-flags', () => ({
  FEATURE_FLAGS_CONFIG: { nonInsuranceOrganizationsEnabled: false },
}));

vi.mock('../../src/shared/errors', () => ({ sendErrors: vi.fn().mockResolvedValue(undefined) }));

const appointmentId = '00fb4bbf-dafe-41ee-8e4c-82c96be32f78';
const encounterId = '0a5aff96-d166-4900-833b-cde74c62249a';
const client = {
  fhir: { create: vi.fn<(task: Task) => Promise<Task>>(), transaction: vi.fn() },
  zambda: { execute: vi.fn() },
};
let visit: FullAppointmentResourcePackage;
const sign = (billingIntegration?: string): ReturnType<typeof performEffect> =>
  performEffect(client as unknown as Oystehr, {
    appointmentId,
    encounterId,
    userToken: 'token',
    timezone: null,
    secrets: billingIntegration ? { BILLING_INTEGRATION: billingIntegration } : {},
  });
const createdTaskCodes = (): (string | undefined)[] =>
  client.fhir.create.mock.calls.map(([task]) => task.code?.coding?.[0]?.code);

describe('sign-appointment billing routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ profile: 'Practitioner/provider-1', roles: [{ name: RoleType.Provider }] });
    getPractitionerRoles.mockResolvedValue([RoleType.Provider]);
    client.fhir.create.mockImplementation(async (task: Task) => ({ ...task, id: 'task-1' }));
    client.fhir.transaction.mockResolvedValue({});
    client.zambda.execute.mockResolvedValue({ output: { taskId: 'billing-task-1' } });
    visit = {
      appointment: { resourceType: 'Appointment', id: appointmentId, status: 'arrived', participant: [] },
      encounter: {
        resourceType: 'Encounter',
        id: encounterId,
        status: 'in-progress',
        class: { code: 'AMB' },
        subject: { reference: 'Patient/patient-1' },
        participant: [
          {
            type: [{ coding: PRACTITIONER_CODINGS.Attender }],
            individual: { reference: 'Practitioner/provider-1' },
          },
        ],
      },
      patient: { resourceType: 'Patient', id: 'patient-1', name: [{ given: ['Jane'], family: 'Doe' }] },
      timezone: 'America/New_York',
      listResources: [],
    };
    getVisit.mockResolvedValue(visit);
  });

  it.each([
    [undefined, true, false],
    ['candid', true, false],
    ['ottehr', false, true],
    ['all', true, true],
  ] as const)('routes BILLING_INTEGRATION=%s to its enabled integrations', async (integration, candid, billing) => {
    await sign(integration);
    expect(createdTaskCodes().filter((code) => code === TaskIndicator.sendClaim.code)).toHaveLength(candid ? 1 : 0);
    expect(createdTaskCodes()).toContain(TaskIndicator.visitNotePDFAndEmail.code);
    expect(client.zambda.execute).toHaveBeenCalledTimes(billing ? 1 : 0);
    if (billing) {
      expect(client.zambda.execute).toHaveBeenCalledWith({ id: 'create-billing-claim-task', encounterId });
    }
  });

  it('still queues billing when the encounter already has a Candid claim', async () => {
    visit.encounter.identifier = [{ system: CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM, value: 'candid-claim-1' }];
    await sign('all');
    expect(client.zambda.execute).toHaveBeenCalledWith({ id: 'create-billing-claim-task', encounterId });
  });

  it('still starts billing task creation if creating the Candid task fails', async () => {
    const error = INVALID_INPUT_ERROR('Candid task could not be created');
    client.fhir.create.mockRejectedValueOnce(error);
    await expect(sign('all')).rejects.toEqual(error);
    expect(client.zambda.execute).toHaveBeenCalledWith({ id: 'create-billing-claim-task', encounterId });
    expect(createdTaskCodes()).toContain(TaskIndicator.visitNotePDFAndEmail.code);
  });

  it('reports a billing enqueue failure while still creating the clinical tasks', async () => {
    const error = INVALID_INPUT_ERROR('Billing task could not be created');
    client.zambda.execute.mockRejectedValueOnce(error);
    await expect(sign('all')).resolves.toBeDefined();
    expect(sendErrors).toHaveBeenCalledWith(error, '', expect.objectContaining({ encounterId }));
    expect(createdTaskCodes()).toEqual([TaskIndicator.sendClaim.code, TaskIndicator.visitNotePDFAndEmail.code]);
  });

  it('keeps annotation follow-ups limited to the visit-note task', async () => {
    visit.encounter.type = [{ coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }] }];
    await sign('all');
    expect(createdTaskCodes()).toEqual([TaskIndicator.visitNotePDFAndEmail.code]);
    expect(client.zambda.execute).not.toHaveBeenCalled();
  });
});
