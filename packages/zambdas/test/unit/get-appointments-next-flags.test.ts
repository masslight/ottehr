import { InPersonAppointmentInformation, TIMEZONE_EXTENSION_URL } from 'utils';
import { describe, expect, test } from 'vitest';
import { assignNextFlagsByPartition } from '../../src/ehr/get-appointments';

const makeAppointment = (
  id: string,
  start: string,
  locationId: string,
  timezone = 'America/New_York'
): InPersonAppointmentInformation =>
  ({
    id,
    encounterId: `encounter-${id}`,
    start,
    reasonForVisit: 'Reason',
    status: 'arrived',
    paperwork: {
      demographics: true,
      photoID: true,
      insuranceCard: true,
      consent: true,
      ovrpInterest: false,
    },
    participants: {},
    appointmentStatus: 'booked',
    encounter: { resourceType: 'Encounter', id: `encounter-${id}` },
    patient: {
      id: `patient-${id}`,
      firstName: 'Test',
      lastName: 'Patient',
      dateOfBirth: '2000-01-01',
    },
    visitStatusHistory: [],
    next: false,
    location: {
      resourceType: 'Location',
      id: locationId,
      extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: timezone }],
    },
  }) as unknown as InPersonAppointmentInformation;

const makeLocationlessAppointment = (id: string, start: string): InPersonAppointmentInformation => {
  const appointment = makeAppointment(id, start, 'unused') as { location?: unknown };
  delete appointment.location;
  return appointment as InPersonAppointmentInformation;
};

describe('assignNextFlagsByPartition', () => {
  test('marks one next appointment per location and local day partition', () => {
    const appointments = [
      makeAppointment('1', '2026-06-05T08:00:00.000-04:00', 'loc-a'),
      makeAppointment('2', '2026-06-05T09:00:00.000-04:00', 'loc-a'),
      makeAppointment('3', '2026-06-06T08:00:00.000-04:00', 'loc-a'),
      makeAppointment('4', '2026-06-05T10:00:00.000-04:00', 'loc-b'),
    ];

    const result = assignNextFlagsByPartition(appointments, 'arrived', 'America/New_York');

    expect(result.map((appointment) => appointment.next)).toEqual([true, false, true, true]);
  });

  test('partitions by location-local day when the UTC date crosses midnight', () => {
    const appointments = [
      makeAppointment('1', '2026-06-06T03:00:00.000Z', 'loc-a'),
      makeAppointment('2', '2026-06-06T13:00:00.000Z', 'loc-a'),
      makeAppointment('3', '2026-06-06T14:00:00.000Z', 'loc-a'),
    ];

    const result = assignNextFlagsByPartition(appointments, 'arrived', 'UTC');

    expect(result.map((appointment) => appointment.next)).toEqual([true, true, false]);
  });

  test('uses the offset embedded in start for locationless rows instead of the request timezone', () => {
    // Both appointments fall on the same local day (2026-06-05) per their embedded -04:00 offset,
    // even though they straddle UTC midnight (one is 06-06 in UTC). With no location to supply a
    // timezone, the request timezone fallback ('UTC') would wrongly split them across two days.
    const appointments = [
      makeLocationlessAppointment('1', '2026-06-05T23:00:00.000-04:00'),
      makeLocationlessAppointment('2', '2026-06-05T18:00:00.000-04:00'),
    ];

    const result = assignNextFlagsByPartition(appointments, 'arrived', 'UTC');

    expect(result.map((appointment) => appointment.next)).toEqual([true, false]);
  });
});
