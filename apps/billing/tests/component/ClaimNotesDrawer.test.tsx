import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { ClaimHistoryEntry } from 'utils/lib/types/data/billing/claim-history';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaimNotesDrawer } from '../../src/components/claim/ClaimNotesDrawer';

const { getBillingClaimHistoryMock, addBillingClaimNoteMock, oystehrZambdaStub } = vi.hoisted(() => ({
  getBillingClaimHistoryMock: vi.fn(),
  addBillingClaimNoteMock: vi.fn(),
  oystehrZambdaStub: {},
}));

vi.mock('../../src/api/api', () => ({
  getBillingClaimHistory: getBillingClaimHistoryMock,
  addBillingClaimNote: addBillingClaimNoteMock,
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: oystehrZambdaStub,
  }),
}));

const { enqueueSnackbarMock } = vi.hoisted(() => ({ enqueueSnackbarMock: vi.fn() }));

vi.mock('notistack', () => ({
  enqueueSnackbar: enqueueSnackbarMock,
  SnackbarProvider: ({ children }: { children?: ReactNode }) => children ?? null,
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
    display: 'Jane Doe',
    type: 'user',
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

function renderDrawer(onNoteAdded = vi.fn()): { onNoteAdded: ReturnType<typeof vi.fn> } {
  render(<ClaimNotesDrawer open onClose={() => {}} claimId="claim-1" onNoteAdded={onNoteAdded} />);
  return { onNoteAdded };
}

describe('ClaimNotesDrawer', () => {
  beforeEach(() => {
    getBillingClaimHistoryMock.mockReset();
    getBillingClaimHistoryMock.mockResolvedValue({ entries: [] });
    addBillingClaimNoteMock.mockReset();
    addBillingClaimNoteMock.mockResolvedValue({ ok: true });
    enqueueSnackbarMock.mockReset();
  });

  it('lists only the note entries from the claim history', async () => {
    getBillingClaimHistoryMock.mockResolvedValue({ entries: [noteEntry, changeEntry] });
    renderDrawer();

    expect(await screen.findByText(noteEntry.message!)).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByText('Member ID:')).not.toBeInTheDocument();
  });

  it('tells the user when the claim has no notes', async () => {
    renderDrawer();

    expect(await screen.findByText('No notes on this claim yet.')).toBeInTheDocument();
  });

  it('keeps Add disabled until the note has non-whitespace content', async () => {
    renderDrawer();
    await screen.findByText('No notes on this claim yet.');

    const addButton = screen.getByRole('button', { name: 'Add' });
    expect(addButton).toBeDisabled();

    const input = screen.getByLabelText('Add a note');
    fireEvent.change(input, { target: { value: '   ' } });
    expect(addButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'Called payer' } });
    expect(addButton).toBeEnabled();
  });

  it('posts a trimmed note, clears the field, re-fetches and reports the addition', async () => {
    const { onNoteAdded } = renderDrawer();
    await screen.findByText('No notes on this claim yet.');

    const input = screen.getByLabelText('Add a note');
    fireEvent.change(input, { target: { value: '  Called payer  ' } });
    getBillingClaimHistoryMock.mockResolvedValue({ entries: [noteEntry] });

    const addButton = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(addButton);

    await waitFor(() =>
      expect(addBillingClaimNoteMock).toHaveBeenCalledWith(oystehrZambdaStub, {
        claimId: 'claim-1',
        message: 'Called payer',
      })
    );
    await waitFor(() => expect(input).toHaveValue(''));
    expect(await screen.findByText(noteEntry.message!)).toBeInTheDocument();
    expect(onNoteAdded).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed post in a snackbar and keeps the typed note', async () => {
    addBillingClaimNoteMock.mockRejectedValue(new Error('Claim not found'));
    const { onNoteAdded } = renderDrawer();
    await screen.findByText('No notes on this claim yet.');

    const input = screen.getByLabelText('Add a note');
    fireEvent.change(input, { target: { value: 'Called payer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(enqueueSnackbarMock).toHaveBeenCalledWith('Claim not found', { variant: 'error' }));
    expect(input).toHaveValue('Called payer');
    expect(onNoteAdded).not.toHaveBeenCalled();
  });

  it('surfaces a failed load as an alert', async () => {
    getBillingClaimHistoryMock.mockRejectedValue(new Error('Claim not found'));
    renderDrawer();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Claim not found')).toBeInTheDocument();
  });

  it('does not load notes while closed', () => {
    render(<ClaimNotesDrawer open={false} onClose={() => {}} claimId="claim-1" onNoteAdded={vi.fn()} />);

    expect(getBillingClaimHistoryMock).not.toHaveBeenCalled();
  });
});
