import { Organization, ServiceRequest } from 'fhir/r4b';
import { makeReferralServiceRequest, withReferralDetails } from 'utils/lib/fhir/referral';
import { ADDRESS_BOOK_TAG_CODE, ADDRESS_BOOK_TAG_SYSTEM } from 'utils/lib/types/data/address-book';
import { describe, expect, it, vi } from 'vitest';
import {
  composeReferralsForDischargeSummary,
  createReferralsSectionForDischargeSummary,
} from '../../src/shared/pdf/sections/discharge-summary/referrals';
import { composePlanData } from '../../src/shared/pdf/sections/visit-note/plan';
import { PdfAssets, PdfClient, PdfStyles, ReferralsData } from '../../src/shared/pdf/types';
import { AllChartData } from '../../src/shared/pdf/visit-details-pdf/types';
import { EncounterReferral, mapEncounterReferral } from '../../src/shared/referrals/load-encounter-referrals';
import { referralOverdueAt } from '../../src/shared/referrals/referral-task';

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

  const scheduleLines = (referral: EncounterReferral, timezone = 'America/New_York'): string[] =>
    composeReferralsForDischargeSummary({ referrals: [referral], timezone }).referrals[0].lines;

  it('counts the schedule-by window from the send, else the hand-over, else when the referral was written', () => {
    const sentLater = { ...base, sentAt: '2026-10-25T15:05:00.000Z', givenToPatientAt: '2026-10-27T15:05:00.000Z' };
    const givenToPatient = { ...base, sentAt: undefined, givenToPatientAt: '2026-10-27T15:05:00.000Z' };
    const notSent = { ...base, sentAt: undefined };
    expect(scheduleLines(sentLater)).toContain('Who schedules: Patient (by 11/01/2026)');
    expect(scheduleLines(givenToPatient)).toContain('Who schedules: Patient (by 11/03/2026)');
    expect(scheduleLines(notSent)).toContain('Who schedules: Patient (by 10/30/2026)');
  });

  it('prints the schedule-by date as the local day of the task due date referralOverdueAt computes', () => {
    const lateEvening = { ...base, sentAt: '2026-10-24T02:30:00.000Z' };
    const dueAt = referralOverdueAt(lateEvening.urgency, lateEvening.sentAt);
    expect(dueAt).toBe('2026-10-31T02:30:00.000Z');
    expect(scheduleLines(lateEvening)).toContain('Who schedules: Patient (by 10/30/2026)');
    expect(scheduleLines(lateEvening, 'UTC')).toContain('Who schedules: Patient (by 10/31/2026)');
  });

  it('tells the patient to choose a specialist in the specialty when there is no recipient, and drops the date when the practice schedules', () => {
    const data = composeReferralsForDischargeSummary({
      referrals: [{ ...base, recipient: undefined, whoSchedules: 'practice' }],
    });
    expect(data.referrals[0].lines).toEqual([
      'Choose a specialist in Orthopedics that your insurance covers and bring this summary.',
      'Reason: Persistent knee pain after fall',
      'Urgency: Urgent',
      'Who schedules: This practice',
    ]);
  });
});

describe('createReferralsSectionForDischargeSummary', () => {
  it('draws each referral title then its lines, and is omitted when there are none', () => {
    const drawText = vi.fn();
    const client = {
      drawText,
      drawSeparatedLine: vi.fn(),
      getTextDimensions: vi.fn().mockReturnValue({ height: 10, width: 100 }),
      getY: vi.fn().mockReturnValue(700),
      addNewPage: vi.fn(),
    } as unknown as PdfClient;
    const styles = {
      textStyles: { regularText: {}, alternativeRegularText: {}, subHeader: {}, blockSubHeader: {} },
      lineStyles: { separator: {} },
    } as unknown as PdfStyles;
    const section = createReferralsSectionForDischargeSummary<{ referrals?: ReferralsData }>();
    const data: ReferralsData = { referrals: [{ title: 'Orthopedics', lines: ['Reason: Knee', 'Urgency: Urgent'] }] };

    section.render(client, data, styles, {} as PdfAssets);

    expect(section.title).toBe('Referrals');
    expect(drawText.mock.calls.map((call) => call[0])).toEqual(['Orthopedics', 'Reason: Knee', 'Urgency: Urgent']);
    expect(client.drawSeparatedLine).toHaveBeenCalledTimes(1);
    expect(section.dataSelector({ referrals: data })).toBe(data);
    expect(section.shouldRender?.(data)).toBe(true);
    expect(section.shouldRender?.({ referrals: [] })).toBe(false);
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
