import { Appointment, Encounter } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { extractReviewAndSignAppointmentData } from './appointments';

describe('extractReviewAndSignAppointmentData', () => {
  it('matches encounter by appointment reference instead of first bundle order', () => {
    const targetAppointment: Appointment = {
      resourceType: 'Appointment',
      id: 'target-appointment',
      status: 'fulfilled',
      start: '2026-03-23T10:00:00.000Z',
      participant: [],
    };
    const parentAppointment: Appointment = {
      resourceType: 'Appointment',
      id: 'parent-appointment',
      status: 'fulfilled',
      start: '2026-03-20T10:00:00.000Z',
      participant: [],
    };
    const parentEncounter: Encounter = {
      resourceType: 'Encounter',
      id: 'parent-encounter',
      status: 'finished',
      appointment: [{ reference: 'Appointment/parent-appointment' }],
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR', display: 'virtual' },
      statusHistory: [{ status: 'finished', period: { end: '2026-03-20T10:45:00.000Z' } }],
    };
    const targetEncounter: Encounter = {
      resourceType: 'Encounter',
      id: 'target-encounter',
      status: 'finished',
      appointment: [{ reference: 'Appointment/target-appointment' }],
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR', display: 'virtual' },
      statusHistory: [{ status: 'finished', period: { end: '2026-03-23T10:30:00.000Z' } }],
    };

    const result = extractReviewAndSignAppointmentData(
      [parentAppointment, targetAppointment, parentEncounter, targetEncounter],
      { appointmentId: 'target-appointment' }
    );

    expect(result).toEqual({ signedOnDate: '2026-03-23T10:30:00.000Z' });
  });

  it('prefers main appointment when no context is provided and follow-up appointment appears first', () => {
    const followupAppointment: Appointment = {
      resourceType: 'Appointment',
      id: 'followup-appointment',
      status: 'booked',
      participant: [],
    };
    const mainAppointment: Appointment = {
      resourceType: 'Appointment',
      id: 'main-appointment',
      status: 'fulfilled',
      participant: [],
    };
    const mainEncounter: Encounter = {
      resourceType: 'Encounter',
      id: 'main-encounter',
      status: 'finished',
      appointment: [{ reference: 'Appointment/main-appointment' }],
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR', display: 'virtual' },
      statusHistory: [{ status: 'finished', period: { end: '2026-03-20T12:00:00.000Z' } }],
    };
    const followupEncounter: Encounter = {
      resourceType: 'Encounter',
      id: 'followup-encounter',
      status: 'planned',
      partOf: { reference: 'Encounter/main-encounter' },
      appointment: [{ reference: 'Appointment/followup-appointment' }],
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR', display: 'virtual' },
    };

    const result = extractReviewAndSignAppointmentData([
      followupAppointment,
      mainAppointment,
      followupEncounter,
      mainEncounter,
    ]);

    expect(result).toEqual({ signedOnDate: '2026-03-20T12:00:00.000Z' });
  });
});
