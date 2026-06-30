import { RelatedPerson } from 'fhir/r4b';
import { findInvitedParticipantRefBySubject } from '../../src/patient/join-call';

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
  ];

  test('resolves an email invite subject to the invited RelatedPerson ref', () => {
    expect(findInvitedParticipantRefBySubject('invitee@example.com', relatedPersons)).toBe(
      'RelatedPerson/email-invite'
    );
  });

  test('resolves a phone invite subject to the invited RelatedPerson ref', () => {
    expect(findInvitedParticipantRefBySubject('+15555550123', relatedPersons)).toBe('RelatedPerson/phone-invite');
  });

  test('does not match uninvited subjects', () => {
    expect(findInvitedParticipantRefBySubject('other@example.com', relatedPersons)).toBeUndefined();
  });
});
