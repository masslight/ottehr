import { JournalRow } from 'utils/lib/types/api/provider-journal.types';
import { describe, expect, it, vi } from 'vitest';
import { buildJournalActions } from '../../src/features/journal/helpers/journalActions';
import { rowRef } from '../../src/features/journal/helpers/journalHelpers';

describe('journal Follow-up action', () => {
  it('says "Add a follow-up" (the page is Add Follow-up Visit: Annotation or Scheduled Visit)', () => {
    const row: JournalRow = { patient: { patientId: 'pat-1', name: 'Ida Notied', phones: [] }, visits: [], items: [] };
    const handlers = { onSelect: vi.fn(), onStart: vi.fn(), onText: vi.fn(), onNote: vi.fn(), onAddendum: vi.fn() };
    const followUp = buildJournalActions(rowRef('np', row), 'provider', handlers).find((a) => a.key === 'followup');
    expect(followUp?.tooltip).toBe('Add a follow-up');
  });
});
