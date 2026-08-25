import { DiagnosticReport, ServiceRequest, Task } from 'fhir/r4b';
import { TASK_ASSIGNED_DATE_TIME_EXTENSION_URL } from 'utils/lib/fhir/constants';
import {
  DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL,
  SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL,
  SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL,
  SERVICE_REQUEST_SENT_FOR_FINAL_READ_BY_EXTENSION_URL,
} from 'utils/lib/fhir/radiology';
import { RadiologyOrderStatus } from 'utils/lib/types/api/radiology';
import { RADIOLOGY_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, test } from 'vitest';
import { buildHistory } from '../../src/ehr/radiology/order-list';

const ORDERED_AT = '2026-08-13T10:00:00.000Z';
const PERFORMED_AT = '2026-08-13T11:00:00.000Z';
const PRELIMINARY_AT = '2026-08-13T12:00:00.000Z';
const SENT_FOR_FINAL_AT = '2026-08-13T13:00:00.000Z';
const FINAL_AT = '2026-08-13T14:00:00.000Z';
const REVIEWED_AT = '2026-08-13T15:00:00.000Z';

// A different name per row, so a test can tell "read its own field" from "borrowed someone else's".
const ORDERING_PROVIDER = 'Dr. Ordering';
const PERFORMED_BY = 'Magnus Carlsen, PA';
const PRELIMINARY_AUTHOR = 'Dr. Preliminary';
const SENT_BY = 'Dr. Sender';
const FINAL_AUTHOR = 'Dr. Final';
const REVIEWER = 'Dr. Reviewer';

const serviceRequest = (opts: { sentForFinalRead?: boolean; sentBy?: string } = {}): ServiceRequest =>
  ({
    resourceType: 'ServiceRequest',
    id: 'sr-1',
    status: 'completed',
    intent: 'order',
    subject: { reference: 'Patient/p-1' },
    extension: [
      { url: SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL, valueDateTime: ORDERED_AT },
      { url: SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL, valueDateTime: PERFORMED_AT },
      ...(opts.sentForFinalRead
        ? [{ url: SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL, valueDateTime: SENT_FOR_FINAL_AT }]
        : []),
      ...(opts.sentBy
        ? [
            {
              url: SERVICE_REQUEST_SENT_FOR_FINAL_READ_BY_EXTENSION_URL,
              valueReference: { reference: 'Practitioner/prac-2', display: opts.sentBy },
            },
          ]
        : []),
    ],
  }) as ServiceRequest;

const preliminaryReport = (authorDisplay?: string): DiagnosticReport =>
  ({
    resourceType: 'DiagnosticReport',
    id: 'dr-prelim',
    status: 'preliminary',
    code: {},
    extension: [{ url: DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL, valueDateTime: PRELIMINARY_AT }],
    ...(authorDisplay ? { performer: [{ reference: 'Practitioner/prac-3', display: authorDisplay }] } : {}),
  }) as DiagnosticReport;

const finalReport = (performerDisplay?: string): DiagnosticReport =>
  ({
    resourceType: 'DiagnosticReport',
    id: 'dr-final',
    status: 'final',
    code: {},
    issued: FINAL_AT,
    extension: [{ url: DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL, valueDateTime: PRELIMINARY_AT }],
    ...(performerDisplay ? { performer: [{ reference: 'Practitioner/prac-1', display: performerDisplay }] } : {}),
  }) as DiagnosticReport;

const completedReviewTask = (): Task =>
  ({
    resourceType: 'Task',
    id: 'task-1',
    status: 'completed',
    intent: 'order',
    groupIdentifier: { value: RADIOLOGY_TASK.category },
    code: { coding: [{ system: RADIOLOGY_TASK.system, code: RADIOLOGY_TASK.code.reviewFinalResultTask }] },
    owner: {
      reference: 'Practitioner/prac-4',
      display: REVIEWER,
      extension: [{ url: TASK_ASSIGNED_DATE_TIME_EXTENSION_URL, valueDateTime: REVIEWED_AT }],
    },
  }) as Task;

const performerFor = (history: ReturnType<typeof buildHistory>, status: RadiologyOrderStatus): string | undefined =>
  history.find((row) => row.status === status)?.performer;

