import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FOLDERS_CONFIG } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { FolderNameDialog } from '../../src/features/visits/shared/components/patient/docs/FolderNameDialog';

vi.mock('src/components/RoundedButton', () => ({
  RoundedButton: ({ children, onClick, disabled, loading, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled || loading} {...rest}>
      {children}
    </button>
  ),
}));

// Real protected folder display names; the dialog dedupes against these the same way
// AdminCustomFoldersPage does at runtime.
const PROTECTED_NAMES = FOLDERS_CONFIG.map((f) => f.display);
const FIRST_PROTECTED_NAME = PROTECTED_NAMES[0];
const EXISTING_CUSTOM_NAME = 'After-Visit Care';

const baseProps = {
  open: true,
  mode: 'create' as const,
  initialName: '',
  existingNames: [...PROTECTED_NAMES, EXISTING_CUSTOM_NAME],
  onSubmit: vi.fn(),
  onClose: vi.fn(),
};

describe('FolderNameDialog', () => {
  it('renders create-mode title and Create action', () => {
    render(<FolderNameDialog {...baseProps} />);
    expect(screen.getByText('Create New Folder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('renders rename-mode title with Save action and prefilled name', () => {
    render(<FolderNameDialog {...baseProps} mode="rename" initialName={EXISTING_CUSTOM_NAME} />);
    expect(screen.getByText('Rename Folder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect((screen.getByLabelText(/Folder Name/i) as HTMLInputElement).value).toBe(EXISTING_CUSTOM_NAME);
  });

  it('disables submit when the field is empty', () => {
    render(<FolderNameDialog {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('shows a length error when over 60 characters', async () => {
    const user = userEvent.setup();
    render(<FolderNameDialog {...baseProps} />);
    const input = screen.getByLabelText(/Folder Name/i);
    await user.type(input, 'a'.repeat(61));
    expect(screen.getByText(/60 characters or fewer/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('shows an allowed-chars error when invalid characters are entered', async () => {
    const user = userEvent.setup();
    render(<FolderNameDialog {...baseProps} />);
    const input = screen.getByLabelText(/Folder Name/i);
    await user.type(input, 'Bad/Name');
    expect(screen.getByText(/Only letters, numbers, spaces/i)).toBeInTheDocument();
  });

  it('shows a duplicate error when the name matches an existing folder (case-insensitive)', async () => {
    const user = userEvent.setup();
    render(<FolderNameDialog {...baseProps} />);
    const input = screen.getByLabelText(/Folder Name/i);
    await user.type(input, FIRST_PROTECTED_NAME.toLowerCase());
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });

  it('in rename mode, allows the same name as initialName but rejects other existing names', async () => {
    const user = userEvent.setup();
    render(<FolderNameDialog {...baseProps} mode="rename" initialName={EXISTING_CUSTOM_NAME} />);
    // Same as initialName — valid (no error).
    const input = screen.getByLabelText(/Folder Name/i);
    expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    await user.clear(input);
    await user.type(input, FIRST_PROTECTED_NAME);
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });

  it('calls onSubmit with the trimmed name and then onClose on success', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<FolderNameDialog {...baseProps} onSubmit={onSubmit} onClose={onClose} />);
    const input = screen.getByLabelText(/Folder Name/i);
    await user.type(input, '  New Folder  ');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('New Folder'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('surfaces a server error message when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('boom from server'));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<FolderNameDialog {...baseProps} onSubmit={onSubmit} onClose={onClose} />);
    const input = screen.getByLabelText(/Folder Name/i);
    await user.type(input, 'New Folder');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(screen.getByText('boom from server')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('submits on Enter when valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<FolderNameDialog {...baseProps} onSubmit={onSubmit} />);
    const input = screen.getByLabelText(/Folder Name/i);
    await user.type(input, 'New Folder{Enter}');
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('New Folder'));
  });
});
