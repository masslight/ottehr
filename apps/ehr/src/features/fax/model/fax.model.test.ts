import {
  FAX_DOCUMENT_ORDER,
  FAX_MAX_RECIPIENTS,
  FAX_PROGRESS_NOTE_INCLUDED_HINT,
  FaxDocumentAvailability,
} from 'utils';
import { describe, expect, it } from 'vitest';
import {
  availableKinds,
  buildDocumentRows,
  defaultSelectedKinds,
  hasNothingToSend,
  resolveSelection,
  toggleKind,
} from './faxDocuments';
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
  FAX_DOCUMENT_ORDER.map((kind) => ({
    kind,
    available: overrides[kind] ?? true,
    unavailableReason: overrides[kind] === false ? `No ${kind}` : undefined,
  }));

const recipient = (overrides: Partial<FaxRecipientFormValue> = {}): FaxRecipientFormValue => ({
  ...emptyRecipient(),
  faxNumber: '2027139680',
  ...overrides,
});

describe('faxDocuments', () => {
  it('reports only the kinds the visit actually has', () => {
    expect(availableKinds(availability({ 'radiology-results': false }))).not.toContain('radiology-results');
    expect(defaultSelectedKinds(availability({ 'lab-results': false }))).not.toContain('lab-results');
  });

  it('renders prescriptions and patient instructions as disabled children of the progress note', () => {
    const rows = buildDocumentRows(availability(), FAX_DOCUMENT_ORDER, 'selected');
    const nested = rows.filter((row) => row.nested);

    expect(nested.map((row) => row.label)).toEqual(['Prescriptions', 'Patient Instructions']);
    expect(nested.every((row) => row.disabled && row.hint === FAX_PROGRESS_NOTE_INCLUDED_HINT)).toBe(true);
    // They sit directly under the progress note row.
    expect(rows[0].kind).toBe('progress-note');
    expect(rows[1].nested && rows[2].nested).toBe(true);
  });

  it('makes the nested rows follow the progress note checkbox', () => {
    const withoutNote = buildDocumentRows(
      availability(),
      FAX_DOCUMENT_ORDER.filter((kind) => kind !== 'progress-note'),
      'selected'
    );
    expect(withoutNote.filter((row) => row.nested).every((row) => row.checked)).toBe(false);
  });

  it('disables unavailable rows and surfaces the reason', () => {
    const rows = buildDocumentRows(availability({ 'discharge-summary': false }), FAX_DOCUMENT_ORDER, 'selected');
    const dischargeSummary = rows.find((row) => row.kind === 'discharge-summary');

    expect(dischargeSummary?.disabled).toBe(true);
    expect(dischargeSummary?.checked).toBe(false);
    expect(dischargeSummary?.hint).toBe('No discharge-summary');
  });

  it('treats "all" as everything the visit has, not everything that exists', () => {
    const withoutRadiology = availability({ 'radiology-results': false });

    expect(resolveSelection('all', withoutRadiology, [])).toEqual(
      FAX_DOCUMENT_ORDER.filter((kind) => kind !== 'radiology-results')
    );
    // In "all" mode the checkboxes are a read-only preview.
    const rows = buildDocumentRows(withoutRadiology, [], 'all');
    expect(rows.filter((row) => row.kind && row.kind !== 'radiology-results').every((row) => row.checked)).toBe(true);
    expect(rows.every((row) => row.disabled)).toBe(true);
  });

  it('never sends a selected document the visit does not have', () => {
    expect(resolveSelection('selected', availability({ 'lab-results': false }), ['lab-results'])).toEqual([]);
  });

  it('keeps the selection in merge order when toggling', () => {
    const toggled = toggleKind(['patient-education', 'progress-note'], 'lab-results');
    expect(toggled).toEqual(['progress-note', 'lab-results', 'patient-education']);
    expect(toggleKind(toggled, 'lab-results')).not.toContain('lab-results');
  });

  it('detects a visit with nothing to send', () => {
    const nothing = FAX_DOCUMENT_ORDER.reduce<Record<string, boolean>>((acc, kind) => ({ ...acc, [kind]: false }), {});
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

  it('blocks sending without a document or with an invalid fax number', () => {
    const base = { availability: availability(), selectedKinds: FAX_DOCUMENT_ORDER, recipients: [recipient()] };

    expect(canSend({ mode: 'selected', ...base })).toBe(true);
    expect(canSend({ ...base, mode: 'selected', selectedKinds: [] })).toBe(false);
    expect(canSend({ ...base, mode: 'selected', recipients: [recipient({ faxNumber: '123' })] })).toBe(false);
    expect(canSend({ ...base, mode: 'selected', recipients: [] })).toBe(false);
    // "All" ignores the checkbox state entirely.
    expect(canSend({ ...base, mode: 'all', selectedKinds: [] })).toBe(true);
  });

  it('maps the form to the wire contract, dropping blank optional fields', () => {
    const input = toSendFaxPacketInput(
      'appointment-1',
      {
        mode: 'selected',
        selectedKinds: ['progress-note'],
        recipients: [recipient({ name: '  Dr. Lion  ', organization: '', phoneNumber: '', saveAsPcp: false })],
      },
      availability()
    );

    expect(input).toEqual({
      appointmentId: 'appointment-1',
      documents: ['progress-note'],
      recipients: [{ name: 'Dr. Lion', organization: undefined, faxNumber: '2027139680', phoneNumber: undefined }],
    });
    expect('saveAsPcp' in input.recipients[0]).toBe(false);
  });

  it('carries saveAsPcp through for the flagged recipient only', () => {
    const input = toSendFaxPacketInput(
      'appointment-1',
      {
        mode: 'all',
        selectedKinds: [],
        recipients: [recipient({ saveAsPcp: true }), recipient({ faxNumber: '2027139681' })],
      },
      availability()
    );

    expect(input.recipients.filter((entry) => entry.saveAsPcp)).toHaveLength(1);
  });
});
