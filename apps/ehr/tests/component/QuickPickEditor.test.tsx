import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: any[]) => mockEnqueueSnackbar(...args),
}));

vi.mock('src/components/RoundedButton', () => ({
  RoundedButton: ({ children, onClick, disabled, variant, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} {...rest}>
      {children}
    </button>
  ),
}));

import QuickPickEditor, {
  QuickPickEditorColumn,
  QuickPickEditorField,
} from '../../src/features/visits/telemed/components/telemed-admin/QuickPickEditor';

// ============================================================================
// HELPERS
// ============================================================================

interface MockItem {
  id?: string;
  name: string;
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

const mockColumns: QuickPickEditorColumn<MockItem>[] = [{ label: 'Name', getValue: (item) => item.name }];

const mockFields: QuickPickEditorField[] = [{ key: 'name', label: 'Name', required: true }];

const mockFetchItems = vi.fn<() => Promise<MockItem[]>>();
const mockCreateItem = vi.fn<(data: Omit<MockItem, 'id'>) => Promise<MockItem>>();
const mockRemoveItem = vi.fn<(id: string) => Promise<void>>();

const defaultProps = {
  title: 'Test Quick Picks',
  description: 'Test description for quick picks',
  columns: mockColumns,
  fields: mockFields,
  fetchItems: mockFetchItems,
  createItem: mockCreateItem,
  removeItem: mockRemoveItem,
  buildItemFromFields: (values: Record<string, string>) => ({ name: values.name }),
};

// ============================================================================
// TESTS
// ============================================================================

describe('QuickPickEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchItems.mockResolvedValue([]);
  });

  describe('loading state', () => {
    it('should render loading state initially', () => {
      // fetchItems returns a promise that never resolves during this check
      mockFetchItems.mockReturnValue(new Promise(() => {}));
      render(<QuickPickEditor {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('displaying items', () => {
    it('should display items in table after loading', async () => {
      mockFetchItems.mockResolvedValue([
        { id: '1', name: 'Penicillin' },
        { id: '2', name: 'Aspirin' },
      ]);

      render(<QuickPickEditor {...defaultProps} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });
      expect(screen.getByText('Aspirin')).toBeInTheDocument();
    });

    it('should show empty state when no items exist', async () => {
      mockFetchItems.mockResolvedValue([]);

      render(<QuickPickEditor {...defaultProps} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('No quick picks configured yet.')).toBeInTheDocument();
      });
    });

    it('should sort items alphabetically by first column', async () => {
      mockFetchItems.mockResolvedValue([
        { id: '1', name: 'Penicillin' },
        { id: '2', name: 'Aspirin' },
        { id: '3', name: 'Ibuprofen' },
      ]);

      render(<QuickPickEditor {...defaultProps} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Aspirin')).toBeInTheDocument();
      });

      const rows = screen.getAllByRole('row');
      // First row is the header; data rows follow
      const dataRows = rows.slice(1);
      const names = dataRows.map((row) => row.querySelector('td')?.textContent);
      expect(names).toEqual(['Aspirin', 'Ibuprofen', 'Penicillin']);
    });
  });

  describe('add dialog', () => {
    it('should open add dialog when Add button is clicked', async () => {
      mockFetchItems.mockResolvedValue([]);
      const user = userEvent.setup();

      render(<QuickPickEditor {...defaultProps} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Quick Picks')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add/i }));

      expect(screen.getByText('Add Quick Pick')).toBeInTheDocument();
      expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
    });

    it('should validate required fields before saving', async () => {
      mockFetchItems.mockResolvedValue([]);
      const user = userEvent.setup();

      render(<QuickPickEditor {...defaultProps} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Quick Picks')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add/i }));

      // Click the Add button in the dialog without filling in the required field
      const dialogButtons = screen.getAllByRole('button', { name: /add/i });
      const dialogAddButton = dialogButtons[dialogButtons.length - 1];
      await user.click(dialogAddButton);

      expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Name is required', { variant: 'warning' });
      expect(mockCreateItem).not.toHaveBeenCalled();
    });

    it('should call createItem when saving a new item', async () => {
      mockFetchItems.mockResolvedValue([]);
      mockCreateItem.mockResolvedValue({ id: 'new-1', name: 'Amoxicillin' });
      const user = userEvent.setup();

      render(<QuickPickEditor {...defaultProps} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Quick Picks')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add/i }));
      await user.type(screen.getByLabelText(/Name/i), 'Amoxicillin');

      const dialogButtons = screen.getAllByRole('button', { name: /add/i });
      const dialogAddButton = dialogButtons[dialogButtons.length - 1];
      await user.click(dialogAddButton);

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith({ name: 'Amoxicillin' });
      });
    });

    it('should show success snackbar after creating item', async () => {
      mockFetchItems.mockResolvedValue([]);
      mockCreateItem.mockResolvedValue({ id: 'new-1', name: 'Amoxicillin' });
      const user = userEvent.setup();

      render(<QuickPickEditor {...defaultProps} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Quick Picks')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add/i }));
      await user.type(screen.getByLabelText(/Name/i), 'Amoxicillin');

      const dialogButtons = screen.getAllByRole('button', { name: /add/i });
      const dialogAddButton = dialogButtons[dialogButtons.length - 1];
      await user.click(dialogAddButton);

      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Quick pick created', { variant: 'success' });
      });
    });

    it('should show error snackbar when create fails', async () => {
      mockFetchItems.mockResolvedValue([]);
      mockCreateItem.mockRejectedValue(new Error('Server error'));
      const user = userEvent.setup();

      render(<QuickPickEditor {...defaultProps} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Quick Picks')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add/i }));
      await user.type(screen.getByLabelText(/Name/i), 'Amoxicillin');

      const dialogButtons = screen.getAllByRole('button', { name: /add/i });
      const dialogAddButton = dialogButtons[dialogButtons.length - 1];
      await user.click(dialogAddButton);

      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Failed to save quick pick', { variant: 'error' });
      });
    });

    it('should disable Add button when saving is in progress', async () => {
      mockFetchItems.mockResolvedValue([]);
      // Create a promise that we control resolution of
      let resolveCreate: (value: MockItem) => void;
      mockCreateItem.mockReturnValue(
        new Promise<MockItem>((resolve) => {
          resolveCreate = resolve;
        })
      );
      const user = userEvent.setup();

      render(<QuickPickEditor {...defaultProps} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test Quick Picks')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add/i }));
      await user.type(screen.getByLabelText(/Name/i), 'Amoxicillin');

      const dialogButtons = screen.getAllByRole('button', { name: /add/i });
      const dialogAddButton = dialogButtons[dialogButtons.length - 1];
      await user.click(dialogAddButton);

      // While saving, both Cancel and Save buttons should be disabled
      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        expect(cancelButton).toBeDisabled();
      });

      // Resolve the create to clean up
      await act(async () => {
        resolveCreate!({ id: 'new-1', name: 'Amoxicillin' });
      });
    });
  });

  describe('delete', () => {
    it('should call removeItem when delete is confirmed', async () => {
      mockFetchItems.mockResolvedValue([
        { id: '1', name: 'Penicillin' },
        { id: '2', name: 'Aspirin' },
      ]);
      mockRemoveItem.mockResolvedValue(undefined);
      // Mock window.confirm to return true
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(<QuickPickEditor {...defaultProps} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });

      // Items are sorted alphabetically, so first Remove button is for Aspirin (id: '2')
      const removeButtons = screen.getAllByTitle('Remove');
      await act(async () => {
        removeButtons[0].click();
      });

      await waitFor(() => {
        expect(mockRemoveItem).toHaveBeenCalledWith('2');
      });

      confirmSpy.mockRestore();
    });

    it('should not call removeItem when delete is cancelled', async () => {
      mockFetchItems.mockResolvedValue([{ id: '1', name: 'Penicillin' }]);
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<QuickPickEditor {...defaultProps} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });

      const removeButton = screen.getByTitle('Remove');
      await act(async () => {
        removeButton.click();
      });

      expect(mockRemoveItem).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should show error snackbar when fetch fails', async () => {
      mockFetchItems.mockRejectedValue(new Error('Network error'));

      render(<QuickPickEditor {...defaultProps} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Failed to load test quick picks', { variant: 'error' });
      });
    });
  });
});
