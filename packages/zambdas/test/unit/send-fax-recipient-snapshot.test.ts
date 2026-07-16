import { Appointment, Bundle, DocumentReference, Patient, Provenance } from 'fhir/r4b';
import { VISIT_NOTE_SUMMARY_CODE } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

const mockFhirSearch = vi.fn();
const mockFhirGet = vi.fn();
const mockFhirCreate = vi.fn();
const mockFaxSend = vi.fn();
const mockOystehrClient = {
  fhir: { search: mockFhirSearch, get: mockFhirGet, create: mockFhirCreate },
  fax: { send: mockFaxSend },
};

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
    getUser: vi.fn().mockResolvedValue({ id: 'user-1', profile: 'Practitioner/prac-1' }),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

import { index } from '../../src/ehr/send-fax';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const APPOINTMENT_ID = '650e8400-e29b-41d4-a716-446655440000';
const PCP_NAME = [{ given: ['Olivia'], family: 'Green' }];

function makePatient(pcpFax: string): Patient {
  return {
    resourceType: 'Patient',
    id: 'patient-1',
    contained: [
      {
        resourceType: 'Practitioner',
        id: 'primary-care-physician',
        name: PCP_NAME,
        telecom: [
          { system: 'phone', value: '+19998887777' },
          { system: 'fax', value: pcpFax },
        ],
      },
    ],
  };
}

function makeSearchBundle(patient: Patient): unknown {
  const appointment: Appointment = {
    resourceType: 'Appointment',
    id: APPOINTMENT_ID,
    status: 'fulfilled',
    participant: [],
  };
  const visitNote: DocumentReference = {
    resourceType: 'DocumentReference',
    id: 'doc-1',
    status: 'current',
    type: { coding: [{ code: VISIT_NOTE_SUMMARY_CODE }] },
    content: [{ attachment: { url: 'https://z3.example/visit-note.pdf' } }],
  };
  return { unbundle: () => [appointment, patient, visitNote] } as unknown as Bundle;
}

async function invokeSendFax(): Promise<Provenance> {
  const result = (await (index as any)(
    createMockZambdaInput({ appointmentId: APPOINTMENT_ID, faxNumber: '2125551234' }, { secrets: createMockSecrets() })
  )) as { statusCode: number };
  expect(result.statusCode).toBe(200);
  expect(mockFhirCreate).toHaveBeenCalledTimes(1);
  return mockFhirCreate.mock.calls[0][0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('send-fax - recipient snapshot on the fax Provenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFhirGet.mockResolvedValue({ resourceType: 'Practitioner', id: 'prac-1' });
    mockFaxSend.mockResolvedValue({
      communicationResource: { resourceType: 'Communication', id: 'comm-1', sent: '2024-07-29T15:00:00.000Z' },
    });
    mockFhirCreate.mockImplementation((resource: Provenance) => Promise.resolve(resource));
  });

  it("snapshots the recipient's name when the fax number matches the patient's PCP", async () => {
    mockFhirSearch.mockResolvedValue(makeSearchBundle(makePatient('(212) 555-1234')));

    const provenance = await invokeSendFax();

    expect(mockFaxSend).toHaveBeenCalledWith(expect.objectContaining({ recipientNumber: '+12125551234' }));
    expect(provenance.contained?.[0]).toMatchObject({
      resourceType: 'Practitioner',
      name: PCP_NAME,
      telecom: [{ system: 'fax', value: '+12125551234' }],
    });
  });

  it('omits the recipient name when the fax number does not match the PCP', async () => {
    mockFhirSearch.mockResolvedValue(makeSearchBundle(makePatient('(999) 999-9999')));

    const provenance = await invokeSendFax();

    expect(provenance.contained?.[0]).toMatchObject({
      resourceType: 'Practitioner',
      telecom: [{ system: 'fax', value: '+12125551234' }],
    });
    expect((provenance.contained?.[0] as { name?: unknown }).name).toBeUndefined();
  });
});
