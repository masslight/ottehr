import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'test-appointment-id' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

const mockSetPartialChartData = vi.fn();
let mockChartData: { emCode?: { code: string; display: string; resourceId?: string } } = {};

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useChartData: () => ({
    chartData: mockChartData,
    setPartialChartData: mockSetPartialChartData,
  }),
  useSaveChartData: vi.fn(),
  useDeleteChartData: vi.fn(),
}));

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: any[]) => mockEnqueueSnackbar(...args),
}));

vi.mock('utils', () => ({
  emCodeOptions: [
    { display: '99213 Established Patient - E/M Level 3', code: '99213' },
    { display: '99214 Established Patient - E/M Level 4', code: '99214' },
    { display: '99215 Established Patient - E/M Level 5', code: '99215' },
  ],
}));

vi.mock('src/constants/data-test-ids', () => ({
  dataTestIds: {
    assessmentCard: {
      emCodeDropdown: 'em-code-dropdown',
    },
  },
}));

import { EMCodeField } from '../../src/features/visits/shared/components/assessment-tab/EMCodeField';
import {
  useDeleteChartData,
  useSaveChartData,
} from '../../src/features/visits/shared/stores/appointment/appointment.store';

// ============================================================================
// HELPERS
// ============================================================================

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

// ============================================================================
// TESTS
// ============================================================================

