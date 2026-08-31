import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDeleteFolderDialog } from '../../src/features/visits/shared/components/patient/docs/ConfirmDeleteFolderDialog';

vi.mock('src/components/RoundedButton', () => ({
  RoundedButton: ({ children, onClick, disabled, loading, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled || loading} {...rest}>
      {children}
    </button>
  ),
}));

const baseProps = {
  open: true,
  folderName: 'After-Visit Care',
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

describe('ConfirmDeleteFolderDialog', () => {
  it('renders the folder name and the soft-delete copy', () => {
    render(<ConfirmDeleteFolderDialog {...baseProps} />);
    expect(screen.getByText('Delete Folder')).toBeInTheDocument();
    // The dialog spells out the soft-delete semantics: existing patients keep the folder.
    const description = screen.getByText(/Are you sure you want to delete the folder/i);
    expect(description).toHaveTextContent('After-Visit Care');
    expect(description).toHaveTextContent(/cannot be undone/i);
    expect(description).toHaveTextContent(/folder will remain for the patients who have docs in it/i);
  });

  it('calls onConfirm and onClose on success', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDeleteFolderDialog {...baseProps} onConfirm={onConfirm} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('surfaces a server error when onConfirm rejects', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('bad delete'));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDeleteFolderDialog {...baseProps} onConfirm={onConfirm} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByText('bad delete')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Cancel calls onClose without invoking onConfirm', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDeleteFolderDialog {...baseProps} onConfirm={onConfirm} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
