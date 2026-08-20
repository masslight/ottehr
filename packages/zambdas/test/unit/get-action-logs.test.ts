import { Appointment, Communication, FhirResource, Organization, Patient, Task } from 'fhir/r4b';
import { OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getOutboundDeliveryAttemptStatus, makeOutboundDeliveryAttempt } from 'utils/lib/fhir/outbound-delivery';
import { ACTION_LOGS_PAGE_SIZE } from 'utils/lib/types/api/action-logs.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { describe, expect, it, Mock, vi } from 'vitest';
import { getActionLogViewerRoles, performEffect } from '../../src/ehr/get-action-logs';

interface SearchRequest {
  resourceType: string;
  params: { name: string; value: string }[];
}

const bundleOf = (resources: FhirResource[], total = resources.length): unknown => ({
  unbundle: () => resources,
  total,
  entry: resources.map((resource) => ({ resource, search: { mode: 'match' } })),
});

/**
 * A FHIR search double that answers by what was asked for rather than by call order. The zambda fires
 * its per-page lookups inside a single `Promise.all`, so keying the responses on the request itself
 * keeps these tests from breaking when a lookup is added or that batch is reordered.
 */
const mockSearch = ({
  page = [],
  total = page.filter((resource) => resource.resourceType === 'Task').length,
  communications = [],
  children = [],
  organizations = [],
}: {
  page?: FhirResource[];
  total?: number;
  communications?: Communication[];
  children?: Task[];
  organizations?: Organization[] | Error;
} = {}): Mock =>
  vi.fn().mockImplementation(async ({ resourceType, params }: SearchRequest) => {
    if (resourceType === 'Organization') {
      if (organizations instanceof Error) throw organizations;
      return bundleOf(organizations);
    }
    if (resourceType === 'Communication') return bundleOf(communications);
    // Only the retry lookup asks for children of the page's attempts; the page search itself does not.
    if (params.some((param) => param.name === 'part-of')) return bundleOf(children);
    return bundleOf(page, total);
  });

const searchesFor = (search: Mock, resourceType: string): SearchRequest[] =>
  search.mock.calls
    .map(([request]) => request as SearchRequest)
    .filter((request) => request.resourceType === resourceType);

const isChildLookup = (request: SearchRequest): boolean => request.params.some((param) => param.name === 'part-of');
const pageSearch = (search: Mock): SearchRequest => searchesFor(search, 'Task').filter((r) => !isChildLookup(r))[0];
const childSearch = (search: Mock): SearchRequest | undefined => searchesFor(search, 'Task').find(isChildLookup);

const patient: Patient = { resourceType: 'Patient', id: 'patient-1', name: [{ given: ['Ada'], family: 'Lovelace' }] };
const appointment: Appointment = {
  resourceType: 'Appointment',
  id: 'appointment-1',
  status: 'fulfilled',
  participant: [],
  start: '2025-01-01T12:00:00Z',
};
const task: Task = {
  ...makeOutboundDeliveryAttempt({
    channel: 'fax',
    patientId: 'patient-1',
    appointmentId: 'appointment-1',
    recipientAddress: '+12125551234',
    documentReferenceId: 'doc-1',
    communicationReference: 'Communication/comm-1',
  }),
  id: 'attempt-1',
};

