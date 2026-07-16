import { Appointment, Bundle, Communication, Patient, Provenance } from 'fhir/r4b';
import {
  FAX_SENT_PROVENANCE_ACTIVITY_CODING,
  GetFaxLogsInput,
  GetFaxLogsOutput,
  OYSTEHR_FAX_COMMUNICATION_IDENTIFIER_SYSTEM,
  OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL,
} from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

const mockFhirSearch = vi.fn();
const mockOystehrClient = { fhir: { search: mockFhirSearch } };

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

import { index } from '../../src/ehr/get-fax-logs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PATIENT_ID = '550e8400-e29b-41d4-a716-446655440000';
const APPOINTMENT_ID = '650e8400-e29b-41d4-a716-446655440000';
const FAX_NUMBER = '+11112223333';
const FAX_IDENTIFIER_FILTER = `${OYSTEHR_FAX_COMMUNICATION_IDENTIFIER_SYSTEM}|`;

function makeBundle(resources: (Appointment | Communication | Patient | Provenance)[], total?: number): unknown {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: total ?? resources.length,
    unbundle: () => resources,
  } as unknown as Bundle;
}

function makeFaxCommunication(overrides?: Partial<Communication> & { faxStatusCode?: string }): Communication {
  const { faxStatusCode, ...rest } = overrides ?? {};
  return {
    resourceType: 'Communication',
    id: 'comm-1',
    status: 'in-progress',
    identifier: [{ system: OYSTEHR_FAX_COMMUNICATION_IDENTIFIER_SYSTEM, value: 'fax-id-1' }],
    ...(faxStatusCode && {
      extension: [
        {
          url: OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL,
          valueCodeableConcept: { coding: [{ code: faxStatusCode }] },
        },
      ],
    }),
    subject: { reference: `Patient/${PATIENT_ID}` },
    recipient: [{ reference: '#1112223333' }],
    sent: '2024-07-29T15:00:00.000Z',
    contained: [{ resourceType: 'Practitioner', id: '1112223333', telecom: [{ system: 'fax', value: FAX_NUMBER }] }],
    ...rest,
  };
}

function makePatient(): Patient {
  return {
    resourceType: 'Patient',
    id: PATIENT_ID,
    name: [{ given: ['Oliver'], family: 'Black' }],
  };
}

/** Mirrors what send-fax creates: targets both resources and snapshots the recipient name. */
function makeFaxProvenance(communicationId: string, appointmentId = APPOINTMENT_ID): Provenance {
  return {
    resourceType: 'Provenance',
    id: `prov-${communicationId}`,
    target: [{ reference: `Communication/${communicationId}` }, { reference: `Appointment/${appointmentId}` }],
    recorded: '2024-07-29T15:00:00.000Z',
    activity: { coding: [FAX_SENT_PROVENANCE_ACTIVITY_CODING] },
    agent: [{ who: { reference: 'Practitioner/prac-1' } }],
    contained: [
      {
        resourceType: 'Practitioner',
        id: '1112223333',
        name: [{ given: ['Olivia'], family: 'Green' }],
        telecom: [{ system: 'fax', value: FAX_NUMBER }],
      },
    ],
  };
}

/** Oystehr audit provenance — versioned target reference, CREATE activity — must be ignored. */
function makeAuditProvenance(communicationId: string): Provenance {
  return {
    resourceType: 'Provenance',
    id: `audit-${communicationId}`,
    target: [{ reference: `Communication/${communicationId}/_history/some-version` }],
    recorded: '2024-07-29T15:00:00.000Z',
    activity: { coding: [{ code: 'CREATE' }] },
    agent: [{ who: { reference: 'Device/device-1' } }],
  };
}

function makeAppointment(id = APPOINTMENT_ID, start = '2024-07-29T14:30:00.000Z'): Appointment {
  return { resourceType: 'Appointment', id, status: 'fulfilled', start, participant: [] };
}

async function invoke(body: GetFaxLogsInput): Promise<GetFaxLogsOutput> {
  const result = (await (index as any)(createMockZambdaInput(body, { secrets: createMockSecrets() }))) as {
    statusCode: number;
    body: string;
  };
  expect(result.statusCode).toBe(200);
  return JSON.parse(result.body);
}

