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
let mockChartData: {
  diagnosis?: Array<{
    code: string;
    display: string;
    isPrimary: boolean;
    resourceId?: string;
    addedViaLabOrder?: boolean;
  }>;
} = {};

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useChartData: () => ({
    chartData: mockChartData,
    setPartialChartData: mockSetPartialChartData,
  }),
  useSaveChartData: vi.fn(),
  useDeleteChartData: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: vi.fn(() => ({ isAppointmentReadOnly: false })),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useICD10SearchNew: vi.fn(() => ({
    error: null,
    isLoading: false,
  })),
}));

vi.mock('../../src/features/visits/shared/stores/contexts/useAppFlags', () => ({
  useAppFlags: vi.fn(() => ({ isInPerson: false })),
}));

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: any[]) => mockEnqueueSnackbar(...args),
}));

vi.mock('utils', () => ({
  APIErrorCode: { MISSING_NLM_API_KEY_ERROR: 'MISSING_NLM_API_KEY' },
  DIAGNOSIS_MAKE_PRIMARY_BUTTON: 'Make primary',
}));

vi.mock('src/constants/data-test-ids', () => ({
  dataTestIds: {
    diagnosisContainer: {
      allDiagnosesContainer: 'diagnoses-container',
      primaryDiagnosis: 'primary-diagnosis',
      secondaryDiagnosis: 'secondary-diagnosis',
      primaryDiagnosisDeleteButton: 'primary-delete-btn',
      secondaryDiagnosisDeleteButton: 'secondary-delete-btn',
      makePrimaryButton: 'make-primary-btn',
    },
  },
}));

// Mock DiagnosesField as simple component
vi.mock('../../src/features/visits/shared/components/assessment-tab/DiagnosesField', () => ({
  DiagnosesField: ({
    onChange,
    disabled,
  }: {
    onChange: (data: { code: string; display: string }) => void;
    disabled: boolean;
  }) => (
    <button
      data-testid="add-diagnosis-btn"
      disabled={disabled}
      onClick={() => onChange({ code: 'J00', display: 'Acute nasopharyngitis' })}
    >
      Add Diagnosis
    </button>
  ),
}));

import { DiagnosesContainer } from '../../src/features/visits/shared/components/assessment-tab/DiagnosesContainer';
import { useGetAppointmentAccessibility } from '../../src/features/visits/shared/hooks/useGetAppointmentAccessibility';
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