describe('EMCodeField', () => {
  let mockSaveMutate: ReturnType<typeof vi.fn>;
  let mockDeleteMutate: ReturnType<typeof vi.fn>;
  let capturedSaveCallbacks: {
    onSuccess?: (data: { chartData: { emCode: { code: string; display: string; resourceId?: string } } }) => void;
    onError?: () => void;
  };
  let capturedDeleteCallbacks: { onSuccess?: () => void; onError?: () => void };

  beforeEach(() => {
    vi.clearAllMocks();
    mockChartData = {};
    capturedSaveCallbacks = {};
    capturedDeleteCallbacks = {};

    mockSaveMutate = vi.fn((data, callbacks) => {
      capturedSaveCallbacks = callbacks || {};
    });

    mockDeleteMutate = vi.fn((data, callbacks) => {
      capturedDeleteCallbacks = callbacks || {};
    });

    vi.mocked(useSaveChartData).mockReturnValue({
      mutate: mockSaveMutate,
      isPending: false,
    } as any);

    vi.mocked(useDeleteChartData).mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    } as any);
  });

  describe('rendering', () => {
    it('should render autocomplete field', () => {
      render(<EMCodeField />, { wrapper: createWrapper() });

      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByLabelText(/E&M code/i)).toBeInTheDocument();
    });

    it('should display existing E&M code value', () => {
      mockChartData = {
        emCode: { code: '99213', display: '99213 Established Patient - E/M Level 3' },
      };

      render(<EMCodeField />, { wrapper: createWrapper() });

      expect(screen.getByRole('combobox')).toHaveValue('99213 Established Patient - E/M Level 3');
    });

    it('should show empty field when no E&M code selected', () => {
      mockChartData = {};

      render(<EMCodeField />, { wrapper: createWrapper() });

      expect(screen.getByRole('combobox')).toHaveValue('');
    });
  });

  describe('selecting E&M code', () => {
    it('should call saveChartData with selected code', async () => {
      const user = userEvent.setup();
      render(<EMCodeField />, { wrapper: createWrapper() });

      await user.click(screen.getByRole('combobox'));
      await user.click(await screen.findByText(/99213/));

      expect(mockSaveMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          emCode: expect.objectContaining({ code: '99213' }),
        }),
        expect.any(Object)
      );
    });

    it('should update local state with selected code', async () => {
      const user = userEvent.setup();
      render(<EMCodeField />, { wrapper: createWrapper() });

      await user.click(screen.getByRole('combobox'));
      await user.click(await screen.findByText(/99214/));

      expect(mockSetPartialChartData).toHaveBeenCalledWith(
        expect.objectContaining({
          emCode: expect.objectContaining({ code: '99214' }),
        }),
        false
      );
    });

    it('should update state with server response on success', async () => {
      const user = userEvent.setup();
      render(<EMCodeField />, { wrapper: createWrapper() });

      await user.click(screen.getByRole('combobox'));
      await user.click(await screen.findByText(/99213/));

      // Simulate server success
      capturedSaveCallbacks.onSuccess?.({
        chartData: {
          emCode: {
            code: '99213',
            display: '99213 Established Patient - E/M Level 3',
            resourceId: 'server-id-123',
          },
        },
      });

      // Should update with server data including resourceId
      expect(mockSetPartialChartData).toHaveBeenLastCalledWith({
        emCode: expect.objectContaining({
          resourceId: 'server-id-123',
        }),
      });
    });

    it('should show error and rollback on save failure', async () => {
      const user = userEvent.setup();
      mockChartData = {
        emCode: { code: '99214', display: 'Previous code', resourceId: 'old-id' },
      };

      render(<EMCodeField />, { wrapper: createWrapper() });

      await user.click(screen.getByRole('combobox'));
      await user.click(await screen.findByText(/99213/));

      mockSetPartialChartData.mockClear();

      // Simulate server error
      capturedSaveCallbacks.onError?.();

      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('error'),
        expect.objectContaining({ variant: 'error' })
      );

      expect(mockSetPartialChartData).toHaveBeenCalledWith({
        emCode: expect.objectContaining({ code: '99214' }),
      });
    });
  });

  describe('clearing E&M code', () => {
    it('should call deleteChartData when clearing', async () => {
      const user = userEvent.setup();
      mockChartData = {
        emCode: { code: '99213', display: '99213 Established Patient - E/M Level 3', resourceId: 'existing-id' },
      };

      render(<EMCodeField />, { wrapper: createWrapper() });

      // Focus on the combobox to make clear button visible
      const combobox = screen.getByRole('combobox');
      await user.click(combobox);

      const clearButton = screen.getByTitle('Clear');
      await user.click(clearButton);

      expect(mockDeleteMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          emCode: expect.objectContaining({ code: '99213' }),
        }),
        expect.any(Object)
      );
    });

    it('should clear local state when deleting', async () => {
      const user = userEvent.setup();
      mockChartData = {
        emCode: { code: '99213', display: '99213 Established Patient - E/M Level 3', resourceId: 'existing-id' },
      };

      render(<EMCodeField />, { wrapper: createWrapper() });

      // Focus on the combobox to make clear button visible
      const combobox = screen.getByRole('combobox');
      await user.click(combobox);

      const clearButton = screen.getByTitle('Clear');
      await user.click(clearButton);

      expect(mockSetPartialChartData).toHaveBeenCalledWith(
        {
          emCode: undefined,
        },
        false
      );
    });

    it('should show error and rollback on delete failure', async () => {
      const user = userEvent.setup();
      const existingCode = {
        code: '99213',
        display: '99213 Established Patient - E/M Level 3',
        resourceId: 'existing-id',
      };
      mockChartData = { emCode: existingCode };

      render(<EMCodeField />, { wrapper: createWrapper() });

      // Focus on the combobox to make clear button visible
      const combobox = screen.getByRole('combobox');
      await user.click(combobox);

      const clearButton = screen.getByTitle('Clear');
      await user.click(clearButton);

      mockSetPartialChartData.mockClear();

      // Simulate server error
      capturedDeleteCallbacks.onError?.();

      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('error'),
        expect.objectContaining({ variant: 'error' })
      );

      expect(mockSetPartialChartData).toHaveBeenCalledWith({
        emCode: expect.objectContaining({ code: '99213' }),
      });
    });
  });

  describe('disabled state', () => {
    it('should disable field while saving', () => {
      vi.mocked(useSaveChartData).mockReturnValue({
        mutate: mockSaveMutate,
        isPending: true,
      } as any);

      render(<EMCodeField />, { wrapper: createWrapper() });

      expect(screen.getByRole('combobox')).toBeDisabled();
    });

    it('should disable field while deleting', () => {
      vi.mocked(useDeleteChartData).mockReturnValue({
        mutate: mockDeleteMutate,
        isPending: true,
      } as any);

      render(<EMCodeField />, { wrapper: createWrapper() });

      expect(screen.getByRole('combobox')).toBeDisabled();
    });

    it('should enable field when not loading', () => {
      render(<EMCodeField />, { wrapper: createWrapper() });

      expect(screen.getByRole('combobox')).not.toBeDisabled();
    });
  });
});