function searchParamsOfCall(callIndex: number): { resourceType: string; params: { name: string; value: string }[] } {
  return mockFhirSearch.mock.calls[callIndex][0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('get-fax-logs - performEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('composes full log entries and queries with the 30-day window by default', async () => {
    mockFhirSearch.mockResolvedValueOnce(
      makeBundle(
        [
          makeFaxCommunication({ faxStatusCode: 'DELIVERED' }),
          makePatient(),
          makeFaxProvenance('comm-1'),
          makeAuditProvenance('comm-1'),
          makeAppointment(),
        ],
        13
      )
    );

    const output = await invoke({});

    expect(output.totalCount).toBe(13);
    expect(output.logs).toEqual([
      {
        communicationId: 'comm-1',
        status: 'sent',
        sentAt: '2024-07-29T15:00:00.000Z',
        faxNumber: FAX_NUMBER,
        patientId: PATIENT_ID,
        patientName: 'Black, Oliver',
        recipientName: 'Olivia Green',
        appointmentId: APPOINTMENT_ID,
        visitDate: '2024-07-29T14:30:00.000Z',
      },
    ]);

    expect(mockFhirSearch).toHaveBeenCalledTimes(1);
    const { resourceType, params } = searchParamsOfCall(0);
    expect(resourceType).toBe('Communication');
    expect(params).toEqual(
      expect.arrayContaining([
        { name: 'identifier', value: FAX_IDENTIFIER_FILTER },
        { name: '_total', value: 'accurate' },
        { name: '_count', value: '10' },
        { name: '_offset', value: '0' },
        { name: '_sort', value: '-sent,-_id' },
        { name: '_include', value: 'Communication:subject' },
        { name: '_revinclude', value: 'Provenance:target' },
        { name: '_include:iterate', value: 'Provenance:target' },
        { name: 'sent', value: expect.stringMatching(/^ge/) },
      ])
    );
  });

  it('maps fax statuses: STOPPED → failed, in-flight → pending, missing extension + completed → sent', async () => {
    mockFhirSearch.mockResolvedValueOnce(
      makeBundle([
        makeFaxCommunication({ id: 'comm-1', faxStatusCode: 'STOPPED' }),
        makeFaxCommunication({ id: 'comm-2', faxStatusCode: 'QUEUED' }),
        makeFaxCommunication({ id: 'comm-3', status: 'completed' }),
      ])
    );

    const output = await invoke({});

    expect(output.logs.map((log) => [log.communicationId, log.status])).toEqual([
      ['comm-1', 'failed'],
      ['comm-2', 'pending'],
      ['comm-3', 'sent'],
    ]);
  });

  it('searches all history when filtering by patient name, and scopes by patient id', async () => {
    mockFhirSearch.mockResolvedValue(makeBundle([]));

    await invoke({ patientName: 'Black', patientId: PATIENT_ID, pageIndex: 2 });

    const { params } = searchParamsOfCall(0);
    expect(params).toEqual(
      expect.arrayContaining([
        { name: 'subject:Patient.name', value: 'Black' },
        { name: 'subject', value: `Patient/${PATIENT_ID}` },
        { name: '_offset', value: '20' },
      ])
    );
    expect(params.some((param) => param.name === 'sent')).toBe(false);
  });

  it('resolves a visit id filter through a chained fax-Provenance search', async () => {
    mockFhirSearch
      .mockResolvedValueOnce(makeBundle([makeFaxProvenance('comm-1'), makeAuditProvenance('comm-1')]))
      .mockResolvedValueOnce(makeBundle([makeFaxCommunication({ faxStatusCode: 'STOPPED' })]))
      .mockResolvedValueOnce(
        makeBundle([
          makeFaxCommunication({ faxStatusCode: 'STOPPED' }),
          makePatient(),
          makeFaxProvenance('comm-1'),
          makeAppointment(),
        ])
      );

    const output = await invoke({ visitId: APPOINTMENT_ID });

    expect(output.totalCount).toBe(1);
    expect(output.logs[0]).toMatchObject({
      communicationId: 'comm-1',
      status: 'failed',
      appointmentId: APPOINTMENT_ID,
      recipientName: 'Olivia Green',
    });

    expect(searchParamsOfCall(0)).toEqual({
      resourceType: 'Provenance',
      params: [
        { name: 'target:Communication.identifier', value: FAX_IDENTIFIER_FILTER },
        { name: 'target', value: `Appointment/${APPOINTMENT_ID}` },
        { name: '_count', value: '1000' },
        { name: '_offset', value: '0' },
      ],
    });
    expect(searchParamsOfCall(1).params).toEqual(
      expect.arrayContaining([
        { name: 'identifier', value: FAX_IDENTIFIER_FILTER },
        { name: '_id', value: 'comm-1' },
      ])
    );
    expect(searchParamsOfCall(2).params).toEqual(
      expect.arrayContaining([
        { name: '_id', value: 'comm-1' },
        { name: '_include', value: 'Communication:subject' },
      ])
    );
  });

  it('returns an empty page without further queries when a visit has no faxes', async () => {
    mockFhirSearch.mockResolvedValueOnce(makeBundle([makeAuditProvenance('comm-1')]));

    const output = await invoke({ visitId: APPOINTMENT_ID });

    expect(output).toEqual({ logs: [], totalCount: 0 });
    expect(mockFhirSearch).toHaveBeenCalledTimes(1);
  });

  it('resolves a visit date filter via the chained Appointment.date param', async () => {
    mockFhirSearch
      .mockResolvedValueOnce(makeBundle([makeFaxProvenance('comm-1', 'appt-1')]))
      .mockResolvedValueOnce(makeBundle([makeFaxCommunication()]))
      .mockResolvedValueOnce(makeBundle([makeFaxCommunication(), makePatient()]));

    const output = await invoke({ visitDate: '2024-07-29' });

    expect(output.totalCount).toBe(1);
    expect(searchParamsOfCall(0)).toEqual({
      resourceType: 'Provenance',
      params: [
        { name: 'target:Communication.identifier', value: FAX_IDENTIFIER_FILTER },
        { name: 'target:Appointment.date', value: '2024-07-29' },
        { name: '_count', value: '1000' },
        { name: '_offset', value: '0' },
      ],
    });
  });

  it('pages the Provenance lookup past 1000 records and batches a large id set without dropping matches', async () => {
    const count = 1500;
    const provenances = Array.from({ length: count }, (_, i) =>
      makeFaxProvenance(`comm-${String(i).padStart(4, '0')}`)
    );
    // sent timestamp derives from the id so every phase sees consistent values; higher id = newer
    const communicationsOf = (ids: string[]): Communication[] =>
      ids.map((id) => {
        const n = Number(id.slice(-4));
        return makeFaxCommunication({
          id,
          sent: new Date(Date.UTC(2024, 6, 1, 0, 0, 0, 0) + n * 60_000).toISOString(),
        });
      });

    mockFhirSearch.mockImplementation(
      (request: { resourceType: string; params: { name: string; value: string }[] }) => {
        if (request.resourceType === 'Provenance') {
          const offset = Number(request.params.find((param) => param.name === '_offset')?.value ?? '0');
          return Promise.resolve(makeBundle(provenances.slice(offset, offset + 1000)));
        }
        const idParam = request.params.find((param) => param.name === '_id')?.value ?? '';
        return Promise.resolve(makeBundle(communicationsOf(idParam.split(','))));
      }
    );

    const output = await invoke({ visitId: APPOINTMENT_ID });

    expect(output.totalCount).toBe(count);
    expect(output.logs).toHaveLength(10);
    // newest first: the sort key is (sent desc, id desc), so the first page is comm-1499..comm-1490
    expect(output.logs.map((log) => log.communicationId)).toEqual(
      Array.from({ length: 10 }, (_, i) => `comm-${1499 - i}`)
    );

    const provenanceCalls = mockFhirSearch.mock.calls.filter(([request]) => request.resourceType === 'Provenance');
    expect(provenanceCalls.map(([request]) => request.params.find((p: any) => p.name === '_offset')?.value)).toEqual([
      '0',
      '1000',
    ]);
    // 2 provenance pages + 15 id batches of ≤100 + 1 includes page
    expect(mockFhirSearch).toHaveBeenCalledTimes(18);
  });

  it('returns the total without an includes query when the requested page is beyond the results', async () => {
    mockFhirSearch
      .mockResolvedValueOnce(makeBundle([makeFaxProvenance('comm-1')]))
      .mockResolvedValueOnce(makeBundle([makeFaxCommunication()]));

    const output = await invoke({ visitId: APPOINTMENT_ID, pageIndex: 5 });

    expect(output).toEqual({ logs: [], totalCount: 1 });
    expect(mockFhirSearch).toHaveBeenCalledTimes(2);
  });
});
