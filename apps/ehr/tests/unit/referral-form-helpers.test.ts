import {
  faxBlockedReason,
  NO_FAX_SEND_TEXT,
  NO_RECIPIENT_SEND_TEXT,
  specialtyTag,
  toReferralFormValues,
  toSaveReferralInput,
} from 'src/features/referrals/referralForm.helpers';
import { ReferralDTO } from 'utils/lib/types/api/referrals/referrals.types';
import { SearchAddressBookInputSchema } from 'utils/lib/types/data/address-book';
import { describe, expect, it } from 'vitest';

const referral: ReferralDTO = {
  id: 'referral-1',
  patientId: 'patient-1',
  encounterId: 'encounter-1',
  specialty: 'Rheumatology',
  recipient: { contactId: 'c1', name: 'Riverside', organizationName: 'Riverside', fax: '+12125554321' },
  reason: 'Joint pain',
  urgency: 'routine',
  whatIsAsked: 'evaluate-and-treat',
  whoSchedules: 'patient',
  responseRequested: false,
  includeDocuments: ['progress-note', 'lab-results'],
  earlierDocuments: [],
  referringProvider: { id: 'p1', name: 'Jordan Rivera, MD' },
  status: 'not-sent',
  createdAt: '2026-11-01T15:00:00.000Z',
  responseDocumentReferenceIds: [],
};

describe('specialtyTag', () => {
  it.each([
    ['Orthopedics', 'orthopedics'],
    ['OB/GYN', 'ob gyn'],
    ['Allergy & Immunology', 'allergy immunology'],
  ])('filters the directory for %s by a tag the search accepts', (specialty, tag) => {
    expect(specialtyTag(specialty)).toBe(tag);
    expect(SearchAddressBookInputSchema.safeParse({ tag }).success).toBe(true);
  });

  it.each([['Other'], [''], ['&/']])('does not filter for %j', (specialty) => {
    expect(specialtyTag(specialty)).toBeUndefined();
  });
});

describe('faxBlockedReason', () => {
  it('asks for a recipient first', () => {
    expect(faxBlockedReason(false, undefined)).toBe(NO_RECIPIENT_SEND_TEXT);
  });

  it('asks for a fax number when the recipient has none, even a blank one', () => {
    expect(faxBlockedReason(true, undefined)).toBe(NO_FAX_SEND_TEXT);
    expect(faxBlockedReason(true, '  ')).toBe(NO_FAX_SEND_TEXT);
  });

  it('gives no reason when the recipient has a fax number', () => {
    expect(faxBlockedReason(true, '(212) 555-4321')).toBe('');
  });
});

describe('toReferralFormValues', () => {
  it('shows a specialty that is not on the configured list as Other with its text', () => {
    expect(toReferralFormValues(referral, true, ['Orthopedics'])).toMatchObject({
      specialty: 'Other',
      specialtyOther: 'Rheumatology',
    });
  });

  it('selects a specialty that is on the configured list', () => {
    expect(toReferralFormValues(referral, true, ['Rheumatology'])).toMatchObject({
      specialty: 'Rheumatology',
      specialtyOther: '',
    });
  });

  it('formats the fax for the masked Fax field', () => {
    expect(toReferralFormValues(referral).recipientFax).toBe('(212) 555-4321');
  });
});

describe('toSaveReferralInput', () => {
  const values = toReferralFormValues(referral, true, ['Rheumatology']);

  it('leaves out the kinds the visit has no documents of', () => {
    expect(
      toSaveReferralInput(values, {
        patientId: 'patient-1',
        encounterId: 'encounter-1',
        unavailableDocuments: ['lab-results'],
      }).includeDocuments
    ).toEqual(['progress-note']);
  });

  it('keeps every chosen kind while availability is unknown', () => {
    expect(
      toSaveReferralInput(values, { patientId: 'patient-1', encounterId: 'encounter-1' }).includeDocuments
    ).toEqual(['progress-note', 'lab-results']);
  });
});
