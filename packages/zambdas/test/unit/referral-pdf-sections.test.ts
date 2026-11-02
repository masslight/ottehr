import { Organization, ServiceRequest } from 'fhir/r4b';
import { makeReferralServiceRequest, withReferralDetails } from 'utils/lib/fhir/referral';
import { ADDRESS_BOOK_TAG_CODE, ADDRESS_BOOK_TAG_SYSTEM } from 'utils/lib/types/data/address-book';
import { describe, expect, it } from 'vitest';
import { composeReferralsForDischargeSummary } from '../../src/shared/pdf/sections/discharge-summary/referrals';
import { composePlanData } from '../../src/shared/pdf/sections/visit-note/plan';
import { AllChartData } from '../../src/shared/pdf/visit-details-pdf/types';
import { EncounterReferral, mapEncounterReferral } from '../../src/shared/referrals/load-encounter-referrals';

const organization: Organization = {
  resourceType: 'Organization',
  id: 'org-1',
  name: 'Riverside Orthopedic Associates',
  meta: { tag: [{ system: ADDRESS_BOOK_TAG_SYSTEM, code: ADDRESS_BOOK_TAG_CODE }] },
  address: [{ line: ['12 Main St', 'Suite 4'], city: 'Springfield', state: 'MA', postalCode: '01101' }],
  telecom: [
    { system: 'phone', value: '(413) 555-0100' },
    { system: 'fax', value: '(413) 555-0101' },
  ],
};

const serviceRequest = (recipientContactId?: string): ServiceRequest =>
  withReferralDetails(
    makeReferralServiceRequest(
      {
        patientId: 'pat-1',
        encounterId: 'enc-1',
        specialty: 'Orthopedics',
        recipientContactId,
        reason: 'Persistent knee pain after fall',
        urgency: 'urgent',
        whatIsAsked: 'evaluate-and-treat',
        whoSchedules: 'patient',
        responseRequested: true,
        includeDocuments: [],
      },
      {
        patientId: 'pat-1',
        encounterId: 'enc-1',
        requester: { reference: 'Practitioner/prac-1', display: 'J. Rivera, MD' },
        recipientDisplay: 'Riverside Orthopedic Associates',
        now: '2026-10-23T15:00:00.000Z',
      }
    ),
    { status: 'sent', sentAt: '2026-10-23T15:05:00.000Z' }
  );

const allChartData: AllChartData = {
  chartData: { patientId: 'pat-1' } as AllChartData['chartData'],
  additionalChartData: { patientId: 'pat-1' } as AllChartData['additionalChartData'],
};

describe('mapEncounterReferral', () => {
  it('reads the referral fields and the address-book recipient', () => {
    const referral = mapEncounterReferral(serviceRequest('org-1'), new Map([['org-1', organization]]));
    expect(referral).toMatchObject({
      specialty: 'Orthopedics',
      reason: 'Persistent knee pain after fall',
      urgency: 'urgent',
      whatIsAsked: 'evaluate-and-treat',
      whoSchedules: 'patient',
      responseRequested: true,
      status: 'sent',
      authoredOn: '2026-10-23T15:00:00.000Z',
      sentAt: '2026-10-23T15:05:00.000Z',
      recipient: {
        name: 'Riverside Orthopedic Associates',
        address: '12 Main St, Suite 4, Springfield, MA 01101',
        phone: '(413) 555-0100',
      },
    });
    expect(mapEncounterReferral(serviceRequest(), new Map()).recipient).toBeUndefined();
  });
});

describe('composeReferralsForDischargeSummary', () => {
  const base: EncounterReferral = mapEncounterReferral(serviceRequest('org-1'), new Map([['org-1', organization]]));

  it('prints the recipient contact details, the reason, urgency and the schedule-by date', () => {
    const data = composeReferralsForDischargeSummary({ referrals: [base], timezone: 'America/New_York' });
    expect(data.referrals).toEqual([
      {
        title: 'Orthopedics',
        lines: [
          'Riverside Orthopedic Associates',
          '12 Main St, Suite 4, Springfield, MA 01101',
          'Phone: (413) 555-0100',
          'Reason: Persistent knee pain after fall',
          'Urgency: Urgent',
          // urgent = 7 days after it was sent on 10/23
          'Who schedules: Patient (by 10/30/2026)',
        ],
      },
    ]);
  });

  it('counts the schedule-by window from the send, else from when the referral was written', () => {
    const sentLater = { ...base, sentAt: '2026-10-25T15:05:00.000Z' };
    const notSent = { ...base, sentAt: undefined };
    const lines = (referral: EncounterReferral): string[] =>
      composeReferralsForDischargeSummary({ referrals: [referral], timezone: 'America/New_York' }).referrals[0].lines;
    expect(lines(sentLater)).toContain('Who schedules: Patient (by 11/01/2026)');
    expect(lines(notSent)).toContain('Who schedules: Patient (by 10/30/2026)');
  });

  it('tells the patient to choose a specialist when there is no recipient, and drops the date when the practice schedules', () => {
    const data = composeReferralsForDischargeSummary({
      referrals: [{ ...base, recipient: undefined, whoSchedules: 'practice' }],
    });
    expect(data.referrals[0].lines).toEqual([
      'Choose a Orthopedics your insurance covers and bring this summary.',
      'Reason: Persistent knee pain after fall',
      'Urgency: Urgent',
      'Who schedules: This practice',
    ]);
  });
});

describe('composePlanData referrals', () => {
  it('lists each referral with recipient, reason, urgency and what is asked', () => {
    const referral = mapEncounterReferral(serviceRequest('org-1'), new Map([['org-1', organization]]));
    const plan = composePlanData({ allChartData, referrals: [referral, { ...referral, recipient: undefined }] });
    expect(plan.referrals).toEqual([
      {
        title: 'Orthopedics',
        lines: [
          'Recipient: Riverside Orthopedic Associates',
          'Reason: Persistent knee pain after fall',
          'Urgency: Urgent',
          'Asked: Evaluate and treat',
        ],
      },
      {
        title: 'Orthopedics',
        lines: [
          'Recipient: patient to choose',
          'Reason: Persistent knee pain after fall',
          'Urgency: Urgent',
          'Asked: Evaluate and treat',
        ],
      },
    ]);
    expect(composePlanData({ allChartData }).referrals).toEqual([]);
  });
});
