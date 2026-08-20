import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { BillingClaimItem } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, emptyClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClaimsList from '../../src/pages/ClaimsList';

const {
  searchBillingClaimsMock,
  runBillingRulesEngineMock,
  exportBillingClaimsMock,
  getBillingClaimsExportStatusMock,
  pollExportTaskMock,
  downloadTextFileMock,
} = vi.hoisted(() => ({
  searchBillingClaimsMock: vi.fn(),
  runBillingRulesEngineMock: vi.fn(),
  exportBillingClaimsMock: vi.fn(),
  getBillingClaimsExportStatusMock: vi.fn(),
  pollExportTaskMock: vi.fn(),
  downloadTextFileMock: vi.fn(),
}));

vi.mock('../../src/api/api', () => ({
  searchBillingClaims: searchBillingClaimsMock,
  runBillingRulesEngine: runBillingRulesEngineMock,
  exportBillingClaims: exportBillingClaimsMock,
  getBillingClaimsExportStatus: getBillingClaimsExportStatusMock,
  searchBillingPatients: vi.fn().mockResolvedValue({ patients: [] }),
  searchBillingPayers: vi.fn().mockResolvedValue({ payers: [] }),
  // Preloaded on mount behind a debounce timer — without this export the timer explodes on slow
  // (CI) runners after the test body has already finished.
  searchBillingServices: vi.fn().mockResolvedValue({ services: [] }),
  searchBillingTags: vi.fn().mockResolvedValue({ tags: [] }),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: {},
  }),
}));

const { enqueueSnackbarMock } = vi.hoisted(() => ({ enqueueSnackbarMock: vi.fn() }));

vi.mock('notistack', () => ({
  enqueueSnackbar: enqueueSnackbarMock,
  SnackbarProvider: ({ children }: { children?: ReactNode }) => children ?? null,
}));

vi.mock('../../src/components/BillingDataGrid', () => ({
  dataGridSlots: (props?: { onExportCsv?: () => void; exporting?: boolean }) => ({ exportSlot: props }),
  dataGridSx: {},
}));

vi.mock('../../src/utils/pollExportTask', () => ({
  pollExportTask: pollExportTaskMock,
}));

vi.mock('../../src/utils/downloadTextFile', () => ({
  downloadTextFile: downloadTextFileMock,
}));

// DataGridPro doesn't render rows under jsdom (no layout/ResizeObserver). Replace it with a minimal
// stand-in that renders one checkbox per row honoring isRowSelectable — enough to exercise the page's
// selection → submit wiring without depending on MUI's virtualization.
vi.mock('@mui/x-data-grid-pro', () => ({
  DataGridPro: ({
    rows,
    isRowSelectable,
    rowSelectionModel = [],
    onRowSelectionModelChange,
    paginationModel,
    onPaginationModelChange,
    slots,
  }: {
    rows: BillingClaimItem[];
    isRowSelectable?: (params: { row: BillingClaimItem }) => boolean;
    rowSelectionModel?: (string | number)[];
    onRowSelectionModelChange?: (model: (string | number)[]) => void;
    paginationModel?: { page: number; pageSize: number };
    onPaginationModelChange?: (model: { page: number; pageSize: number }) => void;
    slots?: { exportSlot?: { onExportCsv?: () => void; exporting?: boolean } };
  }) => (
    <div>
      {slots?.exportSlot?.onExportCsv && (
        <button type="button" onClick={slots.exportSlot.onExportCsv} disabled={slots.exportSlot.exporting}>
          Export
        </button>
      )}
      {rows.map((row) => (
        <input
          key={row.id}
          type="checkbox"
          aria-label={`select ${row.patientName}`}
          disabled={isRowSelectable ? !isRowSelectable({ row }) : false}
          checked={rowSelectionModel.includes(row.id)}
          onChange={(e) =>
            onRowSelectionModelChange?.(
              e.target.checked ? [...rowSelectionModel, row.id] : rowSelectionModel.filter((id) => id !== row.id)
            )
          }
        />
      ))}
      <button
        type="button"
        aria-label="next page"
        onClick={() =>
          onPaginationModelChange?.({
            page: (paginationModel?.page ?? 0) + 1,
            pageSize: paginationModel?.pageSize ?? 25,
          })
        }
      >
        next page
      </button>
    </div>
  ),
}));

