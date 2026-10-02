import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChargeItemDefinition } from 'fhir/r4b';
import { ReactNode } from 'react';
import { GetVersionHistoryResponse } from 'src/rcm/state/fee-schedules/fee-schedule.api';
import { CPT_CODE_SYSTEM, CPT_MODIFIER_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

interface QueryState<T> {
  data: T | undefined;
  isFetching: boolean;
  isError: boolean;
}

const idleQuery = <T,>(): QueryState<T> => ({ data: undefined, isFetching: false, isError: false });
let mockVersionHistory: QueryState<GetVersionHistoryResponse> = idleQuery();
let mockSelectedVersion: QueryState<ChargeItemDefinition> = idleQuery();
const mockUseGetVersionHistoryQuery = vi.fn((..._args: unknown[]) => mockVersionHistory);
const mockUseGetChargeItemDefinitionVersionQuery = vi.fn((..._args: unknown[]) => mockSelectedVersion);

vi.mock('src/rcm/state/fee-schedules/fee-schedule.queries', () => ({
  useAddProcedureCodeMutation: () => ({ mutateAsync: mockAddCode, isPending: false }),
  useUpdateProcedureCodeMutation: () => ({ mutateAsync: mockUpdateCode, isPending: false }),
  useDeleteProcedureCodeMutation: () => ({ mutateAsync: mockDeleteCode, isPending: false }),
  useBulkAddProcedureCodesMutation: () => ({ mutateAsync: mockBulkAdd, isPending: false }),
  useGetVersionHistoryQuery: (...args: unknown[]) => mockUseGetVersionHistoryQuery(...args),
  useGetChargeItemDefinitionVersionQuery: (...args: unknown[]) => mockUseGetChargeItemDefinitionVersionQuery(...args),
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

import ProcedureCodes from '../../src/features/visits/telemed/components/admin/charge-items/ProcedureCodes';

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
  codes: Array<{ code: string; modifier?: string; amount: number; description?: string }>,
  overrides: Partial<ChargeItemDefinition> = {}
): ChargeItemDefinition {
  return {
    resourceType: 'ChargeItemDefinition',
    id: 'fs-test-1',
    status: 'active',
    url: 'http://example.com/fee-schedule',
    ...overrides,
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
    mockVersionHistory = idleQuery();
    mockSelectedVersion = idleQuery();
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

  describe('Download CSV', () => {
    const CURRENT = { versionId: 'v3', timestamp: '2026-03-01T10:20:30.250Z' };
    const PREVIOUS = { versionId: 'v2', timestamp: '2026-01-02T03:04:06.010Z' };
    const OLDEST = { versionId: 'v1', timestamp: '2025-12-01T00:00:00.300Z' };
    const CURRENT_CODES = [
      { code: '99213', amount: 100 },
      { code: '99214', modifier: '25', amount: 200.5 },
    ];
    const previousVersion = makeFeeSchedule(
      [
        { code: '99213', amount: 80 },
        { code: '99215', amount: 300 },
        { code: '99214', modifier: '25', amount: 200.5 },
      ],
      { meta: { versionId: PREVIOUS.versionId, lastUpdated: '2026-01-02T03:04:05.678Z' } }
    );

    let blobs: Blob[];
    let downloadNames: string[];
    let anchorClick: ReturnType<typeof vi.spyOn>;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    beforeEach(() => {
      blobs = [];
      downloadNames = [];
      URL.createObjectURL = vi.fn((blob: Blob) => {
        blobs.push(blob);
        return 'blob:mock';
      });
      URL.revokeObjectURL = vi.fn();
      anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement
      ) {
        downloadNames.push(this.download);
      });
      mockVersionHistory = { data: { versions: [CURRENT, PREVIOUS, OLDEST] }, isFetching: false, isError: false };
    });

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      anchorClick.mockRestore();
    });

    const readBlob = (blob: Blob): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });

    const scheduleId = (mode: 'fee-schedule' | 'charge-master'): string =>
      mode === 'charge-master' ? 'cm-test-1' : 'fs-test-1';

    const renderSchedule = (mode: 'fee-schedule' | 'charge-master' = 'fee-schedule'): void => {
      render(
        <ProcedureCodes
          feeSchedule={makeFeeSchedule(CURRENT_CODES, {
            id: scheduleId(mode),
            title: 'BCBS 2026',
            meta: { versionId: CURRENT.versionId, lastUpdated: '2026-03-01T10:20:30.000Z' },
          })}
          isFetching={false}
          mode={mode}
        />,
        { wrapper: createWrapper() }
      );
    };

    type User = ReturnType<typeof userEvent.setup>;

    const openDeltaMode = async (user: User): Promise<void> => {
      await user.click(screen.getByRole('button', { name: 'Download CSV' }));
      await user.click(screen.getByRole('radio', { name: /^Delta since a previous version/ }));
    };

    const versionOptions = async (user: User): Promise<string[]> => {
      await user.click(screen.getByRole('combobox', { name: /compare against version/i }));
      const listbox = await screen.findByRole('listbox');
      return within(listbox)
        .getAllByRole('option')
        .map((option) => option.textContent ?? '');
    };

    const selectVersion = async (user: User, timestamp: string): Promise<void> => {
      await user.click(screen.getByRole('combobox', { name: /compare against version/i }));
      const listbox = await screen.findByRole('listbox');
      await user.click(within(listbox).getByRole('option', { name: new Date(timestamp).toLocaleString() }));
    };

    const downloadButton = (): HTMLElement => screen.getByRole('button', { name: 'Download' });

    it('downloads the latest version with the existing CSV schema and filename', async () => {
      const user = userEvent.setup();
      renderSchedule();

      await user.click(screen.getByRole('button', { name: 'Download CSV' }));
      await user.click(downloadButton());

      expect(downloadNames).toEqual(['BCBS_2026_procedure_codes.csv']);
      expect(await readBlob(blobs[0])).toBe(
        ['"Procedure Code","Modifier","Amount"', '"99213","","100.00"', '"99214","25","200.50"'].join('\n')
      );
      expect(mockUseGetChargeItemDefinitionVersionQuery).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        true
      );
    });

    it('requests the version list only while the dialog is open', async () => {
      const user = userEvent.setup();
      renderSchedule();

      expect(mockUseGetVersionHistoryQuery).toHaveBeenLastCalledWith('fs-test-1', false);
      await user.click(screen.getByRole('button', { name: 'Download CSV' }));
      expect(mockUseGetVersionHistoryQuery).toHaveBeenLastCalledWith('fs-test-1', true);
    });

    it('labels versions with their list timestamp and leaves out the version on screen', async () => {
      const user = userEvent.setup();
      renderSchedule();
      await openDeltaMode(user);

      expect(await versionOptions(user)).toEqual([
        new Date(PREVIOUS.timestamp).toLocaleString(),
        new Date(OLDEST.timestamp).toLocaleString(),
      ]);
    });

    it('offers only versions older than the one on screen when the list has a newer version', async () => {
      const newer = { versionId: 'v4', timestamp: '2026-04-01T00:00:00.000Z' };
      mockVersionHistory = { data: { versions: [newer, CURRENT, PREVIOUS] }, isFetching: false, isError: false };
      const user = userEvent.setup();
      renderSchedule();
      await openDeltaMode(user);

      expect(await versionOptions(user)).toEqual([new Date(PREVIOUS.timestamp).toLocaleString()]);
    });

    it('offers no version for a delta when the version on screen is not in the list', async () => {
      const newer = { versionId: 'v4', timestamp: '2026-04-01T00:00:00.000Z' };
      mockVersionHistory = { data: { versions: [newer, PREVIOUS, OLDEST] }, isFetching: false, isError: false };
      const user = userEvent.setup();
      renderSchedule();
      await user.click(screen.getByRole('button', { name: 'Download CSV' }));

      expect(screen.getByRole('radio', { name: /\(no prior versions\)/ })).toBeDisabled();
      expect(screen.queryByRole('combobox', { name: /compare against version/i })).not.toBeInTheDocument();
      expect(mockUseGetChargeItemDefinitionVersionQuery).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        expect.anything()
      );
    });

    it('disables the delta option when the version list is unavailable', async () => {
      mockVersionHistory = { data: undefined, isFetching: false, isError: true };
      const user = userEvent.setup();
      renderSchedule();
      await user.click(screen.getByRole('button', { name: 'Download CSV' }));

      expect(screen.getByRole('radio', { name: /\(unavailable\)/ })).toBeDisabled();
    });

    it.each(['fee-schedule', 'charge-master'] as const)(
      'fetches only the selected historical version in %s mode',
      async (mode) => {
        const user = userEvent.setup();
        renderSchedule(mode);
        await openDeltaMode(user);

        expect(mockUseGetChargeItemDefinitionVersionQuery).toHaveBeenLastCalledWith(scheduleId(mode), undefined, true);

        await selectVersion(user, PREVIOUS.timestamp);

        expect(mockUseGetChargeItemDefinitionVersionQuery).toHaveBeenLastCalledWith(
          scheduleId(mode),
          PREVIOUS.versionId,
          true
        );
        const requestedVersions = mockUseGetChargeItemDefinitionVersionQuery.mock.calls
          .map(([, versionId]) => versionId)
          .filter((versionId) => versionId !== undefined);
        expect(new Set(requestedVersions)).toEqual(new Set([PREVIOUS.versionId]));
      }
    );

    it('shows a loading state while the selected version is fetched', async () => {
      mockSelectedVersion = { data: undefined, isFetching: true, isError: false };
      const user = userEvent.setup();
      renderSchedule();
      await openDeltaMode(user);
      await selectVersion(user, PREVIOUS.timestamp);

      expect(screen.getByText('Computing changes...')).toBeInTheDocument();
      expect(screen.queryByText(/no changes found/i)).not.toBeInTheDocument();
      expect(downloadButton()).toBeDisabled();
    });

    it('shows an error instead of an empty delta when the selected version cannot be fetched', async () => {
      mockSelectedVersion = { data: undefined, isFetching: false, isError: true };
      const user = userEvent.setup();
      renderSchedule();
      await openDeltaMode(user);
      await selectVersion(user, PREVIOUS.timestamp);

      expect(screen.getByText(/error loading the selected version/i)).toBeInTheDocument();
      expect(screen.queryByText(/no changes found/i)).not.toBeInTheDocument();
      expect(downloadButton()).toBeDisabled();
    });

    it('refuses to compare against a version other than the one selected', async () => {
      mockSelectedVersion = {
        data: { ...previousVersion, meta: { versionId: 'v9', lastUpdated: '2026-01-09T00:00:00.000Z' } },
        isFetching: false,
        isError: false,
      };
      const user = userEvent.setup();
      renderSchedule();
      await openDeltaMode(user);
      await selectVersion(user, PREVIOUS.timestamp);

      expect(screen.getByText(/error loading the selected version/i)).toBeInTheDocument();
      expect(screen.queryByText('Changed')).not.toBeInTheDocument();
      expect(downloadButton()).toBeDisabled();
    });

    it('previews the delta between the fetched version and the codes on screen', async () => {
      mockSelectedVersion = { data: previousVersion, isFetching: false, isError: false };
      const user = userEvent.setup();
      renderSchedule();
      await openDeltaMode(user);
      await selectVersion(user, PREVIOUS.timestamp);

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('Changed')).toBeInTheDocument();
      expect(within(dialog).getByText('Removed')).toBeInTheDocument();
      expect(within(dialog).getByText('99215')).toBeInTheDocument();
      expect(within(dialog).getByText('$80.00')).toBeInTheDocument();
      expect(within(dialog).getByText('2 changes')).toBeInTheDocument();
      expect(downloadButton()).toBeEnabled();
    });

    it('says no changes were found when the fetched version matches the codes on screen', async () => {
      mockSelectedVersion = {
        data: makeFeeSchedule(CURRENT_CODES, { meta: { versionId: PREVIOUS.versionId } }),
        isFetching: false,
        isError: false,
      };
      const user = userEvent.setup();
      renderSchedule();
      await openDeltaMode(user);
      await selectVersion(user, PREVIOUS.timestamp);

      expect(screen.getByText(/no changes found between the selected version/i)).toBeInTheDocument();
      expect(downloadButton()).toBeDisabled();
    });

    it('downloads the delta CSV named after the exact version time rather than the list timestamp', async () => {
      mockSelectedVersion = { data: previousVersion, isFetching: false, isError: false };
      const user = userEvent.setup();
      renderSchedule();
      await openDeltaMode(user);
      await selectVersion(user, PREVIOUS.timestamp);
      await user.click(downloadButton());

      expect(downloadNames).toEqual(['BCBS_2026_delta_since_2026-01-02T03-04-05.csv']);
      expect(await readBlob(blobs[0])).toBe(
        [
          '"Status","Procedure Code","Modifier","Old Amount","New Amount"',
          '"Changed","99213","","80.00","100.00"',
          '"Removed","99215","","300.00",""',
        ].join('\n')
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });
  });
});
