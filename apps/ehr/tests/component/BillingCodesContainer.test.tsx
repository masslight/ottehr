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
let mockChartData: {
  emCode?: { code: string; display: string; resourceId?: string };
  cptCodes?: Array<{ code: string; display: string; resourceId?: string }>;
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

let mockCptSearchOptions: Array<{ code: string; display: string }> = [];
let mockIcdSearchError: { code?: string } | null = null;

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetIcd10Search: vi.fn(() => ({
    isFetching: false,
    data: { codes: mockCptSearchOptions },
    error: mockIcdSearchError,
  })),
}));

vi.mock('src/shared/hooks/useDebounce', () => ({
  useDebounce: () => ({
    debounce: (fn: () => void) => fn(),
  }),
}));

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: any[]) => mockEnqueueSnackbar(...args),
}));

vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('utils')>();
  return {
    ...actual,
    APIErrorCode: { MISSING_NLM_API_KEY_ERROR: 'MISSING_NLM_API_KEY' },
    emCodeOptions: [
      { display: '99213 Established Patient - E/M Level 3', code: '99213' },
      { display: '99214 Established Patient - E/M Level 4', code: '99214' },
    ],
  };
});

vi.mock('src/constants/data-test-ids', () => ({
  dataTestIds: {
    assessmentCard: {
      emCodeDropdown: 'em-code-dropdown',
      cptCodeField: 'cpt-code-field',
    },
    billingContainer: {
      container: 'billing-container',
      deleteButton: 'em-delete-btn',
      cptCodeEntry: (code: string) => `cpt-entry-${code}`,
      deleteCptCodeButton: (code: string) => `cpt-delete-${code}`,
    },
  },
}));

