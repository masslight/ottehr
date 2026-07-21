import { Appointment, Communication, Patient, Task } from 'fhir/r4b';
import {
  ACTION_LOGS_PAGE_SIZE,
  getOutboundDeliveryAttemptStatus,
  makeOutboundDeliveryAttempt,
  OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL,
} from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../src/ehr/get-action-logs';

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
  it('uses server-side pagination and fetches only page-linked fax Communications', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({ unbundle: () => [task, patient, appointment], total: 1 })
      .mockResolvedValueOnce({
        unbundle: () => [
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
          } as Communication,
        ],
      });
    const result = await performEffect({ channel: 'fax', pageIndex: 2, secrets: null }, { fhir: { search } } as any);
    const taskParams = search.mock.calls[0][0].params;
    expect(taskParams).toContainEqual({ name: '_count', value: String(ACTION_LOGS_PAGE_SIZE) });
    expect(taskParams).toContainEqual({ name: '_offset', value: String(ACTION_LOGS_PAGE_SIZE * 2) });
    expect(taskParams).toContainEqual(expect.objectContaining({ name: 'authored-on' }));
    expect(search.mock.calls[1][0].params).toContainEqual({ name: '_id', value: 'comm-1' });
    expect(result.logs[0]).toMatchObject({
      status: 'sent',
      patientName: 'Lovelace, Ada',
      documentReferenceId: 'doc-1',
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
    const search = vi.fn().mockResolvedValue({ unbundle: () => [historicalTask, patient, appointment], total: 1 });

    const result = await performEffect({ channel: 'email', pageIndex: 0, secrets: null }, { fhir: { search } } as any);

    expect(result.logs[0]).toHaveProperty('documentReferenceId', undefined);
  });

  it('removes the 30-day window when an explicit historical search is supplied', async () => {
    const search = vi.fn().mockResolvedValue({ unbundle: () => [], total: 0 });
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
    const params = search.mock.calls[0][0].params;
    expect(params).toContainEqual({ name: 'patient:Patient.name', value: 'Ada' });
    expect(params).toContainEqual({ name: 'focus:Appointment.date', value: 'ge2020-01-01T05:00:00.000Z' });
    expect(params).toContainEqual({ name: 'focus:Appointment.date', value: 'lt2020-01-02T05:00:00.000Z' });
    expect(params.some((parameter: any) => parameter.name === 'authored-on')).toBe(false);
  });

  it('builds patient-scoped visit filters with the fixed server page size', async () => {
    const search = vi.fn().mockResolvedValue({ unbundle: () => [], total: 0 });
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
    const params = search.mock.calls[0][0].params;
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
