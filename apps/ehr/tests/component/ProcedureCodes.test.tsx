import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChargeItemDefinition } from 'fhir/r4b';
import { ReactNode } from 'react';
import { CPT_CODE_SYSTEM, CPT_MODIFIER_EXTENSION_URL } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: unknown[]) => mockEnqueueSnackbar(...args),
}));

const mockAddCode = vi.fn();
const mockUpdateCode = vi.fn();
const mockDeleteCode = vi.fn();
const mockBulkAdd = vi.fn();

vi.mock('src/rcm/state/fee-schedules/fee-schedule.queries', () => ({
  useAddProcedureCodeMutation: () => ({ mutateAsync: mockAddCode, isPending: false }),
  useUpdateProcedureCodeMutation: () => ({ mutateAsync: mockUpdateCode, isPending: false }),
  useDeleteProcedureCodeMutation: () => ({ mutateAsync: mockDeleteCode, isPending: false }),
  useBulkAddProcedureCodesMutation: () => ({ mutateAsync: mockBulkAdd, isPending: false }),
  useGetVersionHistoryQuery: () => ({
    data: undefined,
    isFetching: false,
    error: null,
  }),
}));

vi.mock('src/rcm/state/charge-masters/charge-master.queries', () => ({
  useCmAddProcedureCodeMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCmUpdateProcedureCodeMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCmDeleteProcedureCodeMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCmBulkAddProcedureCodesMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

let mockCptSearchOptions: Array<{ code: string; display: string }> = [];
vi.mock('src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetCPTHCPCSSearch: vi.fn(() => ({
    isFetching: false,
    data: { codes: mockCptSearchOptions },
    error: null,
  })),
}));

vi.mock('src/shared/hooks/useDebounce', () => ({
  useDebounce: () => ({
    debounce: (fn: () => void) => fn(),
  }),
}));

// Mock react-window to render rows directly (avoids virtualization issues in tests)
vi.mock('react-window', () => ({
  FixedSizeList: ({ children: Row, itemCount }: any) => {
    const rows = [];
    for (let i = 0; i < itemCount; i++) {
      rows.push(<Row key={i} index={i} style={{}} />);
    }
    return <div data-testid="virtual-list">{rows}</div>;
  },
}));

import ProcedureCodes from '../../src/features/visits/telemed/components/admin/fee-schedule/ProcedureCodes';

