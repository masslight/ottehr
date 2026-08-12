import { Appointment, Bundle, DocumentReference, Encounter, Patient, Task } from 'fhir/r4b';
import { PageSizes, PDFDocument } from 'pdf-lib';
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

const mockCreatePresignedUrl = vi.fn().mockResolvedValue('https://presigned.example/file');
const mockUploadObjectToZ3 = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/shared/z3Utils', () => ({
  createPresignedUrl: (...args: unknown[]) => mockCreatePresignedUrl(...args),
  uploadObjectToZ3: (...args: unknown[]) => mockUploadObjectToZ3(...args),
}));

import { index } from '../../src/ehr/send-fax';

const APPOINTMENT_ID = '650e8400-e29b-41d4-a716-446655440000';

function makeInput(faxNumber: string, recipient: Record<string, unknown> = {}): unknown {
  return makeRequest({ recipients: [{ faxNumber, ...recipient }] });
}

function makeRequest(body: Record<string, unknown>): unknown {
  return createMockZambdaInput(
    { target: { type: 'visit-note', appointmentId: APPOINTMENT_ID }, ...body },
    // PROJECT_ID is what the composed packet's Z3 URL is built from.
    { secrets: createMockSecrets({ PROJECT_ID: 'project-123' }) }
  );
}

