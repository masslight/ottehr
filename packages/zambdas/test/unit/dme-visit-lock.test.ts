import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, DeviceRequest, Encounter, FhirResource, Patient, Practitioner, Task } from 'fhir/r4b';
import { EASY_CHART_VISIT_LOCKED_MESSAGE } from 'utils/lib/easy-chart/access';
import { APPOINTMENT_LOCKED_META_TAG, ENCOUNTER_LOCKED_META_TAG } from 'utils/lib/fhir/constants';
import { FOLLOWUP_SYSTEMS } from 'utils/lib/fhir/encounter';
import { Secrets } from 'utils/lib/secrets';
import { DME_TASK, DmeOrderFieldsSchema } from 'utils/lib/types/api/dme.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const { mockOystehr } = vi.hoisted(() => ({
  mockOystehr: { fhir: { search: vi.fn(), get: vi.fn(), transaction: vi.fn() } },
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createClinicalOystehrClient: vi.fn(() => mockOystehr),
}));
vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('m2m-token'),
}));
vi.mock('utils/lib/auth/user-me.helper', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  userMe: vi.fn().mockResolvedValue({ profile: 'Practitioner/22222222-2222-4222-8222-222222222222' }),
}));

import { index as createDmeOrderRaw } from '../../src/ehr/dme/create-dme-order/index';
import { index as updateDmeOrderRaw } from '../../src/ehr/dme/update-dme-order/index';
import { makeDmeDeviceRequest } from '../../src/shared/dme';
import { createTask } from '../../src/shared/tasks';

const createDmeOrder = createDmeOrderRaw as unknown as ZambdaHandler;
const updateDmeOrder = updateDmeOrderRaw as unknown as ZambdaHandler;

const ENCOUNTER_ID = '11111111-1111-4111-8111-111111111111';
const PRACTITIONER_ID = '22222222-2222-4222-8222-222222222222';
const DEVICE_REQUEST_ID = '33333333-3333-4333-8333-333333333333';
const secrets: Secrets = { PROJECT_API: 'https://project.api', FHIR_API: 'https://fhir.api', ENVIRONMENT: 'local' };

const orderFields = { itemName: 'Crutches', quantity: 1, orderedByPractitionerId: PRACTITIONER_ID };

const makeInput = (body: unknown): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: { Authorization: 'Bearer user-token' },
  secrets,
});

const encounter = (options: { followup?: boolean; locked?: boolean } = {}): Encounter => ({
  resourceType: 'Encounter',
  id: ENCOUNTER_ID,
  status: 'in-progress',
  class: { code: 'AMB' },
  subject: { reference: 'Patient/pat-1' },
  appointment: options.followup ? undefined : [{ reference: 'Appointment/appt-1' }],
  ...(options.followup
    ? { type: [{ coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }] }] }
    : {}),
  ...(options.locked ? { meta: { tag: [ENCOUNTER_LOCKED_META_TAG] } } : {}),
});

const appointment = (locked: boolean): Appointment => ({
  resourceType: 'Appointment',
  id: 'appt-1',
  status: 'fulfilled',
  participant: [],
  ...(locked ? { meta: { tag: [APPOINTMENT_LOCKED_META_TAG] } } : {}),
});

const LOCKED_VISITS: [string, FhirResource[]][] = [
  ['a signed visit', [encounter(), appointment(true)]],
  ['a signed annotation follow-up', [encounter({ followup: true, locked: true })]],
];
const OPEN_VISIT: FhirResource[] = [encounter(), appointment(false)];

const patient: Patient = { resourceType: 'Patient', id: 'pat-1', name: [{ given: ['Jane'], family: 'Doe' }] };
const practitioner: Practitioner = { resourceType: 'Practitioner', id: PRACTITIONER_ID, name: [{ family: 'Smith' }] };

const order: DeviceRequest = {
  ...makeDmeDeviceRequest({
    fields: DmeOrderFieldsSchema.parse(orderFields),
    encounterId: ENCOUNTER_ID,
    patientId: 'pat-1',
  }),
  id: DEVICE_REQUEST_ID,
  meta: { versionId: '1' },
};

