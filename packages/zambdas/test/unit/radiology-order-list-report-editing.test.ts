import { DiagnosticReport, Encounter, ServiceRequest } from 'fhir/r4b';
import { RadiologyOrderStatus } from 'utils/lib/types/api/radiology';
import { describe, expect, test } from 'vitest';
import { canCallerEditReport } from '../../src/ehr/radiology/order-list';

const CALLER = 'prac-caller';
const SOMEONE_ELSE = 'prac-other';

const serviceRequest = (requesterId?: string): ServiceRequest =>
  ({
    resourceType: 'ServiceRequest',
    id: 'sr-1',
    status: 'completed',
    intent: 'order',
    subject: { reference: 'Patient/p-1' },
    ...(requesterId ? { requester: { reference: `Practitioner/${requesterId}` } } : {}),
  }) as ServiceRequest;

const encounterAttendedBy = (practitionerId: string): Encounter =>
  ({
    resourceType: 'Encounter',
    id: 'enc-1',
    status: 'finished',
    class: { code: 'AMB' },
    participant: [
      {
        type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'ATND' }] }],
        individual: { reference: `Practitioner/${practitionerId}` },
      },
    ],
  }) as Encounter;

// The rule is the same for either read, so the fixture takes the status too.
const reportBy = (authorId?: string, status: 'preliminary' | 'final' = 'final'): DiagnosticReport =>
  ({
    resourceType: 'DiagnosticReport',
    id: `dr-${status}`,
    status,
    code: {},
    ...(authorId ? { performer: [{ reference: `Practitioner/${authorId}` }] } : {}),
  }) as DiagnosticReport;

describe('Radiology order-list - canCallerEditReport', () => {
  test('lets the requester who wrote the read edit it', () => {
    expect(
      canCallerEditReport(serviceRequest(CALLER), undefined, reportBy(CALLER), RadiologyOrderStatus.final, CALLER)
    ).toBe(true);
  });

  // A nurse routinely places the order on the provider's behalf, so the requester is not always the provider.
  test("lets the visit's attending provider edit a read they wrote but did not place the order for", () => {
    expect(
      canCallerEditReport(
        serviceRequest(SOMEONE_ELSE),
        encounterAttendedBy(CALLER),
        reportBy(CALLER),
        RadiologyOrderStatus.final,
        CALLER
      )
    ).toBe(true);
  });

  test('refuses once the order has been signed off', () => {
    expect(
      canCallerEditReport(serviceRequest(CALLER), undefined, reportBy(CALLER), RadiologyOrderStatus.reviewed, CALLER)
    ).toBe(false);
  });

  // The author is also what marks a read as ours, so its absence gates the ordering provider too: the caller
  // here placed the order and still cannot rewrite what teleradiology issued.
  test('refuses a teleradiology read, which carries no author of ours', () => {
    expect(
      canCallerEditReport(serviceRequest(CALLER), undefined, reportBy(undefined), RadiologyOrderStatus.final, CALLER)
    ).toBe(false);
  });

  // The two roles qualify independently, so the ordering provider can correct a read somebody else wrote…
  test('lets the ordering provider edit a read written by someone else', () => {
    expect(
      canCallerEditReport(serviceRequest(CALLER), undefined, reportBy(SOMEONE_ELSE), RadiologyOrderStatus.final, CALLER)
    ).toBe(true);
  });

  // …and the author can correct their own read even with no part in ordering the study. Requiring both roles
  // of one person would leave this read uncorrectable by anyone.
  test('lets the author edit a read on a study they had nothing to do with ordering', () => {
    expect(
      canCallerEditReport(
        serviceRequest(SOMEONE_ELSE),
        encounterAttendedBy(SOMEONE_ELSE),
        reportBy(CALLER),
        RadiologyOrderStatus.final,
        CALLER
      )
    ).toBe(true);
  });

  test('refuses a caller who neither wrote the read nor ordered the study', () => {
    const bystander = 'prac-bystander';
    expect(
      canCallerEditReport(
        serviceRequest(SOMEONE_ELSE),
        encounterAttendedBy(SOMEONE_ELSE),
        reportBy(SOMEONE_ELSE),
        RadiologyOrderStatus.final,
        bystander
      )
    ).toBe(false);
  });

  test('refuses when the caller has no Practitioner profile', () => {
    expect(
      canCallerEditReport(serviceRequest(CALLER), undefined, reportBy(CALLER), RadiologyOrderStatus.final, undefined)
    ).toBe(false);
  });

  test('refuses when there is no such read yet', () => {
    expect(
      canCallerEditReport(serviceRequest(CALLER), undefined, undefined, RadiologyOrderStatus.preliminary, CALLER)
    ).toBe(false);
  });

  // OTR-3116 settled that a preliminary read is restricted the same way, so it goes through this same rule.
  test('governs a preliminary read on exactly the same terms', () => {
    // Its author.
    expect(
      canCallerEditReport(
        serviceRequest(SOMEONE_ELSE),
        encounterAttendedBy(SOMEONE_ELSE),
        reportBy(CALLER, 'preliminary'),
        RadiologyOrderStatus.preliminary,
        CALLER
      )
    ).toBe(true);

    // The ordering provider, on a read somebody else wrote.
    expect(
      canCallerEditReport(
        serviceRequest(CALLER),
        undefined,
        reportBy(SOMEONE_ELSE, 'preliminary'),
        RadiologyOrderStatus.preliminary,
        CALLER
      )
    ).toBe(true);

    // A preliminary read written before authorship was recorded is nobody's to claim.
    expect(
      canCallerEditReport(
        serviceRequest(CALLER),
        undefined,
        reportBy(undefined, 'preliminary'),
        RadiologyOrderStatus.preliminary,
        CALLER
      )
    ).toBe(false);
  });
});
