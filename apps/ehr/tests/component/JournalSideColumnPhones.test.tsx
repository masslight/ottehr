import { render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';
import { JournalRow } from 'utils/lib/types/api/provider-journal.types';
import { describe, expect, it, vi } from 'vitest';
import { JournalSideColumn } from '../../src/features/journal/components/JournalSideColumn';
import { rowRef } from '../../src/features/journal/helpers/journalHelpers';

const labels = vi.hoisted(() => ({ value: { data: undefined as unknown, isLoading: true } }));
vi.mock('../../src/features/journal/hooks/useJournalPhoneLabels', () => ({
  useJournalPhoneLabels: () => labels.value,
}));

const row: JournalRow = {
  patient: {
    patientId: 'pat-ava',
    name: 'Ava Chen',
    phones: [
      { number: '(410) 555-0123', recipientResourceUri: 'RelatedPerson/rp-1' },
      { number: '(410) 555-0124', recipientResourceUri: 'RelatedPerson/rp-2' },
    ],
  },
  visits: [],
  items: [],
};

const renderSide = (): void => {
  render(
    <JournalSideColumn
      selected={rowRef('np', row)}
      kind="provider"
      now={DateTime.now()}
      actions={[]}
      onOpenChat={() => {}}
      onAddendum={() => {}}
    />
  );
};

describe('JournalSideColumn phones', () => {
  it('shows a placeholder where each label goes while the labels load', () => {
    labels.value = { data: undefined, isLoading: true };
    renderSide();
    expect(screen.getAllByLabelText('Loading who signed for this phone')).toHaveLength(2);
    expect(screen.getByText('(410) 555-0123')).toBeInTheDocument();
  });

  it('shows the consent signer before a phone that has one, and the number alone otherwise', () => {
    labels.value = {
      data: { labels: [{ recipientResourceUri: 'RelatedPerson/rp-1', signer: 'Mei Chen (Parent)' }] },
      isLoading: false,
    };
    renderSide();
    expect(screen.queryByLabelText('Loading who signed for this phone')).toBeNull();
    expect(screen.getByText('Mei Chen (Parent)').parentElement).toBe(screen.getByText('(410) 555-0123').parentElement);
    expect(screen.getByText('(410) 555-0124').parentElement).toHaveTextContent(/^\(410\) 555-0124$/);
  });
});