const dispenseTask: Task = {
  ...createTask({
    category: DME_TASK.category,
    title: 'Dispense Crutches',
    code: { system: DME_TASK.system, code: DME_TASK.code.dispense },
    basedOn: [`DeviceRequest/${DEVICE_REQUEST_ID}`],
  }),
  id: 'task-1',
  status: 'ready',
};

const bundleOf = (resources: FhirResource[]): unknown => ({
  total: resources.length,
  entry: resources.map((resource) => ({ resource, search: { mode: 'match' } })),
  unbundle: () => resources,
});

const mockFhir = (visit: FhirResource[]): void => {
  mockOystehr.fhir.search.mockImplementation(
    ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
      const includes = params.filter((p) => p.name === '_include').map((p) => p.value);
      if (resourceType === 'Encounter' && includes.includes('Encounter:appointment')) return bundleOf(visit);
      if (resourceType === 'Encounter') return bundleOf([encounter(), patient]);
      if (resourceType === 'DeviceRequest') return bundleOf([order, dispenseTask]);
      return bundleOf([]);
    }
  );
  mockOystehr.fhir.get.mockResolvedValue(practitioner);
  mockOystehr.fhir.transaction.mockImplementation(({ requests }: { requests: unknown[] }) => ({
    entry: requests.map(() => ({
      response: { status: '201' },
      resource: { resourceType: 'DeviceRequest', id: DEVICE_REQUEST_ID },
    })),
  }));
};

const lockCheckEncounterIds = (): string[] =>
  mockOystehr.fhir.search.mock.calls
    .map(([search]) => search as { resourceType: string; params: { name: string; value: string }[] })
    .filter((s) => s.resourceType === 'Encounter' && s.params.some((p) => p.value === 'Encounter:appointment'))
    .map((s) => s.params.find((p) => p.name === '_id')!.value);

const expectRefusedAsLocked = (response: APIGatewayProxyResult): void => {
  expect(response.statusCode).toBe(400);
  expect(JSON.parse(response.body)).toEqual({
    code: APIErrorCode.INVALID_INPUT,
    message: EASY_CHART_VISIT_LOCKED_MESSAGE,
  });
  expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
};

const updateBodies = [
  ['update', { action: 'update', deviceRequestId: DEVICE_REQUEST_ID, fields: { ...orderFields, quantity: 2 } }],
  ['dispense', { action: 'dispense', deviceRequestId: DEVICE_REQUEST_ID }],
  ['delete', { action: 'delete', deviceRequestId: DEVICE_REQUEST_ID }],
] as const;

beforeEach(() => {
  mockOystehr.fhir.search.mockReset();
  mockOystehr.fhir.get.mockReset();
  mockOystehr.fhir.transaction.mockReset();
});

describe('create-dme-order', () => {
  it.each(LOCKED_VISITS)('refuses %s without writing', async (_name, visit) => {
    mockFhir(visit);
    expectRefusedAsLocked(await createDmeOrder(makeInput({ ...orderFields, encounterId: ENCOUNTER_ID })));
    expect(lockCheckEncounterIds()).toEqual([ENCOUNTER_ID]);
  });

  it('creates the order on an open visit', async () => {
    mockFhir(OPEN_VISIT);
    const response = await createDmeOrder(makeInput({ ...orderFields, encounterId: ENCOUNTER_ID }));
    expect(response.statusCode).toBe(200);
    expect(mockOystehr.fhir.transaction).toHaveBeenCalledOnce();
  });
});

describe.each(LOCKED_VISITS)('update-dme-order on %s', (_name, visit) => {
  it.each(updateBodies)('refuses %s without writing', async (_action, body) => {
    mockFhir(visit);
    expectRefusedAsLocked(await updateDmeOrder(makeInput(body)));
    expect(lockCheckEncounterIds()).toEqual([ENCOUNTER_ID]);
  });
});

describe('update-dme-order on an open visit', () => {
  it.each(updateBodies)('applies %s', async (_action, body) => {
    mockFhir(OPEN_VISIT);
    const response = await updateDmeOrder(makeInput(body));
    expect(response.statusCode).toBe(200);
    expect(mockOystehr.fhir.transaction).toHaveBeenCalledOnce();
  });
});
