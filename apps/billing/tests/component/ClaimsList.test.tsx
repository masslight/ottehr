import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AR_STAGE, BillingClaimItem, emptyClaimStatusValues } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClaimsList from '../../src/pages/ClaimsList';

const { searchBillingClaimsMock, submitBillingClaimsMock } = vi.hoisted(() => ({
  searchBillingClaimsMock: vi.fn(),
  submitBillingClaimsMock: vi.fn(),
}));

vi.mock('../../src/api/api', () => ({
  searchBillingClaims: searchBillingClaimsMock,
  submitBillingClaims: submitBillingClaimsMock,
  searchBillingPatients: vi.fn().mockResolvedValue({ patients: [] }),
  searchBillingPayers: vi.fn().mockResolvedValue({ payers: [] }),
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
  dataGridSlots: {},
  dataGridSx: {},
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
  }: {
    rows: BillingClaimItem[];
    isRowSelectable?: (params: { row: BillingClaimItem }) => boolean;
    rowSelectionModel?: (string | number)[];
    onRowSelectionModelChange?: (model: (string | number)[]) => void;
  }) => (
    <div>
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
    </div>
  ),
}));

const makeRow = (id: string, patientName: string, arStage: string): BillingClaimItem => ({
  id,
  type: 'professional',
  status: '',
  statuses: {
    ...emptyClaimStatusValues(),
    arStage,
  },
  patientName,
  patientDob: '1990-01-01',
  payerName: 'Acme',
  payerId: 'P1',
  memberId: '',
  appointmentType: undefined,
  serviceDate: '2026-01-02',
  facility: '',
  renderingProvider: '',
  billed: 0,
  allowed: 0,
  insurancePaid: 0,
  patientResp: 0,
  patientPaid: 0,
  claimBalance: 0,
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
    submitBillingClaimsMock.mockReset();
    enqueueSnackbarMock.mockReset();
  });

  it('blocks non-Insurance-Payer-AR rows from selection and submits the selected eligible claim', async () => {
    searchBillingClaimsMock.mockResolvedValue({
      claims: [
        makeRow('c-ins', 'Insurable Patient', AR_STAGE.insurancePayer),
        makeRow('c-pat', 'Self-Pay Patient', AR_STAGE.patient),
      ],
      total: 2,
    });
    submitBillingClaimsMock.mockResolvedValue({
      results: [
        {
          claimId: 'c-ins',
          status: 'submitted',
        },
      ],
    });
    renderList();

    const eligible = await screen.findByLabelText('select Insurable Patient');
    expect(eligible).toBeEnabled();
    expect(screen.getByLabelText('select Self-Pay Patient')).toBeDisabled();

    fireEvent.click(eligible);

    const submitButton = await screen.findByRole('button', { name: 'Submit (1)' });
    fireEvent.click(submitButton);

    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(submitBillingClaimsMock).toHaveBeenCalledWith({}, { claimIds: ['c-ins'] }));
    expect(enqueueSnackbarMock).toHaveBeenCalledWith('1 claim(s) submitted', { variant: 'success' });
  });

  it('names the failed claim in the error summary', async () => {
    searchBillingClaimsMock.mockResolvedValue({
      claims: [makeRow('c-ins', 'Insurable Patient', AR_STAGE.insurancePayer)],
      total: 1,
    });
    submitBillingClaimsMock.mockResolvedValue({
      results: [
        {
          claimId: 'c-ins',
          status: 'error',
          error: 'payer down',
        },
      ],
    });
    renderList();

    fireEvent.click(await screen.findByLabelText('select Insurable Patient'));
    fireEvent.click(await screen.findByRole('button', { name: 'Submit (1)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(enqueueSnackbarMock).toHaveBeenCalledWith(
        'Failed to submit: Insurable Patient (2026-01-02) — payer down',
        {
          variant: 'error',
        }
      )
    );
  });
});
