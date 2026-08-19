import { DiagnosticReport, Encounter, ServiceRequest } from 'fhir/r4b';
import { RadiologyOrderStatus } from 'utils/lib/types/api/radiology';
import { describe, expect, test } from 'vitest';
import { canCallerEditFinalReport } from '../../src/ehr/radiology/order-list';

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

const finalReportBy = (authorId?: string): DiagnosticReport =>
  ({
    resourceType: 'DiagnosticReport',
    id: 'dr-final',
    status: 'final',
    code: {},
    ...(authorId ? { performer: [{ reference: `Practitioner/${authorId}` }] } : {}),
  }) as DiagnosticReport;

describe('Radiology order-list - canCallerEditFinalReport', () => {
  test('lets the requester who wrote the read edit it', () => {
    expect(
      canCallerEditFinalReport(
        serviceRequest(CALLER),
        undefined,
        finalReportBy(CALLER),
        RadiologyOrderStatus.final,
        CALLER
      )
    ).toBe(true);
  });

  // A nurse routinely places the order on the provider's behalf, so the requester is not always the provider.
  test("lets the visit's attending provider edit a read they wrote but did not place the order for", () => {
    expect(
      canCallerEditFinalReport(
        serviceRequest(SOMEONE_ELSE),
        encounterAttendedBy(CALLER),
        finalReportBy(CALLER),
        RadiologyOrderStatus.final,
        CALLER
      )
    ).toBe(true);
  });

  test('refuses once the order has been signed off', () => {
    expect(
      canCallerEditFinalReport(
        serviceRequest(CALLER),
        undefined,
        finalReportBy(CALLER),
        RadiologyOrderStatus.reviewed,
        CALLER
      )
    ).toBe(false);
  });

  test('refuses a teleradiology read, which carries no author of ours', () => {
    expect(
      canCallerEditFinalReport(
        serviceRequest(CALLER),
        undefined,
        finalReportBy(undefined),
        RadiologyOrderStatus.final,
        CALLER
      )
    ).toBe(false);
  });

  test('refuses when someone else wrote the read', () => {
    expect(
      canCallerEditFinalReport(
        serviceRequest(CALLER),
        undefined,
        finalReportBy(SOMEONE_ELSE),
        RadiologyOrderStatus.final,
        CALLER
      )
    ).toBe(false);
  });

  test('refuses when the caller wrote the read but had nothing to do with ordering the study', () => {
    expect(
      canCallerEditFinalReport(
        serviceRequest(SOMEONE_ELSE),
        encounterAttendedBy(SOMEONE_ELSE),
        finalReportBy(CALLER),
        RadiologyOrderStatus.final,
        CALLER
      )
    ).toBe(false);
  });

  test('refuses when the caller has no Practitioner profile', () => {
    expect(
      canCallerEditFinalReport(
        serviceRequest(CALLER),
        undefined,
        finalReportBy(CALLER),
        RadiologyOrderStatus.final,
        undefined
      )
    ).toBe(false);
  });

  test('refuses when there is no final read yet', () => {
    expect(
      canCallerEditFinalReport(serviceRequest(CALLER), undefined, undefined, RadiologyOrderStatus.preliminary, CALLER)
    ).toBe(false);
  });
});