describe('get-action-logs', () => {
  it('allows Providers only for patient-scoped logs', () => {
    expect(getActionLogViewerRoles()).not.toContain(RoleType.Provider);
    expect(getActionLogViewerRoles('patient-1')).toContain(RoleType.Provider);
    expect(getActionLogViewerRoles()).toContain(RoleType.Staff);
  });

  it('uses server-side pagination and fetches only page-linked fax Communications', async () => {
    const search = mockSearch({
      page: [task, patient, appointment],
      communications: [
        {
          resourceType: 'Communication',
          id: 'comm-1',
          status: 'completed',
          extension: [
            {
              url: OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL,
              valueCodeableConcept: { coding: [{ code: 'DELIVERED' }] },
            },
          ],
        },
      ],
    });

    const result = await performEffect({ channel: 'fax', pageIndex: 2, secrets: null }, { fhir: { search } } as any);

    const taskParams = pageSearch(search).params;
    expect(taskParams).toContainEqual({ name: '_count', value: String(ACTION_LOGS_PAGE_SIZE) });
    expect(taskParams).toContainEqual({ name: '_offset', value: String(ACTION_LOGS_PAGE_SIZE * 2) });
    expect(taskParams).toContainEqual(expect.objectContaining({ name: 'authored-on' }));
    expect(searchesFor(search, 'Communication')[0].params).toContainEqual({ name: '_id', value: 'comm-1' });
    expect(result.logs[0]).toMatchObject({
      status: 'sent',
      patientName: 'Lovelace, Ada',
      documentReferenceId: 'doc-1',
      documentTitle: 'Visit Note',
      canRetry: false,
    });
  });

  it('supports historical attempts without a document reference', async () => {
    const historicalTask: Task = {
      ...makeOutboundDeliveryAttempt({
        channel: 'email',
        patientId: 'patient-1',
        appointmentId: 'appointment-1',
        recipientAddress: 'ada@example.com',
      }),
      id: 'attempt-2',
    };
    const search = mockSearch({ page: [historicalTask, patient, appointment] });

    const result = await performEffect({ channel: 'email', pageIndex: 0, secrets: null }, { fhir: { search } } as any);

    expect(result.logs[0]).toHaveProperty('documentReferenceId', undefined);
    // Email records no sending address, so neither Communications nor sender organizations are fetched.
    expect(searchesFor(search, 'Communication')).toHaveLength(0);
    expect(searchesFor(search, 'Organization')).toHaveLength(0);
  });

  it('reports the sender fax number of the organization the attempt was sent from', async () => {
    const taskWithSender: Task = {
      ...makeOutboundDeliveryAttempt({
        channel: 'fax',
        patientId: 'patient-1',
        appointmentId: 'appointment-1',
        recipientAddress: '+12125551234',
        communicationReference: 'Communication/comm-1',
        senderOrganizationReference: 'Organization/org-1',
      }),
      id: 'attempt-sender',
    };
    const search = mockSearch({
      page: [taskWithSender, patient, appointment],
      organizations: [
        {
          resourceType: 'Organization',
          id: 'org-1',
          telecom: [
            { system: 'phone', value: '+12125550001' },
            { system: 'fax', value: '+12125559999' },
          ],
        },
      ],
    });

    const result = await performEffect({ channel: 'fax', pageIndex: 0, secrets: null }, { fhir: { search } } as any);

    expect(searchesFor(search, 'Organization')[0].params).toContainEqual({ name: '_id', value: 'org-1' });
    expect(result.logs[0].senderAddress).toBe('+12125559999');
  });

  it('leaves the sender fax number out when the attempt names no sending organization', async () => {
    const search = mockSearch({ page: [task, patient, appointment] });

    const result = await performEffect({ channel: 'fax', pageIndex: 0, secrets: null }, { fhir: { search } } as any);

    expect(result.logs[0].senderAddress).toBeUndefined();
    expect(searchesFor(search, 'Organization')).toHaveLength(0);
  });

  it('still renders the page when the sender organizations cannot be read', async () => {
    const taskWithSender: Task = {
      ...makeOutboundDeliveryAttempt({
        channel: 'fax',
        patientId: 'patient-1',
        appointmentId: 'appointment-1',
        recipientAddress: '+12125551234',
        senderOrganizationReference: 'Organization/org-1',
      }),
      id: 'attempt-sender',
    };
    // The sender column is informational: losing it must not cost the user the log rows themselves.
    const search = mockSearch({ page: [taskWithSender, patient, appointment], organizations: new Error('forbidden') });

    const result = await performEffect({ channel: 'fax', pageIndex: 0, secrets: null }, { fhir: { search } } as any);

    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].senderAddress).toBeUndefined();
  });

  it('disables retry after a failed attempt already has a child', async () => {
    const failedTask: Task = { ...task, status: 'failed' };
    const child: Task = {
      ...makeOutboundDeliveryAttempt({
        channel: 'fax',
        patientId: 'patient-1',
        appointmentId: 'appointment-1',
        recipientAddress: '+12125551234',
        parentAttemptId: 'attempt-1',
      }),
      id: 'attempt-child',
    };
    const search = mockSearch({ page: [failedTask, patient, appointment], children: [child] });

    const result = await performEffect({ channel: 'fax', pageIndex: 0, secrets: null }, { fhir: { search } } as any);

    expect(result.logs[0].canRetry).toBe(false);
    expect(childSearch(search)?.params).toContainEqual({ name: 'part-of', value: 'Task/attempt-1' });
    expect(childSearch(search)?.params).toContainEqual({ name: '_count', value: '1' });
  });

  it('allows a failed attempt with a recipient and no child to be retried', async () => {
    const failedTask: Task = { ...task, status: 'failed' };
    const search = mockSearch({ page: [failedTask, patient, appointment] });

    const result = await performEffect({ channel: 'fax', pageIndex: 0, secrets: null }, { fhir: { search } } as any);

    expect(result.logs[0].canRetry).toBe(true);
  });

  it('labels packet attempts from their parts and allows patient-level fax retries', async () => {
    const patientPacket: Task = {
      ...makeOutboundDeliveryAttempt({
        channel: 'fax',
        patientId: 'patient-1',
        recipientAddress: '+12125551234',
        documentReferenceId: 'packet-1',
        faxPacketParts: ['Insurance card', 'Lab result'],
      }),
      id: 'attempt-patient-packet',
      status: 'failed',
    };
    const search = mockSearch({ page: [patientPacket, patient] });

    const result = await performEffect({ channel: 'fax', pageIndex: 0, secrets: null }, { fhir: { search } } as any);

    expect(result.logs[0]).toMatchObject({
      appointmentId: undefined,
      documentTitle: 'Fax packet (2 documents)',
      canRetry: true,
    });
  });

  it('does not allow retry when the stored recipient is empty', async () => {
    const failedWithoutRecipient: Task = {
      ...makeOutboundDeliveryAttempt({
        channel: 'email',
        patientId: 'patient-1',
        appointmentId: 'appointment-1',
        recipientAddress: '',
      }),
      id: 'attempt-empty-recipient',
      status: 'failed',
    };
    const search = mockSearch({ page: [failedWithoutRecipient, patient, appointment] });

    const result = await performEffect({ channel: 'email', pageIndex: 0, secrets: null }, { fhir: { search } } as any);

    expect(result.logs[0].canRetry).toBe(false);
  });

  it('removes the 30-day window when an explicit historical search is supplied', async () => {
    const search = mockSearch();
    await performEffect(
      {
        channel: 'email',
        patientName: 'Ada',
        visitDate: '2020-01-01T00:00:00.000-05:00',
        pageIndex: 0,
        secrets: null,
      },
      { fhir: { search } } as any
    );
    const params = pageSearch(search).params;
    expect(params).toContainEqual({ name: 'patient:Patient.name', value: 'Ada' });
    expect(params).toContainEqual({ name: 'focus:Appointment.date', value: 'ge2020-01-01T05:00:00.000Z' });
    expect(params).toContainEqual({ name: 'focus:Appointment.date', value: 'lt2020-01-02T05:00:00.000Z' });
    expect(params.some((parameter) => parameter.name === 'authored-on')).toBe(false);
  });

  it('builds patient-scoped visit filters with the fixed server page size', async () => {
    const search = mockSearch();
    await performEffect(
      {
        channel: 'fax',
        patientId: 'patient-1',
        patientName: 'Ada',
        visitId: 'appointment-1',
        visitDate: '2025-01-01T00:00:00.000-05:00',
        pageIndex: 1,
        secrets: null,
      },
      { fhir: { search } } as any
    );
    const params = pageSearch(search).params;
    expect(params).toContainEqual({ name: 'patient', value: 'Patient/patient-1' });
    expect(params).toContainEqual({ name: 'focus', value: 'Appointment/appointment-1' });
    expect(params).toContainEqual({ name: '_offset', value: String(ACTION_LOGS_PAGE_SIZE) });
    expect(params).toContainEqual({ name: '_count', value: String(ACTION_LOGS_PAGE_SIZE) });
  });

  it('maps provider and Task terminal states, falling back to the Task when the Communication is unresolved', () => {
    expect(getOutboundDeliveryAttemptStatus({ ...task, status: 'failed' })).toBe('failed');
    // A completed Task with no resolvable Communication is the shape of a legacy/backfilled attempt
    // (or a live attempt whose Communication hasn't propagated yet) — the provider already accepted
    // the fax, so it should read as sent rather than stuck pending forever.
    expect(getOutboundDeliveryAttemptStatus({ ...task, status: 'completed' })).toBe('sent');
    expect(getOutboundDeliveryAttemptStatus({ ...task, status: 'in-progress' })).toBe('pending');
    expect(
      getOutboundDeliveryAttemptStatus(task, {
        resourceType: 'Communication',
        status: 'completed',
        extension: [
          {
            url: OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL,
            valueCodeableConcept: { coding: [{ code: 'STOPPED' }] },
          },
        ],
      })
    ).toBe('failed');
  });
});
