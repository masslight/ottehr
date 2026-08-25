import { Appointment, Encounter } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { isVisitFinished } from './visitUtils';

// Guards the "don't retroactively hide finished visits" rule: the chart gate for a visit's assigned
// provider must not apply once the visit is a record rather than work in progress. Status is the
// signal because the appointment lock meta tag only exists on visits signed after locking landed.

const visit = (
  appointmentStatus: string,
  encounterStatus: string,
  encounterExtras: Partial<Encounter> = {}
): [Appointment, Encounter] => [
  { resourceType: 'Appointment', status: appointmentStatus, participant: [] } as unknown as Appointment,
  { resourceType: 'Encounter', status: encounterStatus, ...encounterExtras } as unknown as Encounter,
];

describe('isVisitFinished', () => {
  it('is true for a completed visit', () => {
    expect(isVisitFinished(...visit('fulfilled', 'finished'))).toBe(true);
  });

  // Never carries the lock tag — the pending-supervisor-approval zambda doesn't write one — so the
  // status is the only thing that identifies it as past charting.
  it('is true for a visit awaiting supervisor approval', () => {
    expect(
      isVisitFinished(
        ...visit('fulfilled', 'finished', {
          extension: [{ url: 'awaiting-supervisor-approval', valueBoolean: true }],
        })
      )
    ).toBe(true);
  });

  it('is true for cancelled and no-show visits', () => {
    expect(isVisitFinished(...visit('cancelled', 'cancelled'))).toBe(true);
    expect(isVisitFinished(...visit('noshow', 'planned'))).toBe(true);
  });

  it('is false for a visit still being worked', () => {
    // 'discharged' — an attender with a closed period, the state a visit is signed from.
    const [appointment, encounter] = visit('fulfilled', 'in-progress');
    encounter.participant = [
      {
        type: [{ coding: [{ code: 'ATND' }] }],
        period: { start: '2026-01-01T10:00:00Z', end: '2026-01-01T11:00:00Z' },
      },
    ];
    expect(isVisitFinished(appointment, encounter)).toBe(false);
  });

  it('is false when either resource is missing', () => {
    const [appointment, encounter] = visit('fulfilled', 'finished');
    expect(isVisitFinished(undefined, undefined)).toBe(false);
    expect(isVisitFinished(appointment, undefined)).toBe(false);
    expect(isVisitFinished(undefined, encounter)).toBe(false);
  });
});