const makeRow = (
  id: string,
  patientName: string,
  arStage: string,
  rulesEngine?: BillingClaimItem['rulesEngine']
): BillingClaimItem => ({
  id,
  type: 'professional',
  status: '',
  statuses: {
    ...emptyClaimStatusValues(),
    arStage,
  },
  rulesEngine,
  patientName,
  patientDob: '1990-01-01',
  payerName: 'Acme',
  payerId: 'P1',
  memberId: '',
  service: undefined,
  serviceDate: '2026-01-02',
  facility: '',
  renderingProvider: '',
  billed: 0,
  allowed: 0,
  insurancePaid: 0,
  patientResp: 0,
  patientPaid: 0,
  claimBalance: 0,
  adjudicated: true,
  responsibleParty: '',
  tags: [],
});

function renderList(): void {
  render(
    <MemoryRouter>
      <ClaimsList />
    </MemoryRouter>
  );
}

describe('ClaimsList — submit claims', () => {
  beforeEach(() => {
    searchBillingClaimsMock.mockReset();
    runBillingRulesEngineMock.mockReset();
    enqueueSnackbarMock.mockReset();
  });

  it('lets claims in different AR stages be selected together and kicks off the rules for all of them', async () => {
    searchBillingClaimsMock.mockResolvedValue({
      claims: [
        makeRow('c-ins', 'Insurable Patient', AR_STAGE.insurancePayer, 'claim-submission'),
        makeRow('c-self', 'Self-Pay Patient', AR_STAGE.patient, 'patient-ar-pre-invoice'),
        makeRow('c-cov', 'Covered Patient AR', AR_STAGE.patient),
      ],
      total: 3,
    });
    runBillingRulesEngineMock.mockResolvedValue({
      results: [
        { claimId: 'c-ins', taskId: 'task-1', engine: 'claim-submission' },
        { claimId: 'c-self', taskId: 'task-2', engine: 'patient-ar-pre-invoice' },
      ],
    });
    renderList();

    const insurable = await screen.findByLabelText('select Insurable Patient');
    const selfPay = screen.getByLabelText('select Self-Pay Patient');
    expect(insurable).toBeEnabled();
    expect(selfPay).toBeEnabled();
    // A row no engine applies to (Patient AR with coverage) stays unselectable.
    expect(screen.getByLabelText('select Covered Patient AR')).toBeDisabled();

    fireEvent.click(insurable);
    fireEvent.click(selfPay);

    fireEvent.click(await screen.findByRole('button', { name: 'Run rules (2)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Run rules' }));

    await waitFor(() => expect(runBillingRulesEngineMock).toHaveBeenCalledWith({}, { claimIds: ['c-ins', 'c-self'] }));
    expect(enqueueSnackbarMock).toHaveBeenCalledWith(
      'Rules started for 2 claim(s) — each claim will be submitted, made ready to invoice, or held shortly. ' +
        'Refresh to see the results.',
      { variant: 'info' }
    );
  });

  it('surfaces a kickoff failure as an error snackbar', async () => {
    searchBillingClaimsMock.mockResolvedValue({
      claims: [makeRow('c-ins', 'Insurable Patient', AR_STAGE.insurancePayer, 'claim-submission')],
      total: 1,
    });
    runBillingRulesEngineMock.mockRejectedValue(new Error('kickoff failed'));
    renderList();

    fireEvent.click(await screen.findByLabelText('select Insurable Patient'));
    fireEvent.click(await screen.findByRole('button', { name: 'Run rules (1)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Run rules' }));

    await waitFor(() =>
      expect(enqueueSnackbarMock).toHaveBeenCalledWith('kickoff failed', {
        variant: 'error',
      })
    );
  });

  it('clears the selection when the claims reload (e.g. on page change)', async () => {
    searchBillingClaimsMock.mockResolvedValue({
      claims: [makeRow('c-ins', 'Insurable Patient', AR_STAGE.insurancePayer, 'claim-submission')],
      total: 50,
    });
    renderList();

    fireEvent.click(await screen.findByLabelText('select Insurable Patient'));
    expect(await screen.findByRole('button', { name: 'Run rules (1)' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'next page' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /^Run rules \(/ })).not.toBeInTheDocument());
  });
});