describe('Radiology order-list - buildHistory', () => {
  // The point of the whole design: no two rows read the same field, so one person's name can never
  // stand in for another's.
  test('gives every row its own performer, from the resource that transition created', () => {
    const history = buildHistory(
      serviceRequest({ sentForFinalRead: true, sentBy: SENT_BY }),
      finalReport(FINAL_AUTHOR),
      preliminaryReport(PRELIMINARY_AUTHOR),
      ORDERING_PROVIDER,
      PERFORMED_BY,
      completedReviewTask()
    );

    expect(performerFor(history, RadiologyOrderStatus.pending)).toBe(ORDERING_PROVIDER);
    expect(performerFor(history, RadiologyOrderStatus.performed)).toBe(PERFORMED_BY);
    expect(performerFor(history, RadiologyOrderStatus.preliminary)).toBe(PRELIMINARY_AUTHOR);
    expect(performerFor(history, RadiologyOrderStatus.pendingFinal)).toBe(SENT_BY);
    expect(performerFor(history, RadiologyOrderStatus.final)).toBe(FINAL_AUTHOR);
    expect(performerFor(history, RadiologyOrderStatus.reviewed)).toBe(REVIEWER);

    const performers = history.map((row) => row.performer);
    expect(new Set(performers).size).toBe(performers.length);
  });

  test('credits the preliminary read to its own author, not to whoever performed the study', () => {
    const history = buildHistory(
      serviceRequest(),
      undefined,
      preliminaryReport(PRELIMINARY_AUTHOR),
      ORDERING_PROVIDER,
      PERFORMED_BY,
      undefined
    );

    expect(performerFor(history, RadiologyOrderStatus.performed)).toBe(PERFORMED_BY);
    expect(performerFor(history, RadiologyOrderStatus.preliminary)).toBe(PRELIMINARY_AUTHOR);
  });

  test('leaves the preliminary performer blank when the read has no recorded author', () => {
    const history = buildHistory(
      serviceRequest(),
      undefined,
      preliminaryReport(),
      ORDERING_PROVIDER,
      PERFORMED_BY,
      undefined
    );

    expect(performerFor(history, RadiologyOrderStatus.preliminary)).toBe('');
  });

  // Orders finalized before the preliminary read was kept as its own resource: the date still comes off the
  // final report, but its `performer` is the final read's author and must not be borrowed for this row.
  test('never borrows the final read’s author for a legacy preliminary row', () => {
    const history = buildHistory(
      serviceRequest(),
      finalReport(FINAL_AUTHOR),
      undefined,
      ORDERING_PROVIDER,
      PERFORMED_BY,
      undefined
    );

    expect(performerFor(history, RadiologyOrderStatus.preliminary)).toBe('');
    expect(performerFor(history, RadiologyOrderStatus.final)).toBe(FINAL_AUTHOR);
  });

  test('credits an in-house final read to the practitioner who wrote it', () => {
    const history = buildHistory(
      serviceRequest(),
      finalReport(FINAL_AUTHOR),
      preliminaryReport(PRELIMINARY_AUTHOR),
      ORDERING_PROVIDER,
      PERFORMED_BY,
      undefined
    );

    expect(performerFor(history, RadiologyOrderStatus.final)).toBe(FINAL_AUTHOR);
  });

  test("leaves the final performer blank for teleradiology's read, which carries no author of ours", () => {
    const history = buildHistory(
      serviceRequest({ sentForFinalRead: true }),
      finalReport(),
      preliminaryReport(PRELIMINARY_AUTHOR),
      ORDERING_PROVIDER,
      PERFORMED_BY,
      undefined
    );

    expect(performerFor(history, RadiologyOrderStatus.final)).toBe('');
  });

  test('leaves the "pending final" performer blank when nobody was recorded as sending it', () => {
    const history = buildHistory(
      serviceRequest({ sentForFinalRead: true }),
      undefined,
      preliminaryReport(PRELIMINARY_AUTHOR),
      ORDERING_PROVIDER,
      PERFORMED_BY,
      undefined
    );

    expect(performerFor(history, RadiologyOrderStatus.pendingFinal)).toBe('');
  });

  test('only records "pending final" once the order has been sent for a final read', () => {
    const inHouse = buildHistory(
      serviceRequest(),
      finalReport(PERFORMED_BY),
      preliminaryReport(),
      ORDERING_PROVIDER,
      PERFORMED_BY,
      undefined
    );
    expect(inHouse.map((row) => row.status)).not.toContain(RadiologyOrderStatus.pendingFinal);

    const sentToTeleradiology = buildHistory(
      serviceRequest({ sentForFinalRead: true }),
      finalReport(),
      preliminaryReport(),
      ORDERING_PROVIDER,
      PERFORMED_BY,
      undefined
    );
    expect(sentToTeleradiology.map((row) => row.status)).toContain(RadiologyOrderStatus.pendingFinal);
  });

  test('walks the full lifecycle in order, ending with the reviewer', () => {
    const history = buildHistory(
      serviceRequest({ sentForFinalRead: true, sentBy: SENT_BY }),
      finalReport(FINAL_AUTHOR),
      preliminaryReport(PRELIMINARY_AUTHOR),
      ORDERING_PROVIDER,
      PERFORMED_BY,
      completedReviewTask()
    );

    expect(history.map((row) => row.status)).toEqual([
      RadiologyOrderStatus.pending,
      RadiologyOrderStatus.performed,
      RadiologyOrderStatus.preliminary,
      RadiologyOrderStatus.pendingFinal,
      RadiologyOrderStatus.final,
      RadiologyOrderStatus.reviewed,
    ]);
    expect(performerFor(history, RadiologyOrderStatus.reviewed)).toBe(REVIEWER);
  });
});
