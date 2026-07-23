import { Appointment, Bundle, DocumentReference, Patient, Task } from 'fhir/r4b';
import { getOutboundDeliveryInput, OUTBOUND_DELIVERY_INPUT_CODES, VISIT_NOTE_SUMMARY_CODE } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

const mockFhirSearch = vi.fn();
const mockFhirGet = vi.fn();
const mockFhirCreate = vi.fn();
const mockFhirPatch = vi.fn();
const mockFaxSend = vi.fn();
const mockOystehrClient = {
  fhir: { search: mockFhirSearch, get: mockFhirGet, create: mockFhirCreate, patch: mockFhirPatch },
  fax: { send: mockFaxSend },
};

vi.mock('../../src/shared', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
  getUser: vi.fn().mockResolvedValue({ id: 'user-1', profile: 'Practitioner/prac-1' }),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

import { index } from '../../src/ehr/send-fax';

const APPOINTMENT_ID = '650e8400-e29b-41d4-a716-446655440000';

function makeSearchBundle(pcpFax: string, system: 'fax' | 'phone' = 'fax'): unknown {
  const appointment: Appointment = {
    resourceType: 'Appointment',
    id: APPOINTMENT_ID,
    status: 'fulfilled',
    participant: [],
  };
  const patient: Patient = {
    resourceType: 'Patient',
    id: 'patient-1',
    contained: [
      {
        resourceType: 'Practitioner',
        id: 'pcp',
        name: [{ given: ['Olivia'], family: 'Green' }],
        telecom: [{ system, value: pcpFax }],
      },
    ],
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

describe('send-fax outbound attempt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFhirSearch.mockResolvedValue(makeSearchBundle('(212) 555-1234'));
    mockFhirGet.mockResolvedValue({ resourceType: 'Practitioner', id: 'prac-1', name: [{ family: 'Sender' }] });
    mockFhirCreate.mockImplementation((task: Task) => Promise.resolve({ ...task, id: 'attempt-1' }));
    mockFhirPatch.mockImplementation(({ operations }: any) =>
      Promise.resolve({ resourceType: 'Task', id: 'attempt-1', status: operations[0].value, intent: 'order' })
    );
    mockFaxSend.mockResolvedValue({ communicationResource: { resourceType: 'Communication', id: 'comm-1' } });
  });

  it('persists the immutable recipient snapshot before contacting the fax provider', async () => {
    const response = await (index as any)(
      createMockZambdaInput(
        { appointmentId: APPOINTMENT_ID, faxNumber: '2125551234' },
        { secrets: createMockSecrets() }
      )
    );
    expect(response.statusCode).toBe(200);
    expect(mockFhirCreate.mock.invocationCallOrder[0]).toBeLessThan(mockFaxSend.mock.invocationCallOrder[0]);
    const task = mockFhirCreate.mock.calls[0][0] as Task;
    expect(getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.recipientAddress)?.valueString).toBe(
      '+12125551234'
    );
    expect(getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.recipientName)?.valueString).toContain('Green');
    expect(
      getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.senderOrganization)?.valueReference?.reference
    ).toMatch(/^Organization\//);
    expect(mockFhirPatch).toHaveBeenCalledWith(
      expect.objectContaining({ operations: expect.arrayContaining([expect.objectContaining({ value: 'completed' })]) })
    );
  });

  it('retains and marks the attempt failed when the provider rejects the send', async () => {
    mockFaxSend.mockRejectedValue(new Error('provider unavailable'));
    await expect(
      (index as any)(
        createMockZambdaInput(
          { appointmentId: APPOINTMENT_ID, faxNumber: '2125551234' },
          { secrets: createMockSecrets() }
        )
      )
    ).rejects.toThrow('provider unavailable');
    expect(mockFhirCreate).toHaveBeenCalledTimes(1);
    expect(mockFhirPatch).toHaveBeenCalledWith(
      expect.objectContaining({ operations: expect.arrayContaining([expect.objectContaining({ value: 'failed' })]) })
    );
  });

  it('does not identify a recipient from a matching non-fax phone number', async () => {
    mockFhirSearch.mockResolvedValue(makeSearchBundle('(212) 555-1234', 'phone'));

    await (index as any)(
      createMockZambdaInput(
        { appointmentId: APPOINTMENT_ID, faxNumber: '2125551234' },
        { secrets: createMockSecrets() }
      )
    );

    const task = mockFhirCreate.mock.calls[0][0] as Task;
    expect(getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.recipientName)).toBeUndefined();
  });

  it('keeps a visible pending attempt when completion persistence exhausts its retries', async () => {
    mockFhirPatch.mockRejectedValue(new Error('FHIR unavailable'));

    await expect(
      (index as any)(
        createMockZambdaInput(
          { appointmentId: APPOINTMENT_ID, faxNumber: '2125551234' },
          { secrets: createMockSecrets() }
        )
      )
    ).rejects.toThrow('outbound attempt could not be completed');
    expect(mockFaxSend).toHaveBeenCalledTimes(1);
    expect(mockFhirCreate).toHaveBeenCalledTimes(1);
    expect(mockFhirPatch).toHaveBeenCalledTimes(3);
    expect((mockFhirCreate.mock.calls[0][0] as Task).status).toBe('in-progress');
  });
});