// Mock child components
vi.mock('src/components/ActionsList', () => ({
  ActionsList: ({ data, renderItem, renderActions, getKey }: any) => (
    <div data-testid="actions-list">
      {data.map((item: any, index: number) => (
        <div key={getKey(item, index)} data-testid="actions-list-item">
          {renderItem(item)}
          {renderActions && renderActions(item)}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('src/components/AssessmentTitle', () => ({
  AssessmentTitle: ({ children }: { children: React.ReactNode }) => <h3 data-testid="assessment-title">{children}</h3>,
}));

vi.mock('src/components/DeleteIconButton', () => ({
  DeleteIconButton: ({ onClick, disabled, dataTestId }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid={dataTestId}>
      Delete
    </button>
  ),
}));

vi.mock('src/components/CompleteConfiguration', () => ({
  CompleteConfiguration: ({ handleSetup }: { handleSetup: () => void }) => (
    <div data-testid="complete-config">
      <button onClick={handleSetup}>Setup</button>
    </div>
  ),
}));

vi.mock('src/components/WithTooltip', () => ({
  TooltipWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CPT_TOOLTIP_PROPS: {},
}));

import { BillingCodesContainer } from '../../src/features/visits/shared/components/assessment-tab/BillingCodesContainer';
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

describe('BillingCodesContainer', () => {
  let mockSaveEMMutate: ReturnType<typeof vi.fn>;
  let mockSaveCPTMutate: ReturnType<typeof vi.fn>;
  let mockDeleteEMMutate: ReturnType<typeof vi.fn>;
  let mockDeleteCPTMutate: ReturnType<typeof vi.fn>;
  let capturedEMSaveCallbacks: { onSuccess?: () => void; onError?: () => void };
  let capturedCPTSaveCallbacks: { onSuccess?: () => void; onError?: () => void };
  let capturedCPTDeleteCallbacks: { onSuccess?: () => void; onError?: () => void };

  beforeEach(() => {
    vi.clearAllMocks();
    mockChartData = {};
    mockCptSearchOptions = [];
    mockIcdSearchError = null;
    capturedEMSaveCallbacks = {};
    capturedCPTSaveCallbacks = {};
    capturedCPTDeleteCallbacks = {};

    const createSaveMutate = (): ReturnType<typeof vi.fn> =>
      vi.fn((data, callbacks) => {
        if (data.emCode) {
          capturedEMSaveCallbacks = callbacks || {};
        } else if (data.cptCodes) {
          capturedCPTSaveCallbacks = callbacks || {};
        }
      });

    const createDeleteMutate = (): ReturnType<typeof vi.fn> =>
      vi.fn((data, callbacks) => {
        capturedCPTDeleteCallbacks = callbacks || {};
      });

    mockSaveEMMutate = createSaveMutate();
    mockSaveCPTMutate = createSaveMutate();
    mockDeleteEMMutate = createDeleteMutate();
    mockDeleteCPTMutate = createDeleteMutate();

    vi.mocked(useSaveChartData)
      .mockReturnValueOnce({ mutate: mockSaveEMMutate, isPending: false } as any)
      .mockReturnValueOnce({ mutate: mockSaveCPTMutate, isPending: false } as any)
      .mockReturnValue({ mutate: mockSaveCPTMutate, isPending: false } as any);

    vi.mocked(useDeleteChartData)
      .mockReturnValueOnce({ mutate: mockDeleteEMMutate, isPending: false } as any)
      .mockReturnValueOnce({ mutate: mockDeleteCPTMutate, isPending: false } as any)
      .mockReturnValue({ mutate: mockDeleteCPTMutate, isPending: false } as any);

    vi.mocked(useGetAppointmentAccessibility).mockReturnValue({
      isAppointmentReadOnly: false,
    } as any);
  });

  describe('rendering', () => {
    it('should render billing title', () => {
      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      expect(screen.getByText('Billing')).toBeInTheDocument();
    });

    it('should render E&M code dropdown', () => {
      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      expect(screen.getByLabelText(/E&M code/i)).toBeInTheDocument();
    });

    it('should render CPT codes search field', () => {
      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      expect(screen.getByLabelText(/Additional CPT codes/i)).toBeInTheDocument();
    });

    it('should display existing E&M code', () => {
      mockChartData = {
        emCode: { code: '99213', display: '99213 Established Patient - E/M Level 3', resourceId: 'em-1' },
      };

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      expect(screen.getAllByText('E&M code')[0]).toBeInTheDocument();
      expect(screen.getByText(/99213 Established Patient - E\/M Level 3/)).toBeInTheDocument();
    });

    it('should display existing CPT codes list', () => {
      mockChartData = {
        cptCodes: [
          { code: '90471', display: 'Immunization admin', resourceId: 'cpt-1' },
          { code: '90472', display: 'Immunization admin each addl', resourceId: 'cpt-2' },
        ],
      };

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      expect(screen.getAllByText('Additional CPT codes')[0]).toBeInTheDocument();
      expect(screen.getByText(/90471/)).toBeInTheDocument();
      expect(screen.getByText(/90472/)).toBeInTheDocument();
    });

    it('should show configuration prompt when NLM API key missing', () => {
      mockIcdSearchError = { code: 'MISSING_NLM_API_KEY' };

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      expect(screen.getByTestId('complete-config')).toBeInTheDocument();
    });
  });

  describe('E&M code operations', () => {
    it('should save E&M code when selected', async () => {
      const user = userEvent.setup();
      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      const emDropdown = screen.getByLabelText(/E&M code/i);
      await user.click(emDropdown);
      await user.click(await screen.findByText(/99213/));

      expect(mockSaveEMMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          emCode: expect.objectContaining({ code: '99213' }),
        }),
        expect.any(Object)
      );
    });

    it('should update local state when E&M code selected', async () => {
      const user = userEvent.setup();
      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      const emDropdown = screen.getByLabelText(/E&M code/i);
      await user.click(emDropdown);
      await user.click(await screen.findByText(/99213/));

      expect(mockSetPartialChartData).toHaveBeenCalledWith(
        expect.objectContaining({
          emCode: expect.objectContaining({ code: '99213' }),
        }),
        { invalidateQueries: false }
      );
    });

    it('should delete E&M code when cleared', async () => {
      const user = userEvent.setup();
      mockChartData = {
        emCode: { code: '99213', display: '99213 Established Patient - E/M Level 3', resourceId: 'em-1' },
      };

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      const deleteBtn = screen.getByTestId('em-delete-btn');
      await user.click(deleteBtn);

      expect(mockDeleteEMMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          emCode: expect.objectContaining({ code: '99213' }),
        }),
        expect.any(Object)
      );
    });

    it('should show error on E&M save failure', async () => {
      const user = userEvent.setup();
      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      const emDropdown = screen.getByLabelText(/E&M code/i);
      await user.click(emDropdown);
      await user.click(await screen.findByText(/99213/));

      capturedEMSaveCallbacks.onError?.();

      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('E&M code'),
        expect.objectContaining({ variant: 'error' })
      );
    });
  });

  describe('CPT code operations', () => {
    beforeEach(() => {
      mockCptSearchOptions = [
        { code: '90471', display: 'Immunization administration' },
        { code: '90472', display: 'Immunization admin each additional' },
      ];
    });

    it('should save CPT code when selected from search', async () => {
      const user = userEvent.setup();
      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      const cptField = screen.getByLabelText(/Additional CPT codes/i);
      await user.click(cptField);
      await user.click(await screen.findByText(/90471/));

      expect(mockSaveCPTMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          cptCodes: expect.arrayContaining([expect.objectContaining({ code: '90471' })]),
        }),
        expect.any(Object)
      );
    });

    it('should add CPT code to local state', async () => {
      const user = userEvent.setup();
      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      const cptField = screen.getByLabelText(/Additional CPT codes/i);
      await user.click(cptField);
      await user.click(await screen.findByText(/90471/));

      expect(mockSetPartialChartData).toHaveBeenCalledWith(
        {
          cptCodes: expect.arrayContaining([expect.objectContaining({ code: '90471' })]),
        },
        { invalidateQueries: false }
      );
    });

    it('should append to existing CPT codes', async () => {
      const user = userEvent.setup();
      mockChartData = {
        cptCodes: [{ code: '90471', display: 'Existing code', resourceId: 'cpt-1' }],
      };

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      const cptField = screen.getByLabelText(/Additional CPT codes/i);
      await user.click(cptField);
      await user.click(await screen.findByText(/90472/));

      expect(mockSetPartialChartData).toHaveBeenCalledWith(
        {
          cptCodes: expect.arrayContaining([
            expect.objectContaining({ code: '90471' }),
            expect.objectContaining({ code: '90472' }),
          ]),
        },
        { invalidateQueries: false }
      );
    });

    it('should delete CPT code', async () => {
      const user = userEvent.setup();
      mockChartData = {
        cptCodes: [{ code: '90471', display: 'Immunization', resourceId: 'cpt-1' }],
      };

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      const deleteBtn = screen.getByTestId('cpt-delete-90471');
      await user.click(deleteBtn);

      expect(mockDeleteCPTMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          cptCodes: expect.arrayContaining([expect.objectContaining({ code: '90471' })]),
        }),
        expect.any(Object)
      );
    });

    it('should remove CPT code from local state on delete', async () => {
      const user = userEvent.setup();
      mockChartData = {
        cptCodes: [
          { code: '90471', display: 'Immunization', resourceId: 'cpt-1' },
          { code: '90472', display: 'Additional', resourceId: 'cpt-2' },
        ],
      };

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      const deleteBtn = screen.getByTestId('cpt-delete-90471');
      await user.click(deleteBtn);

      expect(mockSetPartialChartData).toHaveBeenCalledWith(
        {
          cptCodes: expect.not.arrayContaining([expect.objectContaining({ code: '90471' })]),
        },
        { invalidateQueries: false }
      );
    });

    it('should show error on CPT add failure', async () => {
      const user = userEvent.setup();
      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      const cptField = screen.getByLabelText(/Additional CPT codes/i);
      await user.click(cptField);
      await user.click(await screen.findByText(/90471/));

      capturedCPTSaveCallbacks.onError?.();

      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('CPT code'),
        expect.objectContaining({ variant: 'error' })
      );
    });

    it('should show error on CPT delete failure', async () => {
      const user = userEvent.setup();
      mockChartData = {
        cptCodes: [{ code: '90471', display: 'Immunization', resourceId: 'cpt-1' }],
      };

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      const deleteBtn = screen.getByTestId('cpt-delete-90471');
      await user.click(deleteBtn);

      capturedCPTDeleteCallbacks.onError?.();

      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('CPT code'),
        expect.objectContaining({ variant: 'error' })
      );
    });

    it('should show placeholder when no search results', () => {
      mockCptSearchOptions = [];

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      expect(screen.getByPlaceholderText(/Search CPT code/i)).toBeInTheDocument();
    });
  });

  describe('read-only mode', () => {
    beforeEach(() => {
      vi.mocked(useGetAppointmentAccessibility).mockReturnValue({
        isAppointmentReadOnly: true,
      } as any);
    });

    it('should hide E&M dropdown in read-only mode', () => {
      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      expect(screen.queryByLabelText(/E&M code/i)).not.toBeInTheDocument();
    });

    it('should hide CPT search field in read-only mode', () => {
      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      expect(screen.queryByLabelText(/Additional CPT codes/i)).not.toBeInTheDocument();
    });

    it('should hide delete buttons in read-only mode', () => {
      mockChartData = {
        emCode: { code: '99213', display: '99213 Established Patient - E/M Level 3', resourceId: 'em-1' },
        cptCodes: [{ code: '90471', display: 'Immunization', resourceId: 'cpt-1' }],
      };

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      expect(screen.queryByTestId('em-delete-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cpt-delete-90471')).not.toBeInTheDocument();
    });

    it('should still display existing codes in read-only mode', () => {
      mockChartData = {
        emCode: { code: '99213', display: '99213 Established Patient - E/M Level 3', resourceId: 'em-1' },
        cptCodes: [{ code: '90471', display: 'Immunization', resourceId: 'cpt-1' }],
      };

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      expect(screen.getByText(/99213 Established Patient/)).toBeInTheDocument();
      expect(screen.getByText(/90471/)).toBeInTheDocument();
    });
  });

  describe('disabled states', () => {
    it('should disable E&M dropdown while saving E&M', () => {
      // Override mocks for this specific test
      vi.mocked(useSaveChartData)
        .mockReset()
        .mockReturnValueOnce({ mutate: mockSaveEMMutate, isPending: true } as any)
        .mockReturnValueOnce({ mutate: mockSaveCPTMutate, isPending: false } as any);

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      expect(screen.getByLabelText(/E&M code/i)).toBeDisabled();
    });

    it('should disable E&M dropdown while deleting E&M', () => {
      // Override mocks for this specific test
      vi.mocked(useDeleteChartData)
        .mockReset()
        .mockReturnValueOnce({ mutate: mockDeleteEMMutate, isPending: true } as any)
        .mockReturnValueOnce({ mutate: mockDeleteCPTMutate, isPending: false } as any);

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      expect(screen.getByLabelText(/E&M code/i)).toBeDisabled();
    });

    it('should disable CPT field while saving CPT', () => {
      // Override mocks for this specific test
      vi.mocked(useSaveChartData)
        .mockReset()
        .mockReturnValueOnce({ mutate: mockSaveEMMutate, isPending: false } as any)
        .mockReturnValueOnce({ mutate: mockSaveCPTMutate, isPending: true } as any);

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      expect(screen.getByLabelText(/Additional CPT codes/i)).toBeDisabled();
    });

    it('should disable delete button for CPT without resourceId', () => {
      mockChartData = {
        cptCodes: [{ code: '90471', display: 'Immunization' }], // no resourceId
      };

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      expect(screen.getByTestId('cpt-delete-90471')).toBeDisabled();
    });

    it('should disable E&M dropdown when emCode exists but has no resourceId', () => {
      mockChartData = {
        emCode: { code: '99213', display: '99213 Established Patient - E/M Level 3' }, // no resourceId - pending save
      };

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      expect(screen.getByLabelText(/E&M code/i)).toBeDisabled();
    });
  });

  describe('configuration setup', () => {
    it('should open documentation when setup clicked', async () => {
      const user = userEvent.setup();
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      mockIcdSearchError = { code: 'MISSING_NLM_API_KEY' };

      render(<BillingCodesContainer />, { wrapper: createWrapper() });

      await user.click(screen.getByText('Setup'));

      expect(windowOpenSpy).toHaveBeenCalledWith('https://docs.oystehr.com/ottehr/setup/terminology/', '_blank');

      windowOpenSpy.mockRestore();
    });
  });
});
