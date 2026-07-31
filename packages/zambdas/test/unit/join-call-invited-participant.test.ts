import { Encounter, RelatedPerson } from 'fhir/r4b';
import { FHIR_EXTENSION } from 'utils';
import { describe, expect, test, vi } from 'vitest';
import { findInvitedParticipantRefBySubject } from '../../src/patient/join-call';
import { addUserToVideoEncounterIfNeeded } from '../../src/patient/join-call/helpers';

describe('findInvitedParticipantRefBySubject', () => {
  const relatedPersons: RelatedPerson[] = [
    {
      resourceType: 'RelatedPerson',
      id: 'email-invite',
      patient: { reference: 'Patient/patient-id' },
      telecom: [{ system: 'email', value: 'invitee@example.com' }],
    },
    {
      resourceType: 'RelatedPerson',
      id: 'phone-invite',
      patient: { reference: 'Patient/patient-id' },
      telecom: [
        { system: 'phone', value: '+15555550123' },
        { system: 'sms', value: '+15555550123' },
      ],
    },
    {
      resourceType: 'RelatedPerson',
      id: 'sms-only-invite',
      patient: { reference: 'Patient/patient-id' },
      telecom: [{ system: 'sms', value: '+15555550456' }],
    },
  ];

  test('resolves an email invite subject to the invited RelatedPerson ref', () => {
    expect(findInvitedParticipantRefBySubject('invitee@example.com', relatedPersons)).toBe(
      'RelatedPerson/email-invite'
    );
  });

  test('resolves a phone invite subject to the invited RelatedPerson ref', () => {
    expect(findInvitedParticipantRefBySubject('+15555550123', relatedPersons)).toBe('RelatedPerson/phone-invite');
  });

  test('resolves an SMS-only invite subject to the invited RelatedPerson ref', () => {
    expect(findInvitedParticipantRefBySubject('+15555550456', relatedPersons)).toBe('RelatedPerson/sms-only-invite');
  });

  test('does not match uninvited subjects', () => {
    expect(findInvitedParticipantRefBySubject('other@example.com', relatedPersons)).toBeUndefined();
  });
});

describe('addUserToVideoEncounterIfNeeded', () => {
  const makeEncounter = (overrides: Partial<Encounter> = {}): Encounter => ({
    resourceType: 'Encounter',
    id: 'encounter-id',
    status: 'in-progress',
    class: { system: 'class-system', code: 'class-code' },
    ...overrides,
  });

  const makeOystehr = (updatedEncounter: Encounter): any => {
    return {
      fhir: {
        patch: vi.fn().mockResolvedValue(updatedEncounter),
      },
    } as any;
  };

  const otherParticipantsExtension = (refs: string[]): NonNullable<Encounter['extension']>[number] => ({
    url: FHIR_EXTENSION.Encounter.otherParticipants.url,
    extension: refs.map((ref) => ({
      url: FHIR_EXTENSION.Encounter.otherParticipants.extension.otherParticipant.url,
      extension: [
        {
          url: 'reference',
          valueReference: {
            reference: ref,
          },
        },
      ],
    })),
  });

  test('adds provider profile to encounter other-participants when missing', async () => {
    const encounter = makeEncounter();
    const updatedEncounter = makeEncounter({ id: 'updated-encounter-id' });
    const oystehr = makeOystehr(updatedEncounter);

    const result = await addUserToVideoEncounterIfNeeded(encounter, 'Practitioner/provider-id', [], oystehr);

    expect(result).toBe(updatedEncounter);
    expect(oystehr.fhir.patch).toHaveBeenCalledWith({
      resourceType: 'Encounter',
      id: 'encounter-id',
      operations: [
        {
          op: 'add',
          path: '/extension',
          value: [
            expect.objectContaining({
              url: FHIR_EXTENSION.Encounter.otherParticipants.url,
              extension: [
                expect.objectContaining({
                  url: FHIR_EXTENSION.Encounter.otherParticipants.extension.otherParticipant.url,
                }),
              ],
            }),
          ],
        },
      ],
    });
  });

  test('appends to an existing other-participants container without replacing all extensions', async () => {
    const encounter = makeEncounter({ extension: [otherParticipantsExtension(['Practitioner/existing-id'])] });
    const oystehr = makeOystehr(makeEncounter({ id: 'updated-encounter-id' }));

    await addUserToVideoEncounterIfNeeded(encounter, 'Practitioner/provider-id', [], oystehr);

    expect(oystehr.fhir.patch).toHaveBeenCalledWith({
      resourceType: 'Encounter',
      id: 'encounter-id',
      operations: [
        expect.objectContaining({
          op: 'add',
          path: '/extension/0/extension/-',
        }),
      ],
    });
  });

  test('adds invited RelatedPerson refs to Encounter.participant', async () => {
    const encounter = makeEncounter();
    const oystehr = makeOystehr(makeEncounter({ id: 'updated-encounter-id' }));

    await addUserToVideoEncounterIfNeeded(encounter, undefined, ['RelatedPerson/invitee-id'], oystehr);

    expect(oystehr.fhir.patch).toHaveBeenCalledWith({
      resourceType: 'Encounter',
      id: 'encounter-id',
      operations: [
        {
          op: 'add',
          path: '/participant',
          value: [
            {
              individual: {
                reference: 'RelatedPerson/invitee-id',
              },
            },
          ],
        },
      ],
    });
  });

  test('appends invited RelatedPerson refs to an existing Encounter.participant array', async () => {
    const encounter = makeEncounter({
      participant: [
        {
          individual: {
            reference: 'RelatedPerson/existing-id',
          },
        },
      ],
    });
    const oystehr = makeOystehr(makeEncounter({ id: 'updated-encounter-id' }));

    await addUserToVideoEncounterIfNeeded(encounter, undefined, ['RelatedPerson/invitee-id'], oystehr);

    expect(oystehr.fhir.patch).toHaveBeenCalledWith({
      resourceType: 'Encounter',
      id: 'encounter-id',
      operations: [
        {
          op: 'add',
          path: '/participant/-',
          value: {
            individual: {
              reference: 'RelatedPerson/invitee-id',
            },
          },
        },
      ],
    });
  });

  test('does not duplicate existing RelatedPerson refs', async () => {
    const encounter = makeEncounter({
      participant: [
        {
          individual: {
            reference: 'RelatedPerson/invitee-id',
          },
        },
      ],
    });
    const oystehr = makeOystehr(makeEncounter({ id: 'updated-encounter-id' }));

    const result = await addUserToVideoEncounterIfNeeded(encounter, undefined, ['RelatedPerson/invitee-id'], oystehr);

    expect(result).toBe(encounter);
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
  });

  test('does not patch when all participant refs already exist', async () => {
    const encounter = makeEncounter({
      extension: [otherParticipantsExtension(['Practitioner/provider-id'])],
      participant: [
        {
          individual: {
            reference: 'RelatedPerson/invitee-id',
          },
        },
      ],
    });
    const oystehr = makeOystehr(makeEncounter({ id: 'updated-encounter-id' }));

    const result = await addUserToVideoEncounterIfNeeded(
      encounter,
      'Practitioner/provider-id',
      ['RelatedPerson/invitee-id'],
      oystehr
    );

    expect(result).toBe(encounter);
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
  });
});
