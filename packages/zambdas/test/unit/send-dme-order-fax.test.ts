import { APIGatewayProxyResult } from 'aws-lambda';
import { DeviceRequest, Encounter, Patient, Practitioner } from 'fhir/r4b';
import { Secrets } from 'utils/lib/secrets';
import { DME_FULFILLMENT_EXTENSION_URL, DME_THIRD_PARTY_CONTAINED_ID } from 'utils/lib/types/api/dme.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const { mockOystehr, mockGetForm, mockSendFaxAttempt } = vi.hoisted(() => ({
  mockOystehr: { fhir: { get: vi.fn(), search: vi.fn() } },
  mockGetForm: vi.fn(),
  mockSendFaxAttempt: vi.fn(),
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
  userMe: vi.fn().mockResolvedValue({ id: 'user-1', profile: 'Practitioner/prac-1' }),
}));
vi.mock('../../src/ehr/dme/get-dme-order-pdf/helpers', () => ({ getOrCreateDmeOrderForm: mockGetForm }));
vi.mock('../../src/shared/send-fax-attempt', () => ({ sendFaxAttempt: mockSendFaxAttempt }));

import { index as sendDmeOrderFaxRaw } from '../../src/ehr/dme/send-dme-order-fax/index';

const sendDmeOrderFax = sendDmeOrderFaxRaw as unknown as ZambdaHandler;

const DEVICE_REQUEST_ID = '33333333-3333-4333-8333-333333333333';
const secrets: Secrets = {
  PROJECT_API: 'https://project.api',
  FHIR_API: 'https://fhir.api',
  ENVIRONMENT: 'local',
  ORGANIZATION_ID: 'org-1',
};

const makeInput = (body: unknown): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: { Authorization: 'Bearer user-token' },
  secrets,
});

const deviceRequest = (overrides: Partial<DeviceRequest> = {}): DeviceRequest => ({
  resourceType: 'DeviceRequest',
  id: DEVICE_REQUEST_ID,
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  codeCodeableConcept: { text: 'Wheelchair' },
  extension: [{ url: DME_FULFILLMENT_EXTENSION_URL, valueCode: 'external' }],
  contained: [{ resourceType: 'Organization', id: DME_THIRD_PARTY_CONTAINED_ID, name: 'Acme Medical Supply' }],
  ...overrides,
});

const practitioner: Practitioner = { resourceType: 'Practitioner', id: 'prac-1', name: [{ family: 'Smith' }] };
const patient: Patient = { resourceType: 'Patient', id: 'pat-1' };
const encounter: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'in-progress',
  class: { code: 'AMB' },
  subject: { reference: 'Patient/pat-1' },
  appointment: [{ reference: 'Appointment/appt-1' }],
};

const serveResources = (dr: DeviceRequest, encounterBundle: (Encounter | Patient)[] = [encounter, patient]): void => {
  mockOystehr.fhir.get.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
    if (resourceType === 'DeviceRequest') return dr;
    if (resourceType === 'Practitioner') return practitioner;
    throw new Error(`unexpected get ${resourceType}`);
  });
  mockOystehr.fhir.search.mockResolvedValue({ unbundle: () => encounterBundle });
};

describe('send-dme-order-fax', () => {
  beforeEach(() => {
    mockOystehr.fhir.get.mockReset();
    mockOystehr.fhir.search.mockReset();
    mockGetForm.mockReset().mockResolvedValue({
      documentReference: { resourceType: 'DocumentReference', id: 'doc-1' },
      mediaUrl: 'https://z3.test/dme-order.pdf',
    });
    mockSendFaxAttempt.mockReset().mockResolvedValue({ resourceType: 'Task', id: 'task-1' });
  });

  it('faxes the order form on file to the third party as an outbound delivery attempt', async () => {
    serveResources(deviceRequest());

    const result = await sendDmeOrderFax(
      makeInput({ deviceRequestId: DEVICE_REQUEST_ID, faxNumber: '(212) 555-0199' })
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ outboundAttemptId: 'task-1' });
    expect(mockGetForm).toHaveBeenCalledWith(DEVICE_REQUEST_ID, secrets, 'm2m-token', mockOystehr);
    expect(mockSendFaxAttempt).toHaveBeenCalledWith(
      {
        appointmentId: 'appt-1',
        faxNumber: '+12125550199',
        organizationId: 'org-1',
        patientId: 'pat-1',
        media: 'https://z3.test/dme-order.pdf',
        documentReferenceId: 'doc-1',
        userPractitioner: practitioner,
        recipientName: 'Acme Medical Supply',
        senderId: 'user-1',
      },
      mockOystehr
    );
  });

  it('files a fax sent from an annotation follow-up under the parent visit appointment', async () => {
    const followup: Encounter = {
      ...encounter,
      id: 'enc-followup',
      appointment: undefined,
      partOf: { reference: 'Encounter/enc-1' },
    };
    serveResources(deviceRequest({ encounter: { reference: 'Encounter/enc-followup' } }), [
      followup,
      encounter,
      patient,
    ]);

    const result = await sendDmeOrderFax(makeInput({ deviceRequestId: DEVICE_REQUEST_ID, faxNumber: '2125550199' }));

    expect(result.statusCode).toBe(200);
    expect(mockSendFaxAttempt).toHaveBeenCalledWith(expect.objectContaining({ appointmentId: 'appt-1' }), mockOystehr);
  });

  it.each([
    ['an in-house order', deviceRequest({ extension: [] }), 'Only external DME orders can be faxed'],
    ['a deleted order', deviceRequest({ status: 'revoked' }), 'This DME order has been deleted'],
  ])('refuses to fax %s', async (_label, dr, message) => {
    serveResources(dr);

    const result = await sendDmeOrderFax(makeInput({ deviceRequestId: DEVICE_REQUEST_ID, faxNumber: '2125550199' }));

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain(message);
    expect(mockGetForm).not.toHaveBeenCalled();
    expect(mockSendFaxAttempt).not.toHaveBeenCalled();
  });

  it.each([
    ['an invalid fax number', { deviceRequestId: DEVICE_REQUEST_ID, faxNumber: '555' }],
    ['a non-uuid order id', { deviceRequestId: 'order-1', faxNumber: '2125550199' }],
    ['a missing fax number', { deviceRequestId: DEVICE_REQUEST_ID }],
  ])('rejects %s before touching FHIR', async (_label, body) => {
    const result = await sendDmeOrderFax(makeInput(body));

    expect(result.statusCode).toBe(400);
    expect(mockOystehr.fhir.get).not.toHaveBeenCalled();
    expect(mockSendFaxAttempt).not.toHaveBeenCalled();
  });
});
