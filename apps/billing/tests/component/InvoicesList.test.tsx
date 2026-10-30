import { GridPaginationModel } from '@mui/x-data-grid-pro';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BillingInvoiceListItem } from 'utils/lib/types/data/billing/billing.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InvoicesList from '../../src/pages/InvoicesList';

const { searchBillingInvoicesMock } = vi.hoisted(() => ({ searchBillingInvoicesMock: vi.fn() }));

vi.mock('../../src/api/api', () => ({
  searchBillingInvoices: searchBillingInvoicesMock,
  searchBillingServiceFacilities: () =>
    Promise.resolve({ facilities: [{ id: 'facility-1', name: 'Main Clinic' }], total: 1, offset: 0, pageSize: 50 }),
}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));

// Render cells without relying on grid layout in jsdom.
vi.mock('@mui/x-data-grid-pro', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mui/x-data-grid-pro')>()),
  DataGridPro: ({
    rows = [],
    columns = [],
    onRowClick,
  }: {
    paginationModel: GridPaginationModel;
    rows: Record<string, unknown>[];
    onRowClick: (params: { row: Record<string, unknown> }) => void;
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
        <div key={String(row.id)} data-testid={`row-${row.id}`} onClick={() => onRowClick({ row })}>
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

const invoice: BillingInvoiceListItem = {
  id: 'inv-1',
  status: 'issued',
  issueDate: '2026-10-29T15:00:00.000Z',
  dueDate: '2026-11-05',
  amount: 3.5,
  patientName: 'Patientlastname, Sam',
  claimId: 'claim-1',
  serviceDate: '2026-09-20',
  hostedInvoiceUrl: 'https://pay.test/in_1',
};

function renderList(): void {
  render(
    <MemoryRouter initialEntries={['/invoices']}>
      <Routes>
        <Route path="/invoices" element={<InvoicesList />} />
        <Route path="/claims/:id" element={<div>claim page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('InvoicesList', () => {
  beforeEach(() => {
    searchBillingInvoicesMock.mockReset().mockResolvedValue({ invoices: [invoice], total: 1, offset: 0, pageSize: 25 });
  });

  it('lists sent invoices with a link to the Stripe page and opens the claim on click', async () => {
    renderList();

    const row = within(await screen.findByTestId('row-inv-1'));
    expect(screen.getByTestId('grid-headers')).toHaveTextContent(
      'Patient|Date of Service|Amount|Issued|Due|Status|Invoice'
    );
    expect(row.getByText('Patientlastname, Sam')).toBeInTheDocument();
    expect(row.getByText('$3.50')).toBeInTheDocument();
    expect(row.getByText('Open')).toBeInTheDocument();
    expect(row.getByRole('link', { name: 'View' })).toHaveAttribute('href', 'https://pay.test/in_1');

    fireEvent.click(screen.getByTestId('row-inv-1'));
    expect(await screen.findByText('claim page')).toBeInTheDocument();
  });

  it('asks for the first page of the chosen status', async () => {
    renderList();
    await screen.findByTestId('row-inv-1');

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Status' }));
    fireEvent.click(screen.getByRole('option', { name: 'Paid' }));

    await waitFor(() =>
      expect(searchBillingInvoicesMock).toHaveBeenLastCalledWith(expect.anything(), {
        status: 'balanced',
        searchText: undefined,
        facilityId: undefined,
        issuedFrom: undefined,
        issuedTo: undefined,
        offset: 0,
        pageSize: 25,
      })
    );
  });

  it('asks for the invoices of the chosen facility', async () => {
    renderList();
    await screen.findByTestId('row-inv-1');

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Facility' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Main Clinic' }));

    await waitFor(() =>
      expect(searchBillingInvoicesMock).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ facilityId: 'facility-1', offset: 0 })
      )
    );
  });
});
