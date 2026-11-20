import { render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';
import { JournalRow } from 'utils/lib/types/api/provider-journal.types';
import { describe, expect, it } from 'vitest';
import { JournalSideColumn } from '../../src/features/journal/components/JournalSideColumn';
import { rowRef } from '../../src/features/journal/helpers/journalHelpers';

const row: JournalRow = {
  patient: {
    patientId: 'pat-ava',
    name: 'Ava Chen',
    phones: [
      { number: '(410) 555-0123', recipientResourceUri: 'RelatedPerson/rp-1', signer: 'Mei Chen (Parent)' },
      { number: '(410) 555-0124', recipientResourceUri: 'RelatedPerson/rp-2' },
    ],
  },
  visits: [],
  items: [],
};

describe('JournalSideColumn phones', () => {
  it('shows the consent signer before a phone that has one, and the number alone otherwise', () => {
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
    expect(screen.getByText('Mei Chen (Parent)').parentElement).toBe(screen.getByText('(410) 555-0123').parentElement);
    expect(screen.getByText('(410) 555-0124').parentElement).toHaveTextContent(/^\(410\) 555-0124$/);
  });
});