function makeSearchBundle(pcpFax: string, system: 'fax' | 'phone' = 'fax'): unknown {
  const appointment: Appointment = {
    resourceType: 'Appointment',
    id: APPOINTMENT_ID,
    status: 'fulfilled',
    participant: [],
  };
  const encounter: Encounter = {
    resourceType: 'Encounter',
    id: 'encounter-1',
    status: 'finished',
    class: { code: 'AMB' },
    appointment: [{ reference: `Appointment/${APPOINTMENT_ID}` }],
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
  return { unbundle: () => [encounter, appointment, patient, visitNote] } as unknown as Bundle;
}

describe('send-fax outbound attempt', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockFhirSearch.mockResolvedValue(makeSearchBundle('(212) 555-1234'));
    mockFhirGet.mockImplementation(({ resourceType, id }: { resourceType: string; id: string }) =>
      resourceType === 'Organization'
        ? Promise.resolve({ resourceType, id, name: 'Ottehr Urgent Care' })
        : Promise.resolve({ resourceType, id, name: [{ family: 'Sender' }] })
    );
    mockFhirCreate.mockImplementation((task: Task) => Promise.resolve({ ...task, id: 'attempt-1' }));
    mockFhirPatch.mockImplementation(({ operations }: any) =>
      Promise.resolve({ resourceType: 'Task', id: 'attempt-1', status: operations[0].value, intent: 'order' })
    );
    mockFaxSend.mockResolvedValue({ communicationResource: { resourceType: 'Communication', id: 'comm-1' } });
    mockCreatePresignedUrl.mockResolvedValue('https://presigned.example/file');
    const visitNotePdf = await PDFDocument.create();
    visitNotePdf.addPage(PageSizes.A4);
    const visitNoteBytes = await visitNotePdf.save();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(visitNoteBytes.buffer) })
    );
  });

  it('persists the immutable recipient snapshot before contacting the fax provider', async () => {
    const response = await (index as any)(makeInput('2125551234'));

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

  it('faxes the assembled packet and records it so the attempt can be retried', async () => {
    await (index as any)(makeInput('2125551234'));

    const mediaPatch = mockFhirPatch.mock.calls
      .flatMap(([call]) => call.operations)
      .find((operation: any) => operation.value?.type?.coding?.[0]?.code === OUTBOUND_DELIVERY_INPUT_CODES.media);
    const media = mediaPatch?.value?.valueString;
    expect(media).toMatch(/outbound-faxes/);
    expect(mockFhirPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: expect.arrayContaining([
          expect.objectContaining({
            path: '/focus',
            value: { reference: `Appointment/${APPOINTMENT_ID}`, type: 'Appointment' },
          }),
          expect.objectContaining({
            value: expect.objectContaining({
              valueReference: { reference: 'DocumentReference/doc-1' },
            }),
          }),
        ]),
      })
    );
    expect(mockUploadObjectToZ3).toHaveBeenCalledTimes(1);
    expect(mockFaxSend).toHaveBeenCalledWith(expect.objectContaining({ media }));
  });

  it('prefers the recipient name entered by the user over the patient PCP', async () => {
    await (index as any)(makeInput('2125551234', { name: 'Dr. Tomas Jhonson' }));

    const task = mockFhirCreate.mock.calls[0][0] as Task;
    expect(getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.recipientName)?.valueString).toBe(
      'Dr. Tomas Jhonson'
    );
  });

  it('retains and marks the attempt failed when the provider rejects the send', async () => {
    mockFaxSend.mockRejectedValue(new Error('provider unavailable'));

    await expect((index as any)(makeInput('2125551234'))).rejects.toThrow('Every fax in this request failed to send');
    expect(mockFhirCreate).toHaveBeenCalledTimes(1);
    expect(mockFhirPatch).toHaveBeenCalledWith(
      expect.objectContaining({ operations: expect.arrayContaining([expect.objectContaining({ value: 'failed' })]) })
    );
  });

  it('retains and marks the attempt failed when packet upload fails', async () => {
    mockUploadObjectToZ3.mockRejectedValueOnce(new Error('upload unavailable'));

    await expect((index as any)(makeInput('2125551234'))).rejects.toThrow('Every fax in this request failed to send');
    expect(mockFhirCreate).toHaveBeenCalledTimes(1);
    expect(mockFhirCreate.mock.invocationCallOrder[0]).toBeLessThan(mockUploadObjectToZ3.mock.invocationCallOrder[0]);
    expect(mockFhirPatch).toHaveBeenCalledWith(
      expect.objectContaining({ operations: expect.arrayContaining([expect.objectContaining({ value: 'failed' })]) })
    );
    const task = mockFhirCreate.mock.calls[0][0] as Task;
    expect(getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.media)).toBeUndefined();
    expect(getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.documentReference)).toBeUndefined();
    expect(task.focus).toBeUndefined();
    expect(mockFaxSend).not.toHaveBeenCalled();
  });

  it('faxes each recipient their own packet from one download of the documents', async () => {
    const response = await (index as any)(
      makeRequest({ recipients: [{ faxNumber: '2125551234' }, { faxNumber: '2125559999' }] })
    );

    expect(JSON.parse(response.body)).toEqual({ attemptIds: ['attempt-1', 'attempt-1'], failureCount: 0 });
    expect(mockFaxSend).toHaveBeenCalledTimes(2);
    // The visit note is downloaded once and reused for both cover pages.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mockUploadObjectToZ3).toHaveBeenCalledTimes(2);
  });

  it('reports a partial send when one recipient fails', async () => {
    mockFaxSend
      .mockRejectedValueOnce(new Error('provider rejected the number'))
      .mockResolvedValueOnce({ communicationResource: { resourceType: 'Communication', id: 'comm-2' } });

    const response = await (index as any)(
      makeRequest({ recipients: [{ faxNumber: '2125551234' }, { faxNumber: '2125559999' }] })
    );

    expect(JSON.parse(response.body)).toEqual({ attemptIds: ['attempt-1'], failureCount: 1 });
    // The failed recipient still leaves a failed attempt behind for the action log.
    expect(mockFhirCreate).toHaveBeenCalledTimes(2);
  });

  it('records a failed attempt when a selected document cannot be downloaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect((index as any)(makeInput('2125551234'))).rejects.toThrow('Every fax in this request failed to send');
    expect(mockFhirCreate).toHaveBeenCalledTimes(1);
    expect(mockFhirPatch).toHaveBeenCalledWith(
      expect.objectContaining({ operations: expect.arrayContaining([expect.objectContaining({ value: 'failed' })]) })
    );
    expect(mockFaxSend).not.toHaveBeenCalled();
  });

  it('does not identify a recipient from a matching non-fax phone number', async () => {
    mockFhirSearch.mockResolvedValue(makeSearchBundle('(212) 555-1234', 'phone'));

    await (index as any)(makeInput('2125551234'));

    const task = mockFhirCreate.mock.calls[0][0] as Task;
    expect(getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.recipientName)).toBeUndefined();
  });

  it('keeps a visible pending attempt when completion persistence exhausts its retries', async () => {
    mockFhirPatch.mockImplementation(({ operations }: any) => {
      const isMediaPatch = operations.some(
        (operation: any) => operation.value?.type?.coding?.[0]?.code === OUTBOUND_DELIVERY_INPUT_CODES.media
      );
      return isMediaPatch
        ? Promise.resolve({ resourceType: 'Task', id: 'attempt-1', status: 'in-progress', intent: 'order' })
        : Promise.reject(new Error('FHIR unavailable'));
    });

    await expect((index as any)(makeInput('2125551234'))).rejects.toThrow('Every fax in this request failed to send');
    expect(mockFaxSend).toHaveBeenCalledTimes(1);
    expect(mockFhirCreate).toHaveBeenCalledTimes(1);
    expect(mockFhirPatch).toHaveBeenCalledTimes(4);
    expect((mockFhirCreate.mock.calls[0][0] as Task).status).toBe('in-progress');
  });
});