describe('ClaimsList — export', () => {
  const clickExport = async (): Promise<void> => {
    const button = await screen.findByRole('button', { name: 'Export' });
    fireEvent.click(button);
  };

  beforeEach(() => {
    searchBillingClaimsMock.mockReset();
    exportBillingClaimsMock.mockReset();
    pollExportTaskMock.mockReset();
    downloadTextFileMock.mockReset();
    enqueueSnackbarMock.mockReset();

    searchBillingClaimsMock.mockResolvedValue({
      claims: [makeRow('c-1', 'Insurable Patient', AR_STAGE.insurancePayer)],
      total: 1_800,
    });
    exportBillingClaimsMock.mockResolvedValue({ taskId: 'task-1' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('Claim ID,Patient Name\nc-1,"Doe, Jane"'),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The grid only ever holds one page, so the export has to come from the backend, not the rows.
  it('exports every claim the current filters match, not the page on screen', async () => {
    pollExportTaskMock.mockResolvedValue({
      status: 'completed',
      downloadUrl: 'https://signed.example/claims.csv',
    });
    renderList();

    const search = await screen.findByPlaceholderText(/Search by patient name/);
    fireEvent.change(search, {
      target: {
        value: 'Smith',
      },
    });
    await waitFor(() => expect(searchBillingClaimsMock).toHaveBeenLastCalledWith({}, expect.anything()));

    await clickExport();

    await waitFor(() => expect(exportBillingClaimsMock).toHaveBeenCalledWith({}, { searchText: 'Smith' }));
    expect(exportBillingClaimsMock.mock.calls[0][1]).not.toHaveProperty('offset');
    expect(exportBillingClaimsMock.mock.calls[0][1]).not.toHaveProperty('pageSize');

    await waitFor(() => expect(downloadTextFileMock).toHaveBeenCalled());
    const [fileName, contents] = downloadTextFileMock.mock.calls[0];
    expect(fileName).toMatch(/^claims-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(contents).toBe('Claim ID,Patient Name\nc-1,"Doe, Jane"');
  });

  it('reports why an export failed instead of downloading nothing', async () => {
    pollExportTaskMock.mockResolvedValue({
      status: 'failed',
      error: 'payer lookup timed out',
    });
    renderList();

    await clickExport();

    await waitFor(() =>
      expect(enqueueSnackbarMock).toHaveBeenCalledWith('payer lookup timed out', { variant: 'error' })
    );
    expect(downloadTextFileMock).not.toHaveBeenCalled();
  });

  it('still downloads a partial export, but says it is partial', async () => {
    pollExportTaskMock.mockResolvedValue({
      status: 'completed',
      downloadUrl: 'https://signed.example/claims.csv',
      incomplete: true,
    });
    renderList();

    await clickExport();

    await waitFor(() => expect(downloadTextFileMock).toHaveBeenCalled());
    expect(enqueueSnackbarMock).toHaveBeenCalledWith(expect.stringMatching(/may be missing/), { variant: 'warning' });
  });

  it('surfaces a timeout rather than leaving the button spinning', async () => {
    pollExportTaskMock.mockRejectedValue(new Error('Export timed out'));
    renderList();

    await clickExport();

    await waitFor(() => expect(enqueueSnackbarMock).toHaveBeenCalledWith('Export timed out', { variant: 'error' }));
    expect(await screen.findByRole('button', { name: 'Export' })).toBeEnabled();
  });
});

describe('ClaimsList — search', () => {
  beforeEach(() => {
    searchBillingClaimsMock.mockReset();
    searchBillingClaimsMock.mockResolvedValue({
      claims: [],
      total: 0,
    });
  });

  it('names the fields the one box searches, and which of them have to be exact', async () => {
    renderList();

    const search = await screen.findByPlaceholderText(/patient name, provider name, patient ID, PCN, or claim ID/);
    expect(search).toBeInTheDocument();
    const hint = screen.getByText(/Patient ID, PCN, and claim ID must be entered in full/);
    expect(hint).toBeInTheDocument();
  });

  it('sends what was typed as one searchText once the debounce settles', async () => {
    renderList();

    const search = await screen.findByPlaceholderText(/Search by patient name/);
    fireEvent.change(search, {
      target: {
        value: 'Smith',
      },
    });

    await waitFor(() =>
      expect(searchBillingClaimsMock).toHaveBeenLastCalledWith(
        {},
        expect.objectContaining({
          searchText: 'Smith',
        })
      )
    );
  });
});

const INCOMPLETE_WARNING = /Some claims may be missing from these results/;

describe('ClaimsList — incomplete results', () => {
  beforeEach(() => {
    searchBillingClaimsMock.mockReset();
  });

  it('warns that claims may be missing when the search could not see everything', async () => {
    searchBillingClaimsMock.mockResolvedValue({
      claims: [makeRow('c-ins', 'Insurable Patient', AR_STAGE.insurancePayer)],
      total: 1,
      incomplete: true,
    });
    renderList();

    expect(await screen.findByText(INCOMPLETE_WARNING)).toBeInTheDocument();
  });

  it('stays quiet when the search saw everything', async () => {
    searchBillingClaimsMock.mockResolvedValue({
      claims: [makeRow('c-ins', 'Insurable Patient', AR_STAGE.insurancePayer)],
      total: 1,
      incomplete: false,
    });
    renderList();

    await waitFor(() => expect(searchBillingClaimsMock).toHaveBeenCalled());
    expect(screen.queryByText(INCOMPLETE_WARNING)).not.toBeInTheDocument();
  });

  it('stays quiet for a response that predates the flag', async () => {
    searchBillingClaimsMock.mockResolvedValue({
      claims: [],
      total: 0,
    });
    renderList();

    await waitFor(() => expect(searchBillingClaimsMock).toHaveBeenCalled());
    expect(screen.queryByText(INCOMPLETE_WARNING)).not.toBeInTheDocument();
  });

  it('shows the error instead of the warning when the search failed', async () => {
    searchBillingClaimsMock.mockRejectedValue(new Error('search exploded'));
    renderList();

    expect(await screen.findByText('search exploded')).toBeInTheDocument();
    expect(screen.queryByText(INCOMPLETE_WARNING)).not.toBeInTheDocument();
  });

  it('clears the warning once a later search comes back complete', async () => {
    searchBillingClaimsMock.mockResolvedValueOnce({
      claims: [makeRow('c-ins', 'Insurable Patient', AR_STAGE.insurancePayer)],
      total: 50,
      incomplete: true,
    });
    searchBillingClaimsMock.mockResolvedValue({
      claims: [makeRow('c-ins', 'Insurable Patient', AR_STAGE.insurancePayer)],
      total: 50,
      incomplete: false,
    });
    renderList();

    expect(await screen.findByText(INCOMPLETE_WARNING)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'next page' }));

    await waitFor(() => expect(screen.queryByText(INCOMPLETE_WARNING)).not.toBeInTheDocument());
  });
});
