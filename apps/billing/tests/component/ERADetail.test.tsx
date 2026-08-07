import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EraClaimRemit, EraDetailResponse } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ERADetail from '../../src/pages/ERADetail';

const { getBillingEraDetailMock, oystehrZambdaStub } = vi.hoisted(() => ({
  getBillingEraDetailMock: vi.fn(),
  oystehrZambdaStub: {},
}));

vi.mock('../../src/api/api', () => ({
  getBillingEraDetail: getBillingEraDetailMock,
  unmatchClaimResponse: vi.fn(),
  matchClaimResponseToClaim: vi.fn(),
  getBillingClaimDetail: vi.fn(),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: oystehrZambdaStub,
  }),
}));

const { enqueueSnackbarMock } = vi.hoisted(() => ({ enqueueSnackbarMock: vi.fn() }));

vi.mock('notistack', () => ({
  enqueueSnackbar: enqueueSnackbarMock,
  SnackbarProvider: ({ children }: { children?: ReactNode }) => children ?? null,
}));

// DataGridPro doesn't render rows under jsdom (no layout/ResizeObserver). Replace it with a
// stand-in that renders headers, every cell (via renderCell/valueFormatter), and a per-row button
// that drives onRowClick — enough to exercise the page's own wiring.
vi.mock('@mui/x-data-grid-pro', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mui/x-data-grid-pro')>();
  return {
    ...original,
    DataGridPro: ({
      rows = [],
      columns = [],
      getRowId,
      onRowClick,
    }: {
      rows: Record<string, unknown>[];
      columns: {
        field: string;
        headerName?: string;
        renderCell?: (params: unknown) => ReactNode;
        valueFormatter?: (params: { value: unknown }) => ReactNode;
      }[];
      getRowId?: (row: Record<string, unknown>) => string;
      onRowClick?: (params: { row: Record<string, unknown>; id: string }) => void;
    }) => (
      <div>
        <div data-testid="grid-headers">{columns.map((col) => col.headerName).join('|')}</div>
        {rows.map((row) => {
          const id = getRowId ? getRowId(row) : String(row.id);
          return (
            <div key={id} data-testid={`row-${id}`}>
              <button onClick={() => onRowClick?.({ row, id })}>{`open-${id}`}</button>
              {columns.map((col) => {
                const value = row[col.field];
                return (
                  <span key={col.field}>
                    {col.renderCell
                      ? col.renderCell({ value, row, id })
                      : col.valueFormatter
                      ? col.valueFormatter({ value })
                      : (value as ReactNode)}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    ),
  };
});

const matchedRemit: EraClaimRemit = {
  claimResponseId: 'cr-1',
  created: '2026-07-15',
  outcome: 'complete',
  disposition: '',
  eraStatusCode: '1',
  payerClaimControlNumber: 'ICN-123',
  allowed: 80,
  paid: 60,
  patientResp: 20,
  patientRespAdjustments: [{ groupCode: 'PR', reasonCode: '1', amount: 20 }],
  serviceLines: [],
  notes: [],
};

const unmatchedRemit: EraClaimRemit = {
  claimResponseId: 'cr-2',
  created: '2026-07-15',
  outcome: 'queued',
  disposition: '',
  eraStatusCode: '4',
  payerClaimControlNumber: '',
  allowed: null,
  paid: 0,
  patientResp: 25,
  patientRespAdjustments: [{ groupCode: 'PR', reasonCode: '3', amount: 25 }],
  serviceLines: [],
  notes: [],
};

const makeEra = (): EraDetailResponse => ({
  id: 'era-1',
  checkNumber: 'CHK-100',
  checkDate: '2026-07-18',
  createdDate: '2026-07-20T10:00:00Z',
  checkAmount: 60,
  payerName: 'Acme Insurance',
  payerFhirId: 'org-9',
  payee: { name: 'Ottehr Medical Group', npi: '1234567890', taxId: '123456789' },
  status: 'complete',
  paymentMethod: 'CHK',
  totalClaims: 2,
  matchedClaims: 1,
  unmatchedClaims: 1,
  claims: [
    {
      claimId: 'c1',
      patientName: 'Doe, Jane',
      patientDob: '2008-06-07',
      dos: '2026-07-09',
      billed: 100,
      allowed: 80,
      paid: 60,
      posted: 60,
      patientResp: 20,
      patientAccountNumber: 'abc123',
      memberId: '999000111',
      status: 'complete',
      matched: true,
      claimResponseIds: ['cr-1'],
      remits: [matchedRemit],
    },
    {
      claimId: 'unmatched-cr-2',
      patientName: 'Smith, Riley',
      patientDob: '',
      dos: '2026-06-30',
      billed: 80,
      allowed: 0,
      paid: 0,
      posted: 0,
      patientResp: 25,
      patientAccountNumber: 'ACC-7',
      memberId: '',
      status: 'queued',
      matched: false,
      claimResponseIds: ['cr-2'],
      remits: [unmatchedRemit],
    },
  ],
});

function renderDetail(): void {
  render(
    <MemoryRouter initialEntries={['/eras/era-1']}>
      <Routes>
        <Route path="/eras/:id" element={<ERADetail />} />
        <Route path="/eras" element={<div>ERA list</div>} />
        <Route path="/eras/:eraId/claims/:claimId" element={<div>Reimbursement page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ERADetail', () => {
  beforeEach(() => {
    getBillingEraDetailMock.mockReset();
    getBillingEraDetailMock.mockResolvedValue(makeEra());
  });

  it('renders check info, created date, and the payee section', async () => {
    renderDetail();

    expect(await screen.findByText('CHK-100')).toBeInTheDocument();
    // check date and ERA created date are formatted
    expect(screen.getByText('07/18/2026')).toBeInTheDocument();
    expect(screen.getByText('07/20/2026')).toBeInTheDocument();

    expect(screen.getByText('Payee')).toBeInTheDocument();
    expect(screen.getByText('Ottehr Medical Group')).toBeInTheDocument();
    expect(screen.getByText('1234567890')).toBeInTheDocument();
    expect(screen.getByText('12-3456789')).toBeInTheDocument();
  });

  it('shows only the payee fields the ERA carries', async () => {
    // the common real shape: the payer identifies the payee by NPI alone
    getBillingEraDetailMock.mockResolvedValue({
      ...makeEra(),
      payee: { name: '', npi: '1871112375', taxId: '' },
    });
    renderDetail();

    expect(await screen.findByText('Payee')).toBeInTheDocument();
    expect(screen.getByText('1871112375')).toBeInTheDocument();
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Tax ID')).not.toBeInTheDocument();
  });

  it('hides the payee section when the ERA carries no payee', async () => {
    getBillingEraDetailMock.mockResolvedValue({ ...makeEra(), payee: null });
    renderDetail();

    expect(await screen.findByText('CHK-100')).toBeInTheDocument();
    expect(screen.queryByText('Payee')).not.toBeInTheDocument();
  });

  it('shows the Patient Resp column', async () => {
    renderDetail();

    expect(await screen.findByText('CHK-100')).toBeInTheDocument();
    expect(screen.getByTestId('grid-headers').textContent).toContain('Patient Resp');
  });

  it('keeps the Match button on unmatched rows', async () => {
    renderDetail();

    expect(await screen.findByText('CHK-100')).toBeInTheDocument();
    const row = within(screen.getByTestId('row-unmatched-cr-2'));
    expect(row.getByRole('button', { name: 'Match' })).toBeInTheDocument();
  });

  it('drills into the reimbursement page on row click, for unmatched rows too', async () => {
    const user = userEvent.setup();
    renderDetail();

    expect(await screen.findByText('CHK-100')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'open-unmatched-cr-2' }));
    expect(await screen.findByText('Reimbursement page')).toBeInTheDocument();
  });
});
