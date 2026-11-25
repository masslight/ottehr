import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppDialog } from '../../src/components/dialogs/AppDialog';
import { confirmDestructive, confirmDialog } from '../../src/components/dialogs/confirmDialog';
import { ConfirmDialogHost } from '../../src/components/dialogs/ConfirmDialogHost';

const footerLabels = (): string[] => {
  const dialog = screen.getByRole('dialog');
  return within(dialog)
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-label') !== 'Close')
    .map((button) => button.textContent ?? '');
};

describe('AppDialog', () => {
  it('labels the dialog with its title and always has a ✕', () => {
    render(
      <AppDialog variant="confirm" open onClose={vi.fn()} title="Send Statement by Mail?" primary={{ label: 'Send' }}>
        body
      </AppDialog>
    );
    expect(screen.getByRole('dialog', { name: 'Send Statement by Mail?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('puts dismiss first, then actions, then the primary', () => {
    render(
      <AppDialog
        variant="form"
        size="s"
        open
        onClose={vi.fn()}
        title="Edit Employer"
        primary={{ label: 'Save', onClick: vi.fn() }}
        actions={[{ label: 'Delete Employer', onClick: vi.fn(), tone: 'error' }]}
      />
    );
    expect(footerLabels()).toEqual(['Cancel', 'Delete Employer', 'Save']);
  });

  it('closes from ✕, the dismiss button and Esc', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AppDialog variant="confirm" open onClose={onClose} title="Dispense Order?" primary={{ label: 'Dispense' }} />
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('reports how it was closed, and can ignore Esc', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(
      <AppDialog variant="form" size="s" open onClose={onClose} title="Send Invoice" primary={{ label: 'Send' }} />
    );
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose.mock.calls.map(([reason]) => reason)).toEqual(['escapeKeyDown', 'closeButton', 'dismissButton']);

    onClose.mockClear();
    rerender(
      <AppDialog
        variant="form"
        size="s"
        open
        onClose={onClose}
        disableOutsideClose
        title="Send Invoice"
        primary={{ label: 'Send' }}
      />
    );
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledWith('closeButton');
  });

  it('cannot be closed while the primary action is running', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AppDialog
        variant="destructive"
        open
        onClose={onClose}
        title="Delete This Note?"
        primary={{ label: 'Delete Note', onClick: vi.fn(), loading: true }}
      />
    );
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows loading and blocks closing while a promise-returning primary action runs', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    let finish: () => void = () => undefined;
    const onClick = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(
      <AppDialog
        variant="destructive"
        open
        onClose={onClose}
        title="Delete This Note?"
        primary={{ label: 'Delete Note', onClick }}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Delete Note' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finish());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled());
  });

  it('shows a single Close button for an alert with nothing to decide', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AppDialog variant="alert" open onClose={onClose} title="eRX Pending Review" />);
    expect(footerLabels()).toEqual(['Close']);
    await user.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Close' })[1]);
    expect(onClose).toHaveBeenCalled();
  });

  it('offers Back and the way to proceed for an alert the user can pass', () => {
    render(
      <AppDialog
        variant="alert"
        open
        onClose={vi.fn()}
        title="Abnormal Vital Values"
        primary={{ label: 'Leave Anyway', onClick: vi.fn() }}
      />
    );
    expect(footerLabels()).toEqual(['Back', 'Leave Anyway']);
  });

  it('has no footer when a form is given no buttons', () => {
    render(
      <AppDialog variant="form" size="m" open onClose={vi.fn()} title="Activity Log">
        log
      </AppDialog>
    );
    expect(footerLabels()).toEqual([]);
  });

  it('submits the form from the primary button', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <AppDialog
        variant="form"
        size="s"
        open
        onClose={vi.fn()}
        title="Rename Folder"
        onSubmit={onSubmit}
        primary={{ label: 'Save' }}
      >
        <input aria-label="Folder name" defaultValue="Labs" />
      </AppDialog>
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('confirmDialog / confirmDestructive', () => {
  it('resolves true when the user confirms', async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogHost />);
    let answer: Promise<boolean> | undefined;
    act(() => {
      answer = confirmDestructive({ title: 'Delete Quick Pick?', body: 'Gone for good.', confirmLabel: 'Delete' });
    });
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await expect(answer).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('resolves false when the user cancels', async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogHost />);
    let answer: Promise<boolean> | undefined;
    act(() => {
      answer = confirmDialog({ title: 'Send Fax?', confirmLabel: 'Send Fax' });
    });
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await expect(answer).resolves.toBe(false);
  });
});
