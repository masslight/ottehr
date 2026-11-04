import { describe, expect, it } from 'vitest';
import { SaveReferralInput } from '../types/api/referrals/referrals.types';
import {
  getReferralDetails,
  getReferralNotesToRecipient,
  getReferralReason,
  getReferralRecipientContactId,
  getReferralRecipientFax,
  getReferralSpecialty,
  getReferralStatus,
  getReferralUrgency,
  isReferralServiceRequest,
  makeReferralServiceRequest,
  REFERRAL_ORDER_TYPE_TAG,
  withReferralDetails,
} from './referral';

const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const ENCOUNTER_ID = '22222222-2222-4222-8222-222222222222';
const CONTACT_ID = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-11-01T15:00:00.000Z';
const REQUESTER = { reference: 'Practitioner/abc', display: 'Jordan Rivera, MD' };

const input: SaveReferralInput = {
  patientId: PATIENT_ID,
  encounterId: ENCOUNTER_ID,
  specialty: 'Orthopedics',
  recipientContactId: CONTACT_ID,
  reason: 'Distal radius fracture, closed; evaluate for reduction vs cast',
  urgency: 'urgent',
  whatIsAsked: 'evaluate-and-treat',
  whoSchedules: 'patient',
  responseRequested: true,
  includeDocuments: ['progress-note', 'lab-results'],
  notesToRecipient: 'Splint applied.',
};