describe('DiagnosesContainer', () => {
  let mockSaveMutate: ReturnType<typeof vi.fn>;
  let mockDeleteMutate: ReturnType<typeof vi.fn>;
  let capturedSaveCallbacks: { onSuccess?: () => void; onError?: () => void };
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
      return Promise.resolve();
    });

    vi.mocked(useSaveChartData).mockReturnValue({
      mutate: mockSaveMutate,
      isPending: false,
    } as any);

    vi.mocked(useDeleteChartData).mockReturnValue({
      mutateAsync: mockDeleteMutate,
      isPending: false,
    } as any);

    vi.mocked(useGetAppointmentAccessibility).mockReturnValue({
      isAppointmentReadOnly: false,
    } as any);
  });

  describe('rendering', () => {
    it('should render diagnoses title', () => {
      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      expect(screen.getByText('Diagnoses')).toBeInTheDocument();
    });

    it('should show "Dx" title in person mode', async () => {
      const { useAppFlags } = await import('../../src/features/visits/shared/stores/contexts/useAppFlags');
      vi.mocked(useAppFlags).mockReturnValue({ isInPerson: true } as any);

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      expect(screen.getByText('Dx')).toBeInTheDocument();
    });

    it('should display primary diagnosis', () => {
      mockChartData = {
        diagnosis: [{ code: 'J00', display: 'Common cold', isPrimary: true, resourceId: 'id-1' }],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      expect(screen.getByText('Primary *')).toBeInTheDocument();
      expect(screen.getByText(/Common cold/)).toBeInTheDocument();
      expect(screen.getByText(/J00/)).toBeInTheDocument();
    });

    it('should display secondary diagnoses', () => {
      mockChartData = {
        diagnosis: [
          { code: 'J00', display: 'Common cold', isPrimary: true, resourceId: 'id-1' },
          { code: 'R50.9', display: 'Fever', isPrimary: false, resourceId: 'id-2' },
          { code: 'R05', display: 'Cough', isPrimary: false, resourceId: 'id-3' },
        ],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      expect(screen.getByText('Secondary (optional)')).toBeInTheDocument();
      expect(screen.getByText(/Fever/)).toBeInTheDocument();
      expect(screen.getByText(/Cough/)).toBeInTheDocument();
    });

    it('should show "Not provided" when read-only and no diagnoses', () => {
      vi.mocked(useGetAppointmentAccessibility).mockReturnValue({
        isAppointmentReadOnly: true,
      } as any);
      mockChartData = { diagnosis: [] };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      expect(screen.getByText('Not provided')).toBeInTheDocument();
    });

    it('should show lab order indicator for diagnoses added via lab order', () => {
      mockChartData = {
        diagnosis: [
          {
            code: 'J00',
            display: 'Common cold',
            isPrimary: true,
            resourceId: 'id-1',
            addedViaLabOrder: true,
          },
        ],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      // Should have info icon for lab order
      expect(screen.getByTestId('InfoOutlinedIcon')).toBeInTheDocument();
    });
  });

  describe('adding diagnosis', () => {
    it('should call saveChartData when adding diagnosis', async () => {
      const user = userEvent.setup();
      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      await user.click(screen.getByTestId('add-diagnosis-btn'));

      expect(mockSaveMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          diagnosis: expect.arrayContaining([expect.objectContaining({ code: 'J00' })]),
        }),
        expect.any(Object)
      );
    });

    it('should mark first diagnosis as primary', async () => {
      const user = userEvent.setup();
      mockChartData = { diagnosis: [] };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      await user.click(screen.getByTestId('add-diagnosis-btn'));

      expect(mockSaveMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          diagnosis: expect.arrayContaining([expect.objectContaining({ isPrimary: true })]),
        }),
        expect.any(Object)
      );
    });

    it('should mark subsequent diagnoses as secondary', async () => {
      const user = userEvent.setup();
      mockChartData = {
        diagnosis: [{ code: 'E11', display: 'Diabetes', isPrimary: true, resourceId: 'id-1' }],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      await user.click(screen.getByTestId('add-diagnosis-btn'));

      expect(mockSaveMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          diagnosis: expect.arrayContaining([expect.objectContaining({ isPrimary: false })]),
        }),
        expect.any(Object)
      );
    });

    it('should update local state on add', async () => {
      const user = userEvent.setup();
      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      await user.click(screen.getByTestId('add-diagnosis-btn'));

      expect(mockSetPartialChartData).toHaveBeenCalledWith(
        {
          diagnosis: expect.arrayContaining([expect.objectContaining({ code: 'J00' })]),
        },
        { invalidateQueries: false }
      );
    });

    it('should show error and rollback on add failure', async () => {
      const user = userEvent.setup();
      mockChartData = { diagnosis: [] };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      await user.click(screen.getByTestId('add-diagnosis-btn'));

      mockSetPartialChartData.mockClear();
      capturedSaveCallbacks.onError?.();

      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('error'),
        expect.objectContaining({ variant: 'error' })
      );

      expect(mockSetPartialChartData).toHaveBeenCalledWith({
        diagnosis: [],
      });
    });
  });

  describe('deleting diagnosis', () => {
    it('should call deleteChartData when deleting', async () => {
      const user = userEvent.setup();
      mockChartData = {
        diagnosis: [{ code: 'J00', display: 'Common cold', isPrimary: true, resourceId: 'id-1' }],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      const deleteButton = screen.getByTestId('primary-delete-btn');
      await user.click(deleteButton);

      expect(mockDeleteMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          diagnosis: expect.arrayContaining([expect.objectContaining({ code: 'J00' })]),
        }),
        expect.any(Object)
      );
    });

    it('should promote secondary to primary when primary is deleted', async () => {
      const user = userEvent.setup();
      mockChartData = {
        diagnosis: [
          { code: 'J00', display: 'Common cold', isPrimary: true, resourceId: 'id-1' },
          { code: 'R50.9', display: 'Fever', isPrimary: false, resourceId: 'id-2' },
        ],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      const deleteButton = screen.getByTestId('primary-delete-btn');
      await user.click(deleteButton);

      // Should call save to promote secondary
      expect(mockSaveMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          diagnosis: expect.arrayContaining([expect.objectContaining({ code: 'R50.9', isPrimary: true })]),
        }),
        expect.any(Object)
      );
    });

    it('should not promote W-codes to primary', async () => {
      const user = userEvent.setup();
      mockChartData = {
        diagnosis: [
          { code: 'J00', display: 'Common cold', isPrimary: true, resourceId: 'id-1' },
          { code: 'W01', display: 'Fall', isPrimary: false, resourceId: 'id-2' },
          { code: 'R50.9', display: 'Fever', isPrimary: false, resourceId: 'id-3' },
        ],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      const deleteButton = screen.getByTestId('primary-delete-btn');
      await user.click(deleteButton);

      // Should promote R50.9, not W01
      expect(mockSaveMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          diagnosis: expect.arrayContaining([expect.objectContaining({ code: 'R50.9', isPrimary: true })]),
        }),
        expect.any(Object)
      );
    });

    it('should show error on delete failure', async () => {
      const user = userEvent.setup();
      mockChartData = {
        diagnosis: [{ code: 'J00', display: 'Common cold', isPrimary: true, resourceId: 'id-1' }],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      const deleteButton = screen.getByTestId('primary-delete-btn');
      await user.click(deleteButton);

      capturedDeleteCallbacks.onError?.();

      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('error'),
        expect.objectContaining({ variant: 'error' })
      );
    });
  });

  describe('make primary', () => {
    it('should show "Make primary" button for secondary diagnoses', () => {
      mockChartData = {
        diagnosis: [
          { code: 'J00', display: 'Common cold', isPrimary: true, resourceId: 'id-1' },
          { code: 'R50.9', display: 'Fever', isPrimary: false, resourceId: 'id-2' },
        ],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      expect(screen.getByText('Make primary')).toBeInTheDocument();
    });

    it('should not show "Make primary" for W-codes', () => {
      mockChartData = {
        diagnosis: [
          { code: 'J00', display: 'Common cold', isPrimary: true, resourceId: 'id-1' },
          { code: 'W01', display: 'Fall', isPrimary: false, resourceId: 'id-2' },
        ],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      expect(screen.queryByText('Make primary')).not.toBeInTheDocument();
    });

    it('should call saveChartData when making primary', async () => {
      const user = userEvent.setup();
      mockChartData = {
        diagnosis: [
          { code: 'J00', display: 'Common cold', isPrimary: true, resourceId: 'id-1' },
          { code: 'R50.9', display: 'Fever', isPrimary: false, resourceId: 'id-2' },
        ],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      await user.click(screen.getByText('Make primary'));

      expect(mockSaveMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          diagnosis: expect.arrayContaining([
            expect.objectContaining({ code: 'R50.9', isPrimary: true }),
            expect.objectContaining({ code: 'J00', isPrimary: false }),
          ]),
        }),
        expect.any(Object)
      );
    });

    it('should update local state when making primary', async () => {
      const user = userEvent.setup();
      mockChartData = {
        diagnosis: [
          { code: 'J00', display: 'Common cold', isPrimary: true, resourceId: 'id-1' },
          { code: 'R50.9', display: 'Fever', isPrimary: false, resourceId: 'id-2' },
        ],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      await user.click(screen.getByText('Make primary'));

      expect(mockSetPartialChartData).toHaveBeenCalledWith(
        {
          diagnosis: expect.arrayContaining([
            expect.objectContaining({ code: 'R50.9', isPrimary: true }),
            expect.objectContaining({ code: 'J00', isPrimary: false }),
          ]),
        },
        { invalidateQueries: false }
      );
    });

    it('should show error and rollback on make primary failure', async () => {
      const user = userEvent.setup();
      const originalDiagnoses = [
        { code: 'J00', display: 'Common cold', isPrimary: true, resourceId: 'id-1' },
        { code: 'R50.9', display: 'Fever', isPrimary: false, resourceId: 'id-2' },
      ];
      mockChartData = { diagnosis: originalDiagnoses };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      await user.click(screen.getByText('Make primary'));

      mockSetPartialChartData.mockClear();
      capturedSaveCallbacks.onError?.();

      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('error'),
        expect.objectContaining({ variant: 'error' })
      );

      expect(mockSetPartialChartData).toHaveBeenCalledWith({
        diagnosis: originalDiagnoses,
      });
    });
  });

  describe('read-only mode', () => {
    beforeEach(() => {
      vi.mocked(useGetAppointmentAccessibility).mockReturnValue({
        isAppointmentReadOnly: true,
      } as any);
    });

    it('should hide add diagnosis field', () => {
      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      expect(screen.queryByTestId('add-diagnosis-btn')).not.toBeInTheDocument();
    });

    it('should hide delete buttons', () => {
      mockChartData = {
        diagnosis: [{ code: 'J00', display: 'Common cold', isPrimary: true, resourceId: 'id-1' }],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      expect(screen.queryByTestId('primary-delete-btn')).not.toBeInTheDocument();
    });

    it('should hide make primary buttons', () => {
      mockChartData = {
        diagnosis: [
          { code: 'J00', display: 'Common cold', isPrimary: true, resourceId: 'id-1' },
          { code: 'R50.9', display: 'Fever', isPrimary: false, resourceId: 'id-2' },
        ],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      expect(screen.queryByText('Make primary')).not.toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('should disable buttons while saving', () => {
      vi.mocked(useSaveChartData).mockReturnValue({
        mutate: mockSaveMutate,
        isPending: true,
      } as any);

      mockChartData = {
        diagnosis: [{ code: 'J00', display: 'Common cold', isPrimary: true, resourceId: 'id-1' }],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      expect(screen.getByTestId('add-diagnosis-btn')).toBeDisabled();
      expect(screen.getByTestId('primary-delete-btn')).toBeDisabled();
    });

    it('should disable buttons while deleting', () => {
      vi.mocked(useDeleteChartData).mockReturnValue({
        mutateAsync: mockDeleteMutate,
        isPending: true,
      } as any);

      mockChartData = {
        diagnosis: [{ code: 'J00', display: 'Common cold', isPrimary: true, resourceId: 'id-1' }],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      expect(screen.getByTestId('primary-delete-btn')).toBeDisabled();
    });

    it('should disable delete for items without resourceId', () => {
      mockChartData = {
        diagnosis: [
          { code: 'J00', display: 'Common cold', isPrimary: true }, // no resourceId
        ],
      };

      render(<DiagnosesContainer />, { wrapper: createWrapper() });

      expect(screen.getByTestId('primary-delete-btn')).toBeDisabled();
    });
  });
});
