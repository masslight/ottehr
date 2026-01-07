import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
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
const mockChartDataSetState = vi.fn();
let mockChartData: Pick<GetChartDataResponse, 'allergies'> = {};

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useChartData: () => ({
    chartData: mockChartData,
    setPartialChartData: mockSetPartialChartData,
    chartDataSetState: mockChartDataSetState,
  }),
  useSaveChartData: vi.fn(),
  useDeleteChartData: vi.fn(),
}));

const mockAllergySearchData = [
  { id: 12345, name: 'Banana' },
  { id: 23456, name: 'Peanut' },
  { id: 34567, name: 'Penicillin' },
];

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetAllergiesSearch: vi.fn((search: string) => ({
    isFetching: false,
    data: search && search.length > 0 ? mockAllergySearchData : [],
  })),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({
    isAppointmentReadOnly: false,
  }),
}));

const mockChartDataArrayValueOnSubmit = vi.fn();
let mockChartDataArrayValueIsLoadingThunk: () => boolean = () => false;

vi.mock('../../src/features/visits/shared/hooks/useChartDataArrayValue', () => ({
  useChartDataArrayValue: (key: string) => {
    if (key === 'allergies') {
      return {
        isLoading: mockChartDataArrayValueIsLoadingThunk(),
        onSubmit: mockChartDataArrayValueOnSubmit,
        values: mockChartData.allergies || [],
      };
    }
    return [];
  },
}));

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: any[]) => mockEnqueueSnackbar(...args),
}));

import { dataTestIds } from 'src/constants/data-test-ids';
import { GetChartDataResponse } from 'utils';
import { KnownAllergiesProviderColumn } from '../../src/features/visits/shared/components/known-allergies/KnownAllergiesProviderColumn';
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

