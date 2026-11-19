import {
  DOCUMENT_PACKET_MAX_RECIPIENTS,
  PACKET_PATIENT_EDUCATION_IN_DISCHARGE_SUMMARY_REASON,
  PacketDocumentAvailability,
} from 'utils/lib/types/api/document-packet.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actionLogsQueryKey } from '../../action-logs/actionLogs.constants';
import { availableDocumentLabels, documentLabelGroups, hasNothingToSend } from './documents';
import { buildDefaultFormValues } from './form';
import {
  faxHistoryQueryKey,
  nextPacketStatusPollInterval,
  PACKET_STATUS_POLL_INTERVALS_MS,
  PACKET_STATUS_POLL_TIMEOUT_MS,
  packetStatusTimeoutMessage,
} from './polling';
import {
  applySaveAsPcp,
  canAddRecipient,
  canSend,
  emptyRecipient,
  initialRecipients,
  toSendDocumentPacketInput,
} from './recipients';
import { RecipientFormValue } from './types';

const flags = vi.hoisted(() => ({ sendgridEnabled: true }));

vi.mock('src/constants/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('src/constants/feature-flags')>();
  return {
    ...actual,
    FEATURE_FLAGS: {
      ...actual.FEATURE_FLAGS,
      get SENDGRID_ENABLED() {
        return flags.sendgridEnabled;
      },
    },
  };
});

const availability = (overrides: Partial<Record<string, boolean>> = {}): PacketDocumentAvailability[] =>
  (['progress-note', 'discharge-summary', 'lab-results', 'radiology-results', 'patient-education'] as const).map(
    (kind) => ({ kind, available: overrides[kind] ?? true })
  );

const visitSource = { type: 'visit', appointmentId: 'appointment-1' } as const;
const medicalRecordSource = {
  type: 'medical-record',
  patientId: 'patient-1',
  dateRange: { from: '2026-01-01T00:00:00.000-05:00', to: '2026-10-12T23:59:59.999-04:00' },
} as const;

const recipient = (overrides: Partial<RecipientFormValue> = {}): RecipientFormValue => ({
  ...emptyRecipient(),
  faxNumber: '2027139680',
  ...overrides,
});

