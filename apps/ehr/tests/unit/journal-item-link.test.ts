import { JournalItem } from 'utils/lib/types/api/provider-journal.types';
import { LAB_ORDER_TASK } from 'utils/lib/types/data/labs/labs.constants';
import { MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it } from 'vitest';
import { journalItemLink, summarizeItems } from '../../src/features/journal/helpers/journalHelpers';

const item = (overrides: Partial<JournalItem>): JournalItem => ({
  id: 'task-1',
  taskId: 'task-1',
  kind: 'task',
  label: 'x',
  when: 'created',
  since: '2026-11-07T13:00:00.000Z',
  appointmentId: 'appt-1',
  encounterId: 'enc-1',
  patientId: 'pat-1',
  ...overrides,
});

describe('journalItemLink opens the same page as the Tasks page', () => {
  it('opens a reflex result on its report page, and an unmatched unsolicited result on Match', () => {
    const lab = { kind: 'external-lab' as const, diagnosticReportId: 'dr-1' };
    expect(journalItemLink(item({ ...lab, isReflex: true }))).toBe(
      '/in-person/appt-1/external-lab-orders/report/dr-1/order-details'
    );
    expect(journalItemLink(item({ ...lab, code: LAB_ORDER_TASK.code.matchUnsolicitedResult }))).toBe(
      '/unsolicited-results/dr-1/match'
    );
    expect(journalItemLink(item({ ...lab, appointmentId: undefined }))).toBe('/unsolicited-results/dr-1/review');
    expect(journalItemLink(item({ ...lab, orderId: 'sr-1' }))).toBe(
      '/in-person/appt-1/external-lab-orders/sr-1/order-details'
    );
  });

  it("opens a completed form's review task in the patient's Paperwork folder", () => {
    const form = item({ category: MANUAL_TASK.category.patientFollowUp, documentReferenceId: 'doc-1' });
    expect(journalItemLink(form)).toBe('/patient/pat-1/docs?folder=Paperwork');
    expect(journalItemLink(item({ category: MANUAL_TASK.category.patientFollowUp }))).toBe(
      '/in-person/appt-1/review-and-sign'
    );
  });

  it('opens an order- or section-linked task on that order or section', () => {
    expect(journalItemLink(item({ category: MANUAL_TASK.category.immunization, orderId: 'order-1' }))).toBe(
      '/in-person/appt-1/immunization/vaccine-details?scrollTo=order-1'
    );
    expect(journalItemLink(item({ category: MANUAL_TASK.category.nursingOrders, progressNoteSection: 'vitals' }))).toBe(
      '/in-person/appt-1/vitals?encounterId=enc-1'
    );
    expect(journalItemLink(item({ category: MANUAL_TASK.category.other }))).toBe('/in-person/appt-1/review-and-sign');
  });

  it('counts a text as unread only while the patient has unread texts, like Support Chat requests', () => {
    const text = (id: string, unread?: boolean): JournalItem => item({ id, kind: 'text-message', unread });
    expect(summarizeItems([text('a', true), text('b')])).toBe('2 actions to take: 1 unread text, 1 text');
  });
});
