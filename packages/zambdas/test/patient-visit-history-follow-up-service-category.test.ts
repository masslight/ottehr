import { Appointment, Encounter } from 'fhir/r4b';
import { SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { FOLLOWUP_SUBTYPE_SYSTEM, FOLLOWUP_SYSTEMS } from 'utils/lib/fhir/encounter';
import { describe, expect, it } from 'vitest';
import { followUpVisitHistoryRowFromEncounter } from '../src/ehr/patient-visit-history/get/index';

const parentEncounter: Encounter = {
  resourceType: 'Encounter',
  id: 'parent-enc',
  status: 'finished',
  class: { code: 'ACUTE' },
  appointment: [{ reference: 'Appointment/parent-appt' }],
};

const followUpEncounter = (subtype: 'scheduled' | 'annotation', ownAppointmentId?: string): Encounter => ({
  resourceType: 'Encounter',
  id: `follow-up-enc-${subtype}`,
  status: 'planned',
  class: { code: 'ACUTE' },
  partOf: { reference: 'Encounter/parent-enc' },
  type: [
    {
      text: 'Follow-up',
      coding: [
        { system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code },
        ...(subtype === 'scheduled' ? [{ system: FOLLOWUP_SUBTYPE_SYSTEM, code: 'scheduled' }] : []),
      ],
    },
  ],
  ...(ownAppointmentId ? { appointment: [{ reference: `Appointment/${ownAppointmentId}` }] } : {}),
});

const appointmentWithCategory = (id: string, code?: string): Appointment => ({
  resourceType: 'Appointment',
  id,
  status: 'booked',
  start: '2026-09-01T15:00:00.000Z',
  participant: [],
  ...(code ? { serviceCategory: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code }] }] } : {}),
});

const buildRow = (
  encounter: Encounter,
  appointments: Appointment[]
): ReturnType<typeof followUpVisitHistoryRowFromEncounter> =>
  followUpVisitHistoryRowFromEncounter(encounter, {
    practitioners: [],
    locations: [],
    originalEncounter: parentEncounter,
    // the parent visit's category, as computed by the caller
    serviceCategory: 'urgent-care',
    appointments,
  });

describe('follow-up rows report their own service category', () => {
  it('uses the scheduled follow-up appointment category, not the parent visit category', () => {
    const row = buildRow(followUpEncounter('scheduled', 'follow-up-appt'), [
      appointmentWithCategory('parent-appt', 'urgent-care'),
      appointmentWithCategory('follow-up-appt', 'occupational-medicine'),
    ]);

    expect(row?.serviceCategory).toBe('occupational-medicine');
  });

  it('falls back to the parent category when the follow-up appointment has none', () => {
    const row = buildRow(followUpEncounter('scheduled', 'follow-up-appt'), [
      appointmentWithCategory('parent-appt', 'urgent-care'),
      appointmentWithCategory('follow-up-appt'),
    ]);

    expect(row?.serviceCategory).toBe('urgent-care');
  });

  it('inherits the parent category for annotation follow-ups, which have no appointment', () => {
    const row = buildRow(followUpEncounter('annotation'), [appointmentWithCategory('parent-appt', 'urgent-care')]);

    expect(row?.serviceCategory).toBe('urgent-care');
  });
});