describe('documents', () => {
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

  it('keeps patient education merged into the discharge summary in the included group', () => {
    const rows = availability().map((row) =>
      row.kind === 'patient-education'
        ? {
            ...row,
            available: false,
            count: 1,
            unavailableReason: PACKET_PATIENT_EDUCATION_IN_DISCHARGE_SUMMARY_REASON,
          }
        : row
    );
    expect(documentLabelGroups(rows)).toEqual({
      included: ['Visit/Progress Note', 'Discharge Summary', 'Lab Results', 'Radiology Results', 'Patient Education'],
      excluded: [],
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

describe('recipients', () => {
  beforeEach(() => {
    flags.sendgridEnabled = true;
  });

  it('does not opt a preview-less patient fax into replacing the PCP', () => {
    expect(buildDefaultFormValues(undefined).recipients[0].saveAsPcp).toBe(false);
  });

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

  it('starts a PCP-prefilled recipient on the fax channel', () => {
    expect(initialRecipients({ faxNumber: '2027139680' }, true)[0]).toMatchObject({
      channel: 'fax',
      faxNumber: '2027139680',
      email: '',
    });
  });

  it('starts an emailed prefill on email only while SendGrid is on, since Email is not offered otherwise', () => {
    expect(initialRecipients({ email: 'olivia@example.com' }, true)[0].channel).toBe('email');

    flags.sendgridEnabled = false;
    expect(initialRecipients({ email: 'olivia@example.com' }, true)[0].channel).toBe('fax');
  });

  it('caps the recipient list', () => {
    expect(canAddRecipient(new Array(DOCUMENT_PACKET_MAX_RECIPIENTS - 1).fill(recipient()))).toBe(true);
    expect(canAddRecipient(new Array(DOCUMENT_PACKET_MAX_RECIPIENTS).fill(recipient()))).toBe(false);
  });

  it('blocks sending without documents, without recipients, or with an invalid fax number', () => {
    expect(canSend([recipient()], true)).toBe(true);
    expect(canSend([recipient()], false)).toBe(false);
    expect(canSend([], true)).toBe(false);
    expect(canSend([recipient({ faxNumber: '123' })], true)).toBe(false);
  });

  it('validates an email recipient by its address, ignoring the blank fax field', () => {
    expect(canSend([recipient({ channel: 'email', email: 'olivia@example.com', faxNumber: '' })], true)).toBe(true);
    expect(canSend([recipient({ channel: 'email', email: 'not-an-email', faxNumber: '' })], true)).toBe(false);
    expect(canSend([recipient({ channel: 'email', email: '', faxNumber: '2027139680' })], true)).toBe(false);
  });

  // The server rejects the whole send, every recipient included, for an address its schema refuses.
  it.each(['dr@clinic.com,nurse@clinic.com', 'a..b@clinic.com'])(
    'refuses %s, which the server schema would reject',
    (email) => {
      expect(canSend([recipient({ channel: 'email', email, faxNumber: '' })], true)).toBe(false);
    }
  );

  it('accepts an email with surrounding whitespace, which the server trims', () => {
    expect(canSend([recipient({ channel: 'email', email: '  olivia@example.com ', faxNumber: '' })], true)).toBe(true);
  });

  it('sends an email recipient with its address only, trimmed and lowercased', () => {
    const input = toSendDocumentPacketInput(visitSource, {
      recipients: [recipient({ channel: 'email', email: '  Olivia@Example.COM ', faxNumber: '' })],
    });

    expect(input.recipients[0]).toEqual({
      name: undefined,
      organization: undefined,
      email: 'olivia@example.com',
      phoneNumber: undefined,
    });
    expect('faxNumber' in input.recipients[0]).toBe(false);
  });

  it('narrows a multi-visit source to the visits left checked', () => {
    const input = toSendDocumentPacketInput(
      { type: 'visits', patientId: 'patient-1', appointmentIds: ['a', 'b'] },
      { recipients: [recipient()], selectedAppointmentIds: ['b'] }
    );

    expect(input.source).toEqual({ type: 'visits', patientId: 'patient-1', appointmentIds: ['b'] });
  });

  it('leaves a source without a visit choice exactly as requested', () => {
    expect(toSendDocumentPacketInput(medicalRecordSource, { recipients: [recipient()] }).source).toEqual(
      medicalRecordSource
    );
  });

  it('maps the form to the wire contract, dropping blank optional fields and the documents list', () => {
    const input = toSendDocumentPacketInput(visitSource, {
      recipients: [recipient({ name: '  Dr. Lion  ', organization: '', phoneNumber: '', saveAsPcp: false })],
    });

    expect(input).toEqual({
      source: visitSource,
      recipients: [
        {
          name: 'Dr. Lion',
          credential: undefined,
          organization: undefined,
          faxNumber: '2027139680',
          phoneNumber: undefined,
        },
      ],
    });
    expect('documents' in input).toBe(false);
    expect('saveAsPcp' in input.recipients[0]).toBe(false);
  });

  it('sends the credential apart from the name', () => {
    const input = toSendDocumentPacketInput(visitSource, {
      recipients: [recipient({ name: 'Jane Doe', credential: ' MD ' })],
    });
    expect(input.recipients[0]).toMatchObject({ name: 'Jane Doe', credential: 'MD' });
  });

  it('carries saveAsPcp through for the flagged recipient', () => {
    const input = toSendDocumentPacketInput(visitSource, {
      recipients: [recipient({ saveAsPcp: true }), recipient({ faxNumber: '2027139681' })],
    });
    expect(input.recipients.filter((entry) => entry.saveAsPcp)).toHaveLength(1);
  });

  it('drops saveAsPcp from an email recipient, since the PCP record has no email', () => {
    const input = toSendDocumentPacketInput(visitSource, {
      recipients: [recipient({ channel: 'email', email: 'olivia@example.com', saveAsPcp: true })],
    });

    expect(input.recipients[0].saveAsPcp).toBeUndefined();
  });

  it('drops stale saveAsPcp state from patient-level sources', () => {
    const input = toSendDocumentPacketInput(medicalRecordSource, { recipients: [recipient({ saveAsPcp: true })] });

    expect(input.recipients[0].saveAsPcp).toBeUndefined();
  });
});

describe('polling', () => {
  it('backs off quickly then holds at 30s', () => {
    expect(PACKET_STATUS_POLL_INTERVALS_MS.slice(0, 4)).toEqual([3000, 6000, 12000, 30000]);
    // 3 ramp-up steps + 11 steady 30s steps.
    expect(PACKET_STATUS_POLL_INTERVALS_MS).toHaveLength(14);
    expect(PACKET_STATUS_POLL_INTERVALS_MS.filter((ms) => ms === 30000)).toHaveLength(11);
  });

  it('maps completed-poll count to the next delay and stops once exhausted', () => {
    expect(nextPacketStatusPollInterval(1)).toBe(3000);
    expect(nextPacketStatusPollInterval(2)).toBe(6000);
    expect(nextPacketStatusPollInterval(4)).toBe(30000);
    expect(nextPacketStatusPollInterval(PACKET_STATUS_POLL_INTERVALS_MS.length)).toBe(30000);
    expect(nextPacketStatusPollInterval(PACKET_STATUS_POLL_INTERVALS_MS.length + 1)).toBe(false);
  });

  it('derives the timeout from the schedule plus a grace period', () => {
    const scheduleTotal = PACKET_STATUS_POLL_INTERVALS_MS.reduce((sum, ms) => sum + ms, 0);
    expect(PACKET_STATUS_POLL_TIMEOUT_MS).toBeGreaterThan(scheduleTotal);
  });

  it('points timeout guidance and refreshes at the history for the source', () => {
    expect(packetStatusTimeoutMessage(visitSource)).toContain("visit's fax history");
    expect(faxHistoryQueryKey(visitSource)).toEqual(['get-visit-fax-history', 'appointment-1']);

    expect(packetStatusTimeoutMessage(medicalRecordSource)).toContain("patient's fax history");
    expect(faxHistoryQueryKey(medicalRecordSource)).toEqual(actionLogsQueryKey('fax', 'patient-1'));
  });
});
