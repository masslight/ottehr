import { Encounter, EncounterParticipant } from 'fhir/r4b';
import { PRACTITIONER_CODINGS } from 'utils';
import { describe, expect, test } from 'vitest';
import { getAssignPractitionerToEncounterOperation } from '../../src/ehr/assign-practitioner/helpers/helpers';

const buildEncounter = (participant?: EncounterParticipant[]): Encounter => ({
  resourceType: 'Encounter',
  id: 'encounter-id',
  status: 'in-progress',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR' },
  participant,
});

const inviteeParticipant: EncounterParticipant = {
  individual: { reference: 'RelatedPerson/invitee-id' },
};

const patientRelatedPersonParticipant: EncounterParticipant = {
  individual: { reference: 'RelatedPerson/patient-user-rp-id' },
};

const admitterParticipant: EncounterParticipant = {
  individual: { reference: 'Practitioner/admitter-id' },
  period: { start: '2026-01-01T00:00:00.000Z' },
  type: [{ coding: PRACTITIONER_CODINGS.Admitter }],
};

const replacedParticipants = (operations: any[]): EncounterParticipant[] => {
  expect(operations).toEqual([{ op: 'replace', path: '/participant', value: expect.any(Array) }]);
  return operations[0].value;
};

const references = (participants: EncounterParticipant[]): (string | undefined)[] =>
  participants.map((p) => p.individual?.reference);

describe('getAssignPractitionerToEncounterOperation', () => {
  test('adds participant array when no participants exist', async () => {
    const operations = await getAssignPractitionerToEncounterOperation(
      buildEncounter(),
      'admitter-id',
      PRACTITIONER_CODINGS.Admitter
    );

    expect(operations).toEqual([
      {
        op: 'add',
        path: '/participant',
        value: [
          {
            individual: { reference: 'Practitioner/admitter-id' },
            period: { start: expect.any(String) },
            type: [{ coding: PRACTITIONER_CODINGS.Admitter }],
          },
        ],
      },
    ]);
  });

  test('keeps participants without a type (invited and patient RelatedPersons) when assigning', async () => {
    const operations = await getAssignPractitionerToEncounterOperation(
      buildEncounter([inviteeParticipant, patientRelatedPersonParticipant]),
      'admitter-id',
      PRACTITIONER_CODINGS.Admitter
    );

    expect(references(replacedParticipants(operations))).toEqual([
      'RelatedPerson/invitee-id',
      'RelatedPerson/patient-user-rp-id',
      'Practitioner/admitter-id',
    ]);
  });

  test('replaces an existing participant holding the role being assigned', async () => {
    const operations = await getAssignPractitionerToEncounterOperation(
      buildEncounter([admitterParticipant, inviteeParticipant]),
      'new-admitter-id',
      PRACTITIONER_CODINGS.Admitter
    );

    expect(references(replacedParticipants(operations))).toEqual([
      'RelatedPerson/invitee-id',
      'Practitioner/new-admitter-id',
    ]);
  });

  test('keeps participants holding a different role', async () => {
    const operations = await getAssignPractitionerToEncounterOperation(
      buildEncounter([admitterParticipant, inviteeParticipant]),
      'attender-id',
      PRACTITIONER_CODINGS.Attender
    );

    expect(references(replacedParticipants(operations))).toEqual([
      'Practitioner/admitter-id',
      'RelatedPerson/invitee-id',
      'Practitioner/attender-id',
    ]);
  });

  test('replaces a same-role participant even when their type has additional codings', async () => {
    const multiCodingAttender: EncounterParticipant = {
      individual: { reference: 'Practitioner/old-attender-id' },
      type: [{ coding: [...PRACTITIONER_CODINGS.Attender, { code: 'CON', display: 'consultant' }] }],
    };

    const operations = await getAssignPractitionerToEncounterOperation(
      buildEncounter([multiCodingAttender]),
      'new-attender-id',
      PRACTITIONER_CODINGS.Attender
    );

    expect(references(replacedParticipants(operations))).toEqual(['Practitioner/new-attender-id']);
  });
});
