import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClaimHistoryEntry } from 'utils/lib/types/data/billing/claim-history';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaimHistory } from '../../src/components/claim/ClaimHistory';

const { getBillingClaimHistoryMock, oystehrZambdaStub } = vi.hoisted(() => ({
  getBillingClaimHistoryMock: vi.fn(),
  oystehrZambdaStub: {},
}));

vi.mock('../../src/api/api', () => ({ getBillingClaimHistory: getBillingClaimHistoryMock }));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: oystehrZambdaStub,
  }),
}));

const noteEntry: ClaimHistoryEntry = {
  id: 'prov-note',
  recorded: '2026-06-01T12:00:00Z',
  activity: 'Note',
  actor: {
    display: 'Jane Doe',
    type: 'user',
  },
  changes: [],
  message: 'Called payer, on hold pending medical records',
};

const changeEntry: ClaimHistoryEntry = {
  id: 'prov-update',
  recorded: '2026-05-31T12:00:00Z',
  activity: 'Update Coverage',
  actor: {
    display: 'Ottehr Rules Engine',
    type: 'system',
  },
  changes: [
    {
      field: 'memberId',
      label: 'Member ID',
      previousValue: 'A',
      newValue: 'B',
    },
  ],
};

function renderHistory(): void {
  render(
    <MemoryRouter>
      <ClaimHistory claimId="claim-1" />
    </MemoryRouter>
  );
}

describe('ClaimHistory', () => {
  beforeEach(() => {
    getBillingClaimHistoryMock.mockReset();
    getBillingClaimHistoryMock.mockResolvedValue({ entries: [] });
  });

  it('renders a note with its author, timestamp and message', async () => {
    getBillingClaimHistoryMock.mockResolvedValue({ entries: [noteEntry] });
    renderHistory();

    const row = (await screen.findByText('Note')).closest('tr')!;
    expect(within(row).getByText('Jane Doe')).toBeInTheDocument();
    expect(within(row).getByText(noteEntry.message!)).toBeInTheDocument();
    expect(within(row).getByText(/2026/)).toBeInTheDocument();
  });

  it('still renders a field change as previous → new', async () => {
    getBillingClaimHistoryMock.mockResolvedValue({ entries: [changeEntry] });
    renderHistory();

    const row = (await screen.findByText('Update Coverage')).closest('tr')!;
    expect(within(row).getByText('Member ID:')).toBeInTheDocument();
    expect(within(row).getByText('A')).toBeInTheDocument();
    expect(within(row).getByText('B')).toBeInTheDocument();
    expect(within(row).getByText('System')).toBeInTheDocument();
    // No rule attribution on the change → no rule suffix.
    expect(within(row).queryByText(/via/)).not.toBeInTheDocument();
  });

  it('links a rule-attributed change to the rule that made it', async () => {
    getBillingClaimHistoryMock.mockResolvedValue({
      entries: [
        {
          ...changeEntry,
          changes: [
            {
              field: 'tags',
              label: 'Tags',
              previousValue: 'Ready to submit',
              newValue: 'Ready to submit, Hold',
              rule: { id: 'rule-1', name: 'Normalize tags', engine: 'claim-submission' },
            },
          ],
        },
      ],
    });
    renderHistory();

    const row = (await screen.findByText('Update Coverage')).closest('tr')!;
    const ruleLink = within(row).getByRole('link', { name: 'Normalize tags' });
    expect(ruleLink).toHaveAttribute('href', '/rules/claim-submission/rule-1');
    expect(within(row).getByText(/via/)).toBeInTheDocument();
  });

  it('renders no rule link when the stored attribution is missing a field', async () => {
    getBillingClaimHistoryMock.mockResolvedValue({
      entries: [
        {
          ...changeEntry,
          changes: [
            {
              field: 'tags',
              label: 'Tags',
              previousValue: 'Ready to submit',
              newValue: 'Ready to submit, Hold',
              rule: { id: 'rule-1', name: 'Normalize tags' } as never,
            },
          ],
        },
      ],
    });
    renderHistory();

    const row = (await screen.findByText('Update Coverage')).closest('tr')!;
    expect(within(row).queryByRole('link')).not.toBeInTheDocument();
    expect(within(row).queryByText(/via/)).not.toBeInTheDocument();
  });

  it('shows a dash for an entry with neither a message nor changes', async () => {
    getBillingClaimHistoryMock.mockResolvedValue({
      entries: [
        {
          ...changeEntry,
          changes: [],
        },
      ],
    });
    renderHistory();

    const row = (await screen.findByText('Update Coverage')).closest('tr')!;
    expect(within(row).getByText('-')).toBeInTheDocument();
  });

  it('surfaces the error returned by the history fetch', async () => {
    getBillingClaimHistoryMock.mockRejectedValue(new Error('Claim not found'));
    renderHistory();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Claim not found')).toBeInTheDocument();
  });
});