describe('KnownAllergiesProviderColumn', () => {
  let mockSaveMutate: ReturnType<typeof vi.fn>;
  let mockDeleteMutate: ReturnType<typeof vi.fn>;
  let capturedDeleteCallbacks: { onSuccess?: () => void; onError?: () => void };

  beforeEach(() => {
    vi.clearAllMocks();
    mockChartDataArrayValueIsLoadingThunk = () => false;
    mockChartData = {};
    capturedDeleteCallbacks = {};

    mockSaveMutate = vi.fn();

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
      render(<KnownAllergiesProviderColumn />, { wrapper: createWrapper() });

      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByLabelText(/Agent\/Substance/i)).toBeInTheDocument();
    });

    it('should display existing allergy value', () => {
      mockChartData = {
        allergies: [{ name: 'Banana', current: true, lastUpdated: new Date().toISOString() }],
      };

      render(<KnownAllergiesProviderColumn />, { wrapper: createWrapper() });

      expect(
        screen.getAllByTestId(dataTestIds.allergies.knownAllergiesListItem)[0].querySelector('p')
      ).toHaveTextContent('Banana');
    });

    it('should show empty field when no allergy selected', () => {
      mockChartData = {};

      render(<KnownAllergiesProviderColumn />, { wrapper: createWrapper() });

      expect(() => screen.getAllByTestId(dataTestIds.allergies.knownAllergiesListItem)).toThrow(Error);
    });
  });

  describe('selecting allergy', () => {
    it('should call onSubmit with selected allergy', { timeout: 5000 }, async () => {
      const user = userEvent.setup();
      render(<KnownAllergiesProviderColumn />, { wrapper: createWrapper() });

      await user.click(screen.getByRole('combobox'));
      await user.type(screen.getByRole('combobox'), 'Bana');
      await waitFor(
        async () => {
          const dropdown = await screen.findByRole('presentation');
          const option = await within(dropdown).findAllByText(/Banana/);
          await user.click(option[0]);
        },
        { timeout: 1000 }
      );

      expect(mockChartDataArrayValueOnSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Banana' }));
    });

    it('should update local state with selected code', async () => {
      const user = userEvent.setup();
      render(<KnownAllergiesProviderColumn />, { wrapper: createWrapper() });

      await user.click(screen.getByRole('combobox'));
      await user.type(screen.getByRole('combobox'), 'Bana');
      await waitFor(
        async () => {
          const dropdown = await screen.findByRole('presentation');
          const option = await within(dropdown).findAllByText(/Banana/);
          await user.click(option[0]);
        },
        { timeout: 1000 }
      );

      expect(mockSetPartialChartData).toHaveBeenCalledWith(
        expect.objectContaining({
          allergies: expect.arrayContaining([expect.objectContaining({ name: 'Banana' })]),
        }),
        { invalidateQueries: false }
      );
    });

    it('should show error and rollback on save failure', { timeout: 5000 }, async () => {
      const user = userEvent.setup();
      mockChartData = {
        allergies: [],
      };

      render(<KnownAllergiesProviderColumn />, { wrapper: createWrapper() });

      // Simulate server error
      mockChartDataArrayValueOnSubmit.mockRejectedValueOnce(new Error('Server error'));

      await user.click(screen.getByRole('combobox'));
      await user.type(screen.getByRole('combobox'), 'Bana');
      await waitFor(
        async () => {
          const dropdown = await screen.findByRole('presentation');
          const option = await within(dropdown).findAllByText(/Banana/);
          await user.click(option[0]);
        },
        { timeout: 1000 }
      );

      expect(mockSetPartialChartData).toHaveBeenLastCalledWith({
        allergies: [],
      });
    });
  });

  describe('removing allergy', () => {
    it('should call deleteChartData when clearing', async () => {
      const user = userEvent.setup();
      mockChartData = {
        allergies: [
          { resourceId: 'server-id-123', name: 'Banana', current: true, lastUpdated: new Date().toISOString() },
        ],
      };

      render(<KnownAllergiesProviderColumn />, { wrapper: createWrapper() });

      const bananaListItem = screen.getAllByTestId(dataTestIds.allergies.knownAllergiesListItem)[0];
      const deleteButton = within(bananaListItem).getByTestId(dataTestIds.allergies.knownAllergiesListItemDeleteButton);
      await user.click(deleteButton);

      expect(mockDeleteMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          allergies: expect.arrayContaining([expect.objectContaining({ name: 'Banana' })]),
        }),
        expect.any(Object)
      );
    });

    it('should clear local state when deleting', async () => {
      const user = userEvent.setup();
      mockChartData = {
        allergies: [
          { resourceId: 'server-id-123', name: 'Banana', current: true, lastUpdated: new Date().toISOString() },
        ],
      };

      render(<KnownAllergiesProviderColumn />, { wrapper: createWrapper() });

      const bananaListItem = screen.getAllByTestId(dataTestIds.allergies.knownAllergiesListItem)[0];
      const deleteButton = within(bananaListItem).getByTestId(dataTestIds.allergies.knownAllergiesListItemDeleteButton);
      await user.click(deleteButton);

      expect(mockChartDataSetState).toHaveBeenCalledWith(expect.anything(), { invalidateQueries: false });
    });

    it('should show error and rollback on delete failure', async () => {
      const user = userEvent.setup();
      mockChartData = {
        allergies: [
          { resourceId: 'server-id-123', name: 'Banana', current: true, lastUpdated: new Date().toISOString() },
        ],
      };

      render(<KnownAllergiesProviderColumn />, { wrapper: createWrapper() });

      const bananaListItem = screen.getAllByTestId(dataTestIds.allergies.knownAllergiesListItem)[0];
      const deleteButton = within(bananaListItem).getByTestId(dataTestIds.allergies.knownAllergiesListItemDeleteButton);
      await user.click(deleteButton);

      // Simulate server error
      capturedDeleteCallbacks.onError?.();

      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('error'),
        expect.objectContaining({ variant: 'error' })
      );

      expect(mockChartDataSetState).toHaveBeenLastCalledWith(expect.anything());
    });
  });

  describe('disabled state', () => {
    it('should disable field while saving', () => {
      mockChartDataArrayValueIsLoadingThunk = () => true;

      render(<KnownAllergiesProviderColumn />, { wrapper: createWrapper() });

      expect(screen.getByRole('combobox')).toBeDisabled();
    });

    it('should disable field while deleting', () => {
      mockChartDataArrayValueIsLoadingThunk = () => true;

      render(<KnownAllergiesProviderColumn />, { wrapper: createWrapper() });

      expect(screen.getByRole('combobox')).toBeDisabled();
    });

    it('should enable field when not loading', () => {
      render(<KnownAllergiesProviderColumn />, { wrapper: createWrapper() });

      expect(screen.getByRole('combobox')).not.toBeDisabled();
    });
  });
});