// jsdom does not implement File.text(), so we polyfill it for tests
if (!File.prototype.text) {
  File.prototype.text = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function makeFeeSchedule(
  codes: Array<{ code: string; modifier?: string; amount: number; description?: string }>
): ChargeItemDefinition {
  return {
    resourceType: 'ChargeItemDefinition',
    id: 'fs-test-1',
    status: 'active',
    url: 'http://example.com/fee-schedule',
    propertyGroup: codes.map((entry) => ({
      priceComponent: [
        {
          type: 'base' as const,
          code: {
            coding: [
              {
                system: CPT_CODE_SYSTEM,
                code: entry.code,
                ...(entry.description ? { display: entry.description } : {}),
              },
            ],
          },
          amount: { value: entry.amount, currency: 'USD' },
          ...(entry.modifier ? { extension: [{ url: CPT_MODIFIER_EXTENSION_URL, valueCode: entry.modifier }] } : {}),
        },
      ],
    })),
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function uploadCsvFile(csvContent: string): void {
  const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  // In jsdom, we need to define the files property before firing the event
  Object.defineProperty(fileInput, 'files', {
    value: [file],
    writable: false,
    configurable: true,
  });
  fireEvent.change(fileInput);
}

// ============================================================================
// TESTS
// ============================================================================

describe('ProcedureCodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCptSearchOptions = [];
  });

  describe('renders correctly', () => {
    it('shows empty state when no codes exist', () => {
      render(<ProcedureCodes feeSchedule={makeFeeSchedule([])} isFetching={false} />, { wrapper: createWrapper() });
      expect(screen.getByText(/no procedure codes yet/i)).toBeInTheDocument();
    });

    it('shows total count', () => {
      render(
        <ProcedureCodes
          feeSchedule={makeFeeSchedule([
            { code: '99213', amount: 100 },
            { code: '99214', amount: 200 },
          ])}
          isFetching={false}
        />,
        { wrapper: createWrapper() }
      );
      expect(screen.getByText('(2 total)')).toBeInTheDocument();
    });

    it('shows skeleton when fetching', () => {
      const { container } = render(<ProcedureCodes feeSchedule={undefined} isFetching={true} />, {
        wrapper: createWrapper(),
      });
      expect(container.querySelector('.MuiSkeleton-root')).toBeInTheDocument();
    });

    it('renders nothing when feeSchedule is undefined and not fetching', () => {
      const { container } = render(<ProcedureCodes feeSchedule={undefined} isFetching={false} />, {
        wrapper: createWrapper(),
      });
      expect(container.innerHTML).toBe('');
    });
  });

  describe('duplicate prevention on add', () => {
    it('shows error snackbar when adding a duplicate code', async () => {
      const user = userEvent.setup();
      render(<ProcedureCodes feeSchedule={makeFeeSchedule([{ code: '99213', amount: 100 }])} isFetching={false} />, {
        wrapper: createWrapper(),
      });

      // Open add dialog
      await user.click(screen.getByText('Add procedure code'));

      // Type a code via the autocomplete freeSolo input
      const codeInput = screen.getByLabelText(/code \(cpt\/hcpcs\)/i);
      await user.type(codeInput, '99213');
      // Press enter to select the freeSolo value
      await user.keyboard('{Enter}');

      // Fill amount
      const amountInput = screen.getByLabelText(/amount/i);
      await user.clear(amountInput);
      await user.type(amountInput, '200');

      // Click Add
      const addButton = screen.getByRole('button', { name: 'Add' });
      await user.click(addButton);

      // Should show duplicate error
      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
          expect.stringContaining('already exists'),
          expect.objectContaining({ variant: 'error' })
        );
      });

      // Should NOT call the add mutation
      expect(mockAddCode).not.toHaveBeenCalled();
    });

    it('shows error for duplicate code+modifier', async () => {
      const user = userEvent.setup();
      render(
        <ProcedureCodes
          feeSchedule={makeFeeSchedule([{ code: '99213', modifier: '25', amount: 100 }])}
          isFetching={false}
        />,
        { wrapper: createWrapper() }
      );

      await user.click(screen.getByText('Add procedure code'));

      const codeInput = screen.getByLabelText(/code \(cpt\/hcpcs\)/i);
      await user.type(codeInput, '99213');
      await user.keyboard('{Enter}');

      const modifierInput = screen.getByLabelText(/modifier/i);
      await user.type(modifierInput, '25');

      const amountInput = screen.getByLabelText(/amount/i);
      await user.clear(amountInput);
      await user.type(amountInput, '200');

      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
          expect.stringContaining('modifier 25'),
          expect.objectContaining({ variant: 'error' })
        );
      });
      expect(mockAddCode).not.toHaveBeenCalled();
    });

    it('allows same code with different modifier', async () => {
      const user = userEvent.setup();
      mockAddCode.mockResolvedValue({});
      render(
        <ProcedureCodes
          feeSchedule={makeFeeSchedule([{ code: '99213', modifier: '25', amount: 100 }])}
          isFetching={false}
        />,
        { wrapper: createWrapper() }
      );

      await user.click(screen.getByText('Add procedure code'));

      const codeInput = screen.getByLabelText(/code \(cpt\/hcpcs\)/i);
      await user.type(codeInput, '99213');
      await user.keyboard('{Enter}');

      const modifierInput = screen.getByLabelText(/modifier/i);
      await user.type(modifierInput, '26');

      const amountInput = screen.getByLabelText(/amount/i);
      await user.clear(amountInput);
      await user.type(amountInput, '200');

      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => {
        expect(mockAddCode).toHaveBeenCalled();
      });
    });
  });

  describe('CSV upload and dedup', () => {
    it('deduplicates CSV rows by code+modifier (last wins)', async () => {
      render(<ProcedureCodes feeSchedule={makeFeeSchedule([])} isFetching={false} />, { wrapper: createWrapper() });

      const csvContent = [
        'Procedure Code,Modifier,Amount',
        '99213,,100.00',
        '99213,,200.00', // duplicate — should win
        '99214,,150.00',
      ].join('\n');

      uploadCsvFile(csvContent);

      // Should show dedup warning
      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
          expect.stringContaining('duplicate'),
          expect.objectContaining({ variant: 'warning' })
        );
      });

      // Upload preview should open with 2 codes (not 3)
      expect(screen.getByText('Upload Preview')).toBeInTheDocument();
      expect(screen.getByText(/Parsed/)).toBeInTheDocument();
    });

    it('opens upload preview dialog with delta stats', async () => {
      render(
        <ProcedureCodes
          feeSchedule={makeFeeSchedule([
            { code: '99213', amount: 100 },
            { code: '99214', amount: 200 },
          ])}
          isFetching={false}
        />,
        { wrapper: createWrapper() }
      );

      const csvContent = [
        'Procedure Code,Modifier,Amount',
        '99213,,150.00', // changed amount
        '99215,,300.00', // new code
      ].join('\n');

      uploadCsvFile(csvContent);

      await waitFor(() => {
        expect(screen.getByText('Upload Preview')).toBeInTheDocument();
      });

      // Should show delta stats
      const statsText = screen.getByText(/added.*changed.*removed.*unchanged/i);
      expect(statsText).toBeInTheDocument();
    });

    it('shows error for CSV without required columns', async () => {
      render(<ProcedureCodes feeSchedule={makeFeeSchedule([])} isFetching={false} />, { wrapper: createWrapper() });

      const csvContent = ['Name,Value', 'Test,123'].join('\n');
      uploadCsvFile(csvContent);

      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
          expect.stringContaining('Procedure Code'),
          expect.objectContaining({ variant: 'error' })
        );
      });
    });

    it('shows error for CSV with only header', async () => {
      render(<ProcedureCodes feeSchedule={makeFeeSchedule([])} isFetching={false} />, { wrapper: createWrapper() });

      const csvContent = 'Procedure Code,Modifier,Amount\n';
      uploadCsvFile(csvContent);

      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
          expect.stringContaining('header row'),
          expect.objectContaining({ variant: 'error' })
        );
      });
    });
  });

  describe('Import Delta', () => {
    it('calls bulkAdd with merged codes and replaceAll=true', async () => {
      const user = userEvent.setup();
      mockBulkAdd.mockResolvedValue({});
      render(
        <ProcedureCodes
          feeSchedule={makeFeeSchedule([
            { code: '99213', amount: 100 },
            { code: '99214', amount: 200 },
          ])}
          isFetching={false}
        />,
        { wrapper: createWrapper() }
      );

      const csvContent = [
        'Procedure Code,Modifier,Amount',
        '99213,,150.00', // changed from 100 -> 150
        '99215,,300.00', // added
      ].join('\n');

      uploadCsvFile(csvContent);

      await waitFor(() => {
        expect(screen.getByText('Import Delta')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Import Delta'));

      await waitFor(() => {
        expect(mockBulkAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            replaceAll: true,
          })
        );
      });

      // The merged codes should contain: 99213 with new amount, 99214 unchanged, 99215 added
      const callArgs = mockBulkAdd.mock.calls[0][0];
      expect(callArgs.codes).toHaveLength(3);
    });
  });

  describe('Replace All', () => {
    it('calls bulkAdd with all uploaded codes and replaceAll=true', async () => {
      const user = userEvent.setup();
      mockBulkAdd.mockResolvedValue({});
      render(<ProcedureCodes feeSchedule={makeFeeSchedule([{ code: '99213', amount: 100 }])} isFetching={false} />, {
        wrapper: createWrapper(),
      });

      const csvContent = ['Procedure Code,Amount', '99214,200.00', '99215,300.00'].join('\n');

      uploadCsvFile(csvContent);

      await waitFor(() => {
        expect(screen.getByText('Replace All')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Replace All'));

      await waitFor(() => {
        expect(mockBulkAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            codes: expect.arrayContaining([
              expect.objectContaining({ code: '99214' }),
              expect.objectContaining({ code: '99215' }),
            ]),
            replaceAll: true,
          })
        );
      });
    });
  });

  describe('search filtering', () => {
    it('filters codes by search text', async () => {
      const user = userEvent.setup();
      render(
        <ProcedureCodes
          feeSchedule={makeFeeSchedule([
            { code: '99213', description: 'Office visit', amount: 100 },
            { code: '99214', description: 'Extended visit', amount: 200 },
          ])}
          isFetching={false}
        />,
        { wrapper: createWrapper() }
      );

      const searchInput = screen.getByPlaceholderText(/search procedure codes/i);
      await user.type(searchInput, '99214');

      // Should show filtered count
      await waitFor(() => {
        expect(screen.getByText(/showing 1 of 2 codes/i)).toBeInTheDocument();
      });
    });
  });
});
