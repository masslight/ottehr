import { fireEvent, render, screen, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EraListItem } from 'utils/lib/types/data/billing/billing.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ERAList from '../../src/pages/ERAList';

const { searchBillingErasMock } = vi.hoisted(() => ({ searchBillingErasMock: vi.fn() }));

vi.mock('../../src/api/api', () => ({
  searchBillingEras: searchBillingErasMock,
  searchBillingPayers: vi.fn().mockResolvedValue({ payers: [] }),
  importEra: vi.fn(),
}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));

// DataGridPro doesn't lay out rows under jsdom; render every cell the way the grid would.
vi.mock('@mui/x-data-grid-pro', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mui/x-data-grid-pro')>()),
  DataGridPro: ({
    rows = [],
    columns = [],
  }: {
    rows: Record<string, unknown>[];
    columns: {
      field: string;
      headerName?: string;
      renderCell?: (params: unknown) => ReactNode;
      valueFormatter?: (params: { value: unknown }) => ReactNode;
    }[];
  }) => (
    <div>
      <div data-testid="grid-headers">{columns.map((column) => column.headerName).join('|')}</div>
      {rows.map((row) => (
        <div key={String(row.id)} data-testid={`row-${row.id}`}>
          {columns.map((column) => (
            <span key={column.field}>
              {column.renderCell
                ? column.renderCell({ value: row[column.field], row })
                : column.valueFormatter
                ? column.valueFormatter({ value: row[column.field] })
                : (row[column.field] as ReactNode)}
            </span>
          ))}
        </div>
      ))}
    </div>
  ),
}));

const era = (overrides: Partial<EraListItem>): EraListItem => ({
  id: 'era',
  checkNumber: 'CHK',
  payerName: 'Payer',
  billingProviderName: '',
  source: 'clearing-house',
  paymentDate: '2026-09-10',
  paymentAmount: 100,
  status: 'complete',
  claimCount: 1,
  matchedCount: 1,
  unmatchedCount: 0,
  ...overrides,
});

function renderList(): void {
  render(
    <MemoryRouter initialEntries={['/eras']}>
      <Routes>
        <Route path="/eras" element={<ERAList />} />
        <Route path="/eras/new" element={<div>manual remit page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ERAList', () => {
  beforeEach(() => {
    searchBillingErasMock.mockResolvedValue({
      eras: [
        era({
          id: 'm',
          checkNumber: 'CHK-10422',
          source: 'manual',
          billingProviderName: 'Brightside Pediatrics LLC',
          claimCount: 3,
          matchedCount: 3,
        }),
        era({
          id: 'x',
          checkNumber: 'EFT-88213',
          source: 'x12-import',
          claimCount: 5,
          matchedCount: 4,
          unmatchedCount: 1,
        }),
        era({
          id: 'c',
          checkNumber: '11111',
          source: 'clearing-house',
          claimCount: 1,
          matchedCount: 0,
          unmatchedCount: 1,
        }),
      ],
      total: 3,
    });
  });

  it('lists each ERA with its billing provider, source and matched claims', async () => {
    renderList();
    expect(await screen.findByTestId('row-m')).toBeInTheDocument();
    expect(screen.getByTestId('grid-headers')).toHaveTextContent(
      'Check No.|Check Date|Amount|Payer|Billing Provider|Source|Claims'
    );

    const manual = within(screen.getByTestId('row-m'));
    expect(manual.getByText('Brightside Pediatrics LLC')).toBeInTheDocument();
    expect(manual.getByText('Manual')).toBeInTheDocument();
    expect(manual.getByText('3/3 matched')).toBeInTheDocument();

    const imported = within(screen.getByTestId('row-x'));
    expect(imported.getByText('Imported X12/835')).toBeInTheDocument();
    expect(imported.getByText('4/5 matched')).toBeInTheDocument();
    expect(imported.getByText('-')).toBeInTheDocument();

    expect(within(screen.getByTestId('row-c')).getByText('Clearing House')).toBeInTheDocument();
  });

  it('adds an ERA by importing an 835 or keying one in', async () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Paste an ERA in X12 format')).toBeInTheDocument();
    expect(screen.getByText('Key in a paper or PDF remit')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Enter Manually'));
    expect(await screen.findByText('manual remit page')).toBeInTheDocument();
  });

  it('opens the 835 import from the same menu', async () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(await screen.findByText('Import 835'));
    expect(within(await screen.findByRole('dialog')).getByText('Import ERA')).toBeInTheDocument();
  });
});
