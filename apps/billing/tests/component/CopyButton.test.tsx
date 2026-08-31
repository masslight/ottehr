import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { CopyButton } from '../../src/components/CopyButton';

const { enqueueSnackbarMock } = vi.hoisted(() => ({ enqueueSnackbarMock: vi.fn() }));

vi.mock('notistack', () => ({ enqueueSnackbar: enqueueSnackbarMock }));

const CLAIM_ID = '90a1ef5a-1aa0-4026-ae92-21d8833eea51';
const COPIED_FEEDBACK_MS = 2000;

// Must be called after userEvent.setup(), which swaps in a clipboard stub of its own.
function stubClipboard(writeTextError?: Error): Mock {
  const writeText = writeTextError ? vi.fn().mockRejectedValue(writeTextError) : vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText,
    },
    writable: true,
    configurable: true,
  });
  return writeText;
}

describe('CopyButton', () => {
  beforeEach(() => {
    enqueueSnackbarMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('copies the value to the clipboard', async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    render(<CopyButton value={CLAIM_ID} label="Claim ID" />);

    const copyButton = screen.getByRole('button', { name: 'Copy Claim ID' });
    await user.click(copyButton);

    expect(writeText).toHaveBeenCalledWith(CLAIM_ID);
  });

  it('copies when the wrapped value itself is clicked', async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    render(
      <CopyButton value={CLAIM_ID} label="Claim ID">
        <span>{CLAIM_ID}</span>
      </CopyButton>
    );

    const claimId = screen.getByText(CLAIM_ID);
    await user.click(claimId);

    expect(writeText).toHaveBeenCalledWith(CLAIM_ID);
    expect(await screen.findByRole('button', { name: 'Copied Claim ID' })).toBeInTheDocument();
  });

  it('confirms the copy with a check icon', async () => {
    const user = userEvent.setup();
    stubClipboard();
    render(<CopyButton value={CLAIM_ID} label="Claim ID" />);

    const copyButton = screen.getByRole('button', { name: 'Copy Claim ID' });
    await user.click(copyButton);

    expect(await screen.findByRole('button', { name: 'Copied Claim ID' })).toBeInTheDocument();
    expect(screen.getByTestId('CheckIcon')).toBeInTheDocument();
    expect(screen.queryByTestId('ContentCopyIcon')).not.toBeInTheDocument();
  });

  it('reverts to the copy icon once the confirmation expires', async () => {
    vi.useFakeTimers();
    stubClipboard();
    render(<CopyButton value={CLAIM_ID} label="Claim ID" />);

    const copyButton = screen.getByRole('button', { name: 'Copy Claim ID' });
    fireEvent.click(copyButton);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole('button', { name: 'Copied Claim ID' })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(COPIED_FEEDBACK_MS);
    });

    expect(screen.getByRole('button', { name: 'Copy Claim ID' })).toBeInTheDocument();
    expect(screen.getByTestId('ContentCopyIcon')).toBeInTheDocument();
  });

  it('restarts the confirmation window when the value is copied again', async () => {
    vi.useFakeTimers();
    stubClipboard();
    render(<CopyButton value={CLAIM_ID} label="Claim ID" />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy Claim ID' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(COPIED_FEEDBACK_MS / 2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Copied Claim ID' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(COPIED_FEEDBACK_MS / 2);
    });
    expect(screen.getByRole('button', { name: 'Copied Claim ID' })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(COPIED_FEEDBACK_MS / 2);
    });
    expect(screen.getByRole('button', { name: 'Copy Claim ID' })).toBeInTheDocument();
  });

  it('surfaces an error and keeps the copy icon when the clipboard write fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    stubClipboard(new Error('clipboard unavailable'));
    render(<CopyButton value={CLAIM_ID} label="Claim ID" />);

    const copyButton = screen.getByRole('button', { name: 'Copy Claim ID' });
    await user.click(copyButton);

    await waitFor(() =>
      expect(enqueueSnackbarMock).toHaveBeenCalledWith('Could not copy Claim ID to clipboard', {
        variant: 'error',
      })
    );
    expect(screen.getByRole('button', { name: 'Copy Claim ID' })).toBeInTheDocument();
    expect(screen.queryByTestId('CheckIcon')).not.toBeInTheDocument();

    consoleError.mockRestore();
  });
});
