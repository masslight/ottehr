import { GridPaginationModel } from '@mui/x-data-grid-pro';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EraListItem } from 'utils/lib/types/data/billing/billing.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    paginationModel,
    onPaginationModelChange,
  }: {
    paginationModel: GridPaginationModel;
    onPaginationModelChange: (model: GridPaginationModel) => void;
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
      <button onClick={() => onPaginationModelChange({ ...paginationModel, page: paginationModel.page + 1 })}>
        Next page
      </button>
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

const selectStatus = (status: 'Active' | 'Voided'): void => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'ERA Status' }));
  fireEvent.click(screen.getByRole('option', { name: status }));
};

describe('ERAList', () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    searchBillingErasMock.mockReset().mockResolvedValue({
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
    expect(screen.getByRole('combobox', { name: 'ERA Status' })).toHaveTextContent('Active');
    expect(searchBillingErasMock).toHaveBeenLastCalledWith(expect.anything(), {
      status: 'active',
      pageSize: 25,
      offset: 0,
    });
  });

  it('resets pagination on status changes and keeps the status on later pages', async () => {
    renderList();
    await screen.findByTestId('row-m');
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(searchBillingErasMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'active', offset: 25 })
    );
    searchBillingErasMock.mockResolvedValue({ eras: [era({ id: 'voided' })], total: 30 });
    selectStatus('Voided');
    expect(await screen.findByTestId('row-voided')).toBeInTheDocument();
    expect(screen.queryByTestId('row-m')).not.toBeInTheDocument();
    expect(searchBillingErasMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'voided', offset: 0 })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(searchBillingErasMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'voided', offset: 25 })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('combobox', { name: 'ERA Status' })).toHaveTextContent('Active');
    expect(searchBillingErasMock).toHaveBeenLastCalledWith(expect.anything(), {
      status: 'active',
      pageSize: 25,
      offset: 0,
    });
  });

  it('keeps the selected status when closing the import dialog', async () => {
    renderList();
    await screen.findByTestId('row-m');
    selectStatus('Voided');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(await screen.findByText('Import 835'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(searchBillingErasMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'voided' })
    );
  });

  it('does not let an older active search replace the voided results', async () => {
    let resolveActive!: (result: { eras: EraListItem[]; total: number }) => void;
    searchBillingErasMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveActive = resolve;
      })
    );
    searchBillingErasMock.mockResolvedValue({ eras: [era({ id: 'voided' })], total: 1 });
    renderList();
    selectStatus('Voided');
    await screen.findByTestId('row-voided');
    await act(async () => resolveActive({ eras: [era({ id: 'active' })], total: 1 }));
    expect(screen.getByTestId('row-voided')).toBeInTheDocument();
    expect(screen.queryByTestId('row-active')).not.toBeInTheDocument();
  });

  it('cancels a pending text search when changing status or clearing filters', async () => {
    renderList();
    await screen.findByTestId('row-m');
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole('textbox', { name: 'Check Number' }), { target: { value: 'CHK-1' } });
    selectStatus('Voided');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(searchBillingErasMock).toHaveBeenCalledTimes(2);
    expect(searchBillingErasMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'voided', checkNumber: 'CHK-1' })
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Check Number' }), { target: { value: 'CHK-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(searchBillingErasMock).toHaveBeenCalledTimes(3);
    expect(searchBillingErasMock).toHaveBeenLastCalledWith(expect.anything(), {
      status: 'active',
      pageSize: 25,
      offset: 0,
    });
  });

  it('applies both text filters when they are edited within the debounce window', async () => {
    renderList();
    await screen.findByTestId('row-m');
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole('textbox', { name: 'Check Number' }), { target: { value: 'CHK-1' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    fireEvent.change(screen.getByPlaceholderText('Search by patient name or PCN...'), { target: { value: 'Lee' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(searchBillingErasMock).toHaveBeenCalledTimes(2);
    expect(searchBillingErasMock).toHaveBeenLastCalledWith(expect.anything(), {
      status: 'active',
      pageSize: 25,
      offset: 0,
      checkNumber: 'CHK-1',
      searchText: 'Lee',
    });
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