describe('makeReferralServiceRequest', () => {
  it('round-trips every field through the getters', () => {
    const sr = makeReferralServiceRequest(input, {
      patientId: PATIENT_ID,
      encounterId: ENCOUNTER_ID,
      requester: REQUESTER,
      recipientDisplay: 'Riverside Orthopedic Associates',
      now: NOW,
    });

    expect(isReferralServiceRequest(sr)).toBe(true);
    expect(sr.meta?.tag).toContainEqual(REFERRAL_ORDER_TYPE_TAG);
    expect(sr.status).toBe('draft');
    expect(sr.intent).toBe('order');
    expect(sr.subject?.reference).toBe(`Patient/${PATIENT_ID}`);
    expect(sr.encounter?.reference).toBe(`Encounter/${ENCOUNTER_ID}`);
    expect(sr.requester).toEqual(REQUESTER);
    expect(sr.authoredOn).toBe(NOW);
    expect(sr.performer?.[0]).toMatchObject({
      reference: `Organization/${CONTACT_ID}`,
      display: 'Riverside Orthopedic Associates',
    });

    expect(getReferralSpecialty(sr)).toBe('Orthopedics');
    expect(getReferralReason(sr)).toBe(input.reason);
    expect(getReferralUrgency(sr)).toBe('urgent');
    expect(getReferralNotesToRecipient(sr)).toBe('Splint applied.');
    expect(getReferralRecipientContactId(sr)).toBe(CONTACT_ID);
    expect(getReferralStatus(sr)).toBe('not-sent');
    expect(getReferralDetails(sr)).toEqual({
      status: 'not-sent',
      whatIsAsked: 'evaluate-and-treat',
      whoSchedules: 'patient',
      responseRequested: true,
      includeDocuments: ['progress-note', 'lab-results'],
    });
  });

  it('leaves out the visit, recipient and notes when the input has none', () => {
    const sr = makeReferralServiceRequest(
      { ...input, encounterId: undefined, recipientContactId: undefined, notesToRecipient: undefined },
      { patientId: PATIENT_ID, requester: REQUESTER, now: NOW }
    );
    expect(sr.encounter).toBeUndefined();
    expect(sr.performer).toBeUndefined();
    expect(sr.note).toBeUndefined();
    expect(getReferralRecipientContactId(sr)).toBeUndefined();
    expect(getReferralNotesToRecipient(sr)).toBeUndefined();
    expect(getReferralUrgency({ ...sr, priority: undefined })).toBe('routine');
  });

  it('keeps a fax typed on the referral only when there is a recipient', () => {
    const typed = makeReferralServiceRequest(
      { ...input, recipientFax: '(555) 010-2000' },
      { patientId: PATIENT_ID, requester: REQUESTER, now: NOW }
    );
    expect(getReferralRecipientFax(typed)).toBe('(555) 010-2000');
    const noRecipient = makeReferralServiceRequest(
      { ...input, recipientContactId: undefined, recipientFax: '(555) 010-2000' },
      { patientId: PATIENT_ID, requester: REQUESTER, now: NOW }
    );
    expect(getReferralRecipientFax(noRecipient)).toBeUndefined();
    expect(
      getReferralRecipientFax(
        makeReferralServiceRequest(input, { patientId: PATIENT_ID, requester: REQUESTER, now: NOW })
      )
    ).toBeUndefined();
  });

  it('drops a stored fax when an edit saves the referral without one', () => {
    const typed = makeReferralServiceRequest(
      { ...input, recipientFax: '(555) 010-2000' },
      { patientId: PATIENT_ID, requester: REQUESTER, now: NOW }
    );
    expect(getReferralRecipientFax(typed)).toBe('(555) 010-2000');

    const edited = makeReferralServiceRequest(input, {
      patientId: PATIENT_ID,
      requester: REQUESTER,
      now: '2026-11-02T10:00:00.000Z',
      existing: { ...typed, id: 'sr-1' },
    });

    expect(getReferralRecipientFax(edited)).toBeUndefined();
    expect(getReferralDetails(edited)).not.toHaveProperty('recipientFax');
  });

  it('keeps id, authoredOn, requester and status from the stored referral on edit', () => {
    const created = makeReferralServiceRequest(input, { patientId: PATIENT_ID, requester: REQUESTER, now: NOW });
    const sent = withReferralDetails(
      { ...created, id: 'sr-1', meta: { ...created.meta, versionId: '3' } },
      {
        status: 'sent',
        sentAt: NOW,
      }
    );

    const edited = makeReferralServiceRequest(
      { ...input, specialty: 'Hand surgery', responseRequested: false },
      {
        patientId: PATIENT_ID,
        requester: { reference: 'Practitioner/someone-else', display: 'Someone Else' },
        now: '2026-11-02T10:00:00.000Z',
        existing: sent,
      }
    );

    expect(edited.id).toBe('sr-1');
    expect(edited.meta?.versionId).toBe('3');
    expect(edited.authoredOn).toBe(NOW);
    expect(edited.requester).toEqual(REQUESTER);
    expect(getReferralSpecialty(edited)).toBe('Hand surgery');
    expect(getReferralStatus(edited)).toBe('sent');
    expect(edited.status).toBe('active');
    expect(getReferralDetails(edited)).toMatchObject({ responseRequested: false, sentAt: NOW });
    expect(edited.meta?.tag?.filter((tag) => tag.system === REFERRAL_ORDER_TYPE_TAG.system)).toHaveLength(1);
  });
});

describe('withReferralDetails', () => {
  it('patches the details and keeps the FHIR status in step', () => {
    const created = makeReferralServiceRequest(input, { patientId: PATIENT_ID, requester: REQUESTER, now: NOW });

    const closed = withReferralDetails(created, {
      status: 'closed',
      closedAt: NOW,
      closeReason: 'patient-seen',
      outcome: 'Casted; follow-up in 6 weeks',
    });
    expect(closed.status).toBe('completed');
    expect(getReferralStatus(closed)).toBe('closed');
    expect(getReferralDetails(closed)).toMatchObject({
      whatIsAsked: 'evaluate-and-treat',
      includeDocuments: ['progress-note', 'lab-results'],
      closeReason: 'patient-seen',
      outcome: 'Casted; follow-up in 6 weeks',
    });

    expect(withReferralDetails(created, { status: 'cancelled' }).status).toBe('revoked');
    expect(withReferralDetails(created, { status: 'given-to-patient' }).status).toBe('active');
    expect(getReferralDetails(created)?.status).toBe('not-sent');
  });

  it('is not a referral without the order-type tag', () => {
    const sr = makeReferralServiceRequest(input, { patientId: PATIENT_ID, requester: REQUESTER, now: NOW });
    expect(isReferralServiceRequest({ ...sr, meta: {} })).toBe(false);
  });
});
