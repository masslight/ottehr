import { FAX_MAX_RECIPIENTS, FaxDocumentAvailability } from 'utils/lib/types/api/fax.types';
import { describe, expect, it } from 'vitest';
import { availableDocumentLabels, documentLabelGroups, hasNothingToSend } from './faxDocuments';
import { FAX_STATUS_POLL_INTERVALS_MS, FAX_STATUS_POLL_TIMEOUT_MS, nextFaxPollInterval } from './faxPolling';
import {
  applySaveAsPcp,
  canAddRecipient,
  canSend,
  emptyRecipient,
  initialRecipients,
  toSendFaxPacketInput,
} from './faxRecipients';
import { FaxRecipientFormValue } from './types';

const availability = (overrides: Partial<Record<string, boolean>> = {}): FaxDocumentAvailability[] =>
  (['progress-note', 'discharge-summary', 'lab-results', 'radiology-results', 'patient-education'] as const).map(
    (kind) => ({ kind, available: overrides[kind] ?? true })
  );

const recipient = (overrides: Partial<FaxRecipientFormValue> = {}): FaxRecipientFormValue => ({
  ...emptyRecipient(),
  faxNumber: '2027139680',
  ...overrides,
});

describe('faxDocuments', () => {
  it('lists the labels of the documents that will be sent, in order', () => {
    expect(availableDocumentLabels(availability({ 'radiology-results': false }))).toEqual([
      'Visit/Progress Note',
      'Discharge Summary',
      'Lab Results',
      'Patient Education',
    ]);
  });

  it('splits documents into included and not-included, in order', () => {
    expect(documentLabelGroups(availability({ 'discharge-summary': false, 'radiology-results': false }))).toEqual({
      included: ['Visit/Progress Note', 'Lab Results', 'Patient Education'],
      excluded: ['Discharge Summary', 'Radiology Results'],
    });
  });

  it('detects a visit with nothing to send', () => {
    const nothing = {
      'progress-note': false,
      'discharge-summary': false,
      'lab-results': false,
      'radiology-results': false,
      'patient-education': false,
    };
    expect(hasNothingToSend(availability(nothing))).toBe(true);
    expect(hasNothingToSend(availability())).toBe(false);
  });
});

describe('faxRecipients', () => {
  it('prefills from the PCP and only offers to save when none is on file', () => {
    const pcp = { name: 'Tomas Jhonson', organization: 'Urgent Care Clinic', faxNumber: '2027139680' };
    expect(initialRecipients(pcp, false)[0]).toMatchObject({ ...pcp, saveAsPcp: true });
    expect(initialRecipients(pcp, true)[0].saveAsPcp).toBe(false);
    expect(initialRecipients(undefined, false)[0]).toMatchObject({ name: '', faxNumber: '', saveAsPcp: true });
  });

  it('treats "save as PCP" as a radio: the record holds exactly one PCP', () => {
    const recipients = [recipient({ saveAsPcp: true }), recipient(), recipient()];
    const afterSecond = applySaveAsPcp(recipients, 1, true);
    expect(afterSecond.map((entry) => entry.saveAsPcp)).toEqual([false, true, false]);
    expect(applySaveAsPcp(afterSecond, 1, false).map((entry) => entry.saveAsPcp)).toEqual([false, false, false]);
  });

  it('caps the recipient list', () => {
    expect(canAddRecipient(new Array(FAX_MAX_RECIPIENTS - 1).fill(recipient()))).toBe(true);
    expect(canAddRecipient(new Array(FAX_MAX_RECIPIENTS).fill(recipient()))).toBe(false);
  });

  it('blocks sending without documents, without recipients, or with an invalid fax number', () => {
    expect(canSend([recipient()], true)).toBe(true);
    expect(canSend([recipient()], false)).toBe(false);
    expect(canSend([], true)).toBe(false);
    expect(canSend([recipient({ faxNumber: '123' })], true)).toBe(false);
  });

  it('maps the form to the wire contract, dropping blank optional fields and the documents list', () => {
    const input = toSendFaxPacketInput('appointment-1', {
      recipients: [recipient({ name: '  Dr. Lion  ', organization: '', phoneNumber: '', saveAsPcp: false })],
    });

    expect(input).toEqual({
      appointmentId: 'appointment-1',
      recipients: [{ name: 'Dr. Lion', organization: undefined, faxNumber: '2027139680', phoneNumber: undefined }],
    });
    expect('documents' in input).toBe(false);
    expect('saveAsPcp' in input.recipients[0]).toBe(false);
  });

  it('carries saveAsPcp through for the flagged recipient', () => {
    const input = toSendFaxPacketInput('appointment-1', {
      recipients: [recipient({ saveAsPcp: true }), recipient({ faxNumber: '2027139681' })],
    });
    expect(input.recipients.filter((entry) => entry.saveAsPcp)).toHaveLength(1);
  });
});

describe('faxPolling', () => {
  it('backs off quickly then holds at 30s', () => {
    expect(FAX_STATUS_POLL_INTERVALS_MS.slice(0, 4)).toEqual([3000, 6000, 12000, 30000]);
    // 3 ramp-up steps + 11 steady 30s steps.
    expect(FAX_STATUS_POLL_INTERVALS_MS).toHaveLength(14);
    expect(FAX_STATUS_POLL_INTERVALS_MS.filter((ms) => ms === 30000)).toHaveLength(11);
  });

  it('maps completed-poll count to the next delay and stops once exhausted', () => {
    expect(nextFaxPollInterval(1)).toBe(3000);
    expect(nextFaxPollInterval(2)).toBe(6000);
    expect(nextFaxPollInterval(4)).toBe(30000);
    expect(nextFaxPollInterval(FAX_STATUS_POLL_INTERVALS_MS.length)).toBe(30000);
    expect(nextFaxPollInterval(FAX_STATUS_POLL_INTERVALS_MS.length + 1)).toBe(false);
  });

  it('derives the timeout from the schedule plus a grace period', () => {
    const scheduleTotal = FAX_STATUS_POLL_INTERVALS_MS.reduce((sum, ms) => sum + ms, 0);
    expect(FAX_STATUS_POLL_TIMEOUT_MS).toBeGreaterThan(scheduleTotal);
  });
});
