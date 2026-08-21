import { Appointment, Encounter, Organization, Patient, Practitioner } from 'fhir/r4b';
import { FaxDocumentAvailability, GetFaxPacketPreviewOutput } from 'utils/lib/types/api/fax.types';
import { PRACTICE_NAME_URL } from 'utils/lib/types/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

const mockFhirSearch = vi.fn();
const mockFhirGet = vi.fn();
const mockOystehrClient = { fhir: { search: mockFhirSearch, get: mockFhirGet } };

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  getUser: vi.fn().mockResolvedValue({ id: 'user-1', profile: 'Practitioner/prac-1' }),
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
}));

vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

const mockResolveFaxDocumentAvailability = vi.fn();
vi.mock('../../src/shared/fax/collect-visit-documents', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  resolveFaxDocumentAvailability: (...args: unknown[]) => mockResolveFaxDocumentAvailability(...args),
}));

import { index } from '../../src/ehr/get-fax-packet-preview';

const APPOINTMENT_ID = '650e8400-e29b-41d4-a716-446655440000';
const ENCOUNTER_ID = 'encounter-1';

const AVAILABILITY: FaxDocumentAvailability[] = [
  { kind: 'progress-note', available: true, count: 1 },
  { kind: 'discharge-summary', available: false, count: 0, unavailableReason: 'No discharge summary for this visit' },
];

const appointment: Appointment = {
  resourceType: 'Appointment',
  id: APPOINTMENT_ID,
  status: 'fulfilled',
  participant: [],
};

const encounter: Encounter = {
  resourceType: 'Encounter',
  id: ENCOUNTER_ID,
  status: 'finished',
  class: { code: 'ACUTE' },
};

const senderOrganization: Organization = {
  resourceType: 'Organization',
  id: 'org-123',
  telecom: [
    { system: 'phone', value: '+12125550001' },
    { system: 'fax', value: '+12125550000' },
  ],
};

const patientWith = (contained?: Practitioner[]): Patient => ({
  resourceType: 'Patient',
  id: 'patient-1',
  ...(contained ? { contained } : {}),
});

const pcpPractitioner = (overrides: Partial<Practitioner> = {}): Practitioner => ({
  resourceType: 'Practitioner',
  id: 'primary-care-physician',
  name: [{ given: ['Olivia'], family: 'Green' }],
  extension: [{ url: PRACTICE_NAME_URL, valueString: 'Green Family Practice' }],
  telecom: [
    { system: 'fax', value: '+12125551234' },
    { system: 'phone', value: '+12125559999' },
  ],
  active: true,
  ...overrides,
});

const runPreview = async (patient: Patient): Promise<GetFaxPacketPreviewOutput> => {
  mockFhirSearch.mockResolvedValue({ unbundle: () => [encounter, appointment, patient] });
  const result: any = await (index as any)(
    createMockZambdaInput({ appointmentId: APPOINTMENT_ID }, { secrets: createMockSecrets() })
  );
  expect(result.statusCode).toBe(200);
  return JSON.parse(result.body);
};

describe('get-fax-packet-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveFaxDocumentAvailability.mockResolvedValue(AVAILABILITY);
    mockFhirGet.mockResolvedValue(senderOrganization);
  });

  it('names the fax number the packet is sent from, read off the sending organization', async () => {
    const output = await runPreview(patientWith());

    expect(mockFhirGet).toHaveBeenCalledWith({ resourceType: 'Organization', id: 'org-123' });
    expect(output.senderFaxNumber).toBe('+12125550000');
  });

  it('previews the sender alone when no visit is named', async () => {
    const result: any = await (index as any)(createMockZambdaInput({}, { secrets: createMockSecrets() }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ documents: [], hasSavedPcp: false, senderFaxNumber: '+12125550000' });
    // Nothing visit-specific is resolved, so no document availability work is done either.
    expect(mockResolveFaxDocumentAvailability).not.toHaveBeenCalled();
    expect(mockFhirSearch).not.toHaveBeenCalled();
  });

  it('still previews the visit when the sending organization cannot be read', async () => {
    mockFhirGet.mockRejectedValue(new Error('forbidden'));

    const output = await runPreview(patientWith());

    expect(output.senderFaxNumber).toBeUndefined();
    expect(output.documents).toEqual(AVAILABILITY);
  });

  it('passes the resolved document availability straight through', async () => {
    const output = await runPreview(patientWith());

    expect(output.documents).toEqual(AVAILABILITY);
    expect(mockResolveFaxDocumentAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: APPOINTMENT_ID, encounterId: ENCOUNTER_ID })
    );
  });

  it('maps the contained PCP practitioner onto a fax recipient, normalizing numbers to ten digits', async () => {
    const output = await runPreview(patientWith([pcpPractitioner()]));

    expect(output.hasSavedPcp).toBe(true);
    // Stored as +1-prefixed, but handed to the masked field as bare ten digits so it isn't shifted.
    expect(output.pcp).toEqual({
      name: 'Olivia Green',
      organization: 'Green Family Practice',
      faxNumber: '2125551234',
      phoneNumber: '2125559999',
    });
  });

  it('omits a fax number that is not cleanly ten digits rather than mangling it', async () => {
    const output = await runPreview(
      patientWith([pcpPractitioner({ telecom: [{ system: 'fax', value: '+12125551234 ext. 22' }] })])
    );

    expect(output.hasSavedPcp).toBe(true);
    expect(output.pcp).toBeUndefined();
  });

  it('reports a saved PCP but returns no prefill when the PCP has no fax number', async () => {
    const output = await runPreview(
      patientWith([pcpPractitioner({ telecom: [{ system: 'phone', value: '+12125559999' }] })])
    );

    expect(output.hasSavedPcp).toBe(true);
    expect(output.pcp).toBeUndefined();
  });

  it('reports no saved PCP when the patient has no contained practitioner', async () => {
    const output = await runPreview(patientWith());

    expect(output.hasSavedPcp).toBe(false);
    expect(output.pcp).toBeUndefined();
  });

  it('ignores a deactivated PCP', async () => {
    const output = await runPreview(patientWith([pcpPractitioner({ active: false })]));

    expect(output.hasSavedPcp).toBe(false);
    expect(output.pcp).toBeUndefined();
  });

  it('ignores contained practitioners that are not the PCP', async () => {
    const output = await runPreview(patientWith([pcpPractitioner({ id: 'some-other-practitioner' })]));

    expect(output.hasSavedPcp).toBe(false);
    expect(output.pcp).toBeUndefined();
  });
});
