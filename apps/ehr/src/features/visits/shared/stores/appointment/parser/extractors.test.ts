import { Appointment, Encounter, QuestionnaireResponse } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { getResources } from './extractors';

describe('getResources', () => {
  it('selects appointment and questionnaire by explicit context IDs', () => {
    const parentAppointment: Appointment = {
      resourceType: 'Appointment',
      id: 'parent-appointment',
      status: 'booked',
      participant: [],
    };
    const followupAppointment: Appointment = {
      resourceType: 'Appointment',
      id: 'followup-appointment',
      status: 'booked',
      participant: [],
    };
    const parentEncounter: Encounter = {
      resourceType: 'Encounter',
      id: 'parent-encounter',
      status: 'in-progress',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR', display: 'virtual' },
      appointment: [{ reference: 'Appointment/parent-appointment' }],
    };
    const followupEncounter: Encounter = {
      resourceType: 'Encounter',
      id: 'followup-encounter',
      status: 'planned',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR', display: 'virtual' },
      partOf: { reference: 'Encounter/parent-encounter' },
      appointment: [{ reference: 'Appointment/followup-appointment' }],
    };
    const parentQuestionnaire: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      id: 'parent-qr',
      status: 'completed',
      encounter: { reference: 'Encounter/parent-encounter' },
    };
    const followupQuestionnaire: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      id: 'followup-qr',
      status: 'completed',
      encounter: { reference: 'Encounter/followup-encounter' },
    };

    const result = getResources(
      [
        parentAppointment,
        followupQuestionnaire,
        parentQuestionnaire,
        followupEncounter,
        parentEncounter,
        followupAppointment,
      ],
      {
        appointmentId: 'followup-appointment',
        encounterId: 'followup-encounter',
      }
    );

    expect(result.appointment?.id).toBe('followup-appointment');
    expect(result.encounter?.id).toBe('followup-encounter');
    expect(result.questionnaireResponse?.id).toBe('followup-qr');
  });

  it('prefers the main appointment when no context is provided and multiple appointments exist', () => {
    const parentAppointment: Appointment = {
      resourceType: 'Appointment',
      id: 'parent-appointment',
      status: 'booked',
      participant: [],
    };
    const followupAppointment: Appointment = {
      resourceType: 'Appointment',
      id: 'followup-appointment',
      status: 'booked',
      participant: [],
    };
    const parentEncounter: Encounter = {
      resourceType: 'Encounter',
      id: 'parent-encounter',
      status: 'in-progress',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR', display: 'virtual' },
      appointment: [{ reference: 'Appointment/parent-appointment' }],
    };
    const followupEncounter: Encounter = {
      resourceType: 'Encounter',
      id: 'followup-encounter',
      status: 'planned',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR', display: 'virtual' },
      partOf: { reference: 'Encounter/parent-encounter' },
      appointment: [{ reference: 'Appointment/followup-appointment' }],
    };
    const parentQuestionnaire: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      id: 'parent-qr',
      status: 'completed',
      encounter: { reference: 'Encounter/parent-encounter' },
    };

    const result = getResources([
      followupAppointment,
      parentAppointment,
      followupEncounter,
      parentEncounter,
      parentQuestionnaire,
    ]);

    expect(result.appointment?.id).toBe('parent-appointment');
    expect(result.encounter?.id).toBe('parent-encounter');
    expect(result.questionnaireResponse?.id).toBe('parent-qr');
  });
});
