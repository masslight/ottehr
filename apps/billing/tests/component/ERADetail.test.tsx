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
// stand-in that renders headers, every cell (via renderCell/valueFormatter), each row's detail
// panel content, and buttons that drive onCellClick — enough to exercise the page's own wiring.
vi.mock('@mui/x-data-grid-pro', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mui/x-data-grid-pro')>();
  return {
    ...original,
    DataGridPro: ({
      rows = [],
      columns = [],
      getRowId,
      getDetailPanelContent,
      onCellClick,
    }: {
      rows: Record<string, unknown>[];
      columns: {
        field: string;
        headerName?: string;
        renderCell?: (params: unknown) => ReactNode;
        valueFormatter?: (params: { value: unknown }) => ReactNode;
      }[];
      getRowId?: (row: Record<string, unknown>) => string;
      getDetailPanelContent?: (params: { row: Record<string, unknown>; id: string }) => ReactNode;
      onCellClick?: (params: { field: string; row: Record<string, unknown>; id: string }) => void;
    }) => (
      <div>
        <div data-testid="grid-headers">{columns.map((col) => col.headerName).join('|')}</div>
        {rows.map((row) => {
          const id = getRowId ? getRowId(row) : String(row.id);
          return (
            <div key={id} data-testid={`row-${id}`}>
              <button
                onClick={() => onCellClick?.({ field: original.GRID_DETAIL_PANEL_TOGGLE_FIELD, row, id })}
              >{`toggle-${id}`}</button>
              <button onClick={() => onCellClick?.({ field: 'patientName', row, id })}>{`open-${id}`}</button>
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
              <div data-testid={`panel-${id}`}>{getDetailPanelContent?.({ row, id })}</div>
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
  disposition: 'Processed as primary',
  eraStatusCode: '1',
  payerClaimControlNumber: 'ICN-123',
  allowed: 80,
  paid: 60,
  patientResp: 20,
  patientRespAdjustments: [{ groupCode: 'PR', reasonCode: '1', amount: 20 }],
  serviceLines: [
    {
      itemSequence: 1,
      isClaimLevel: false,
      cptCode: '99213',
      modifiers: ['25'],
      units: 1,
      serviceDate: '2026-07-09',
      billed: 100,
      allowed: 80,
      paid: 60,
      deductible: 20,
      coinsurance: 0,
      copay: 0,
      adjustments: [
        { groupCode: 'PR', reasonCode: '1', amount: 20 },
        { groupCode: 'CO', reasonCode: '45', amount: 20 },
      ],
    },
  ],
  notes: ['Alert: claim processed under network agreement'],
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
  serviceLines: [
    {
      itemSequence: null,
      isClaimLevel: true,
      cptCode: '',
      modifiers: [],
      units: null,
      serviceDate: '',
      billed: null,
      allowed: null,
      paid: 0,
      deductible: 0,
      coinsurance: 0,
      copay: 25,
      adjustments: [{ groupCode: 'PR', reasonCode: '3', amount: 25 }],
    },
  ],
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
      dos: '2026-07-09',
      billed: 100,
      allowed: 80,
      paid: 60,
      posted: 60,
      patientResp: 20,
      patientAccountNumber: 'abc123',
      status: 'complete',
      matched: true,
      claimResponseIds: ['cr-1'],
      remits: [matchedRemit],
    },
    {
      claimId: 'unmatched-cr-2',
      patientName: 'Smith, Riley',
      dos: '2026-06-30',
      billed: 80,
      allowed: 0,
      paid: 0,
      posted: 0,
      patientResp: 25,
      patientAccountNumber: 'ACC-7',
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
        <Route path="/claims/:id" element={<div>Claim page</div>} />
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

  it('hides the payee section when the ERA carries no payee', async () => {
    getBillingEraDetailMock.mockResolvedValue({ ...makeEra(), payee: null });
    renderDetail();

    expect(await screen.findByText('CHK-100')).toBeInTheDocument();
    expect(screen.queryByText('Payee')).not.toBeInTheDocument();
  });

  it('shows the Patient Resp column and per-remit service line adjudication', async () => {
    renderDetail();

    expect(await screen.findByText('CHK-100')).toBeInTheDocument();
    expect(screen.getByTestId('grid-headers').textContent).toContain('Patient Resp');

    const panel = within(screen.getByTestId('panel-c1'));
    // claim info
    expect(panel.getByText('abc123')).toBeInTheDocument();
    expect(panel.getByText('ICN-123')).toBeInTheDocument();
    expect(panel.getByText('Primary')).toBeInTheDocument();
    // once as the patient-responsibility reason chip, once on the service line
    expect(panel.getAllByText('PR-1 $20.00')).toHaveLength(2);
    // service line
    expect(panel.getByText('99213')).toBeInTheDocument();
    expect(panel.getByText('25')).toBeInTheDocument();
    expect(panel.getByText('$100.00')).toBeInTheDocument();
    expect(panel.getByText('CO-45 $20.00')).toBeInTheDocument();
    // payer remarks (RARC notes)
    expect(panel.getByText('Alert: claim processed under network agreement')).toBeInTheDocument();

    // claim-level CAS bucket on the unmatched claim renders a labeled row
    const unmatchedPanel = within(screen.getByTestId('panel-unmatched-cr-2'));
    expect(unmatchedPanel.getByText('Claim-level adjustments')).toBeInTheDocument();
    expect(unmatchedPanel.getByText('Denied')).toBeInTheDocument();
  });

  it('explains adjustment codes on hover', async () => {
    const user = userEvent.setup();
    renderDetail();

    const panel = within(await screen.findByTestId('panel-c1'));
    await user.hover(panel.getByText('CO-45 $20.00'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Contractual Obligation — Charge exceeds fee schedule/maximum allowable or contracted/legislated fee arrangement.'
    );
  });

  it('lists every CARC used on the ERA in the glossary with descriptions', async () => {
    renderDetail();

    expect(await screen.findByText('Adjustment reason codes (CARC)')).toBeInTheDocument();
    expect(screen.getByText('Deductible amount.')).toBeInTheDocument();
    expect(screen.getByText('Co-payment amount.')).toBeInTheDocument();
    expect(
      screen.getByText('Charge exceeds fee schedule/maximum allowable or contracted/legislated fee arrangement.')
    ).toBeInTheDocument();
    expect(screen.getByText('CO = Contractual Obligation · PR = Patient Responsibility')).toBeInTheDocument();
  });

  it('keeps the Match button on unmatched rows', async () => {
    renderDetail();

    expect(await screen.findByText('CHK-100')).toBeInTheDocument();
    const row = within(screen.getByTestId('row-unmatched-cr-2'));
    expect(row.getByRole('button', { name: 'Match' })).toBeInTheDocument();
  });

  it('navigates to the claim on cell click but not on the detail panel toggle', async () => {
    const user = userEvent.setup();
    renderDetail();

    expect(await screen.findByText('CHK-100')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'toggle-c1' }));
    expect(screen.queryByText('Claim page')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'open-c1' }));
    expect(await screen.findByText('Claim page')).toBeInTheDocument();
  });
});
