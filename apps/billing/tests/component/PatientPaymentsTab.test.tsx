import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PatientPaymentsTab } from '../../src/components/patient/PatientPaymentsTab';

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

// jsdom has no layout — without this the grids render zero rows
vi.mock('@mui/x-data-grid-pro', async () => {
  const actual = await vi.importActual<typeof import('@mui/x-data-grid-pro')>('@mui/x-data-grid-pro');
  const DataGridPro = (props: React.ComponentProps<typeof actual.DataGridPro>): React.ReactElement => (
    <actual.DataGridPro {...props} disableVirtualization />
  );
  return { ...actual, DataGridPro };
});

const renderTab = (): ReturnType<typeof render> =>
  render(
    <MemoryRouter>
      <PatientPaymentsTab />
    </MemoryRouter>
  );

const grids = (): HTMLElement[] => screen.getAllByRole('grid');
const paymentsGrid = (): HTMLElement => grids()[0];
const invoicesGrid = (): HTMLElement => grids()[1];

describe('PatientPaymentsTab', () => {
  it('renders payments and invoices tables', () => {
    renderTab();

    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
    expect(within(paymentsGrid()).getByText('$75.00')).toBeInTheDocument();
    expect(within(invoicesGrid()).getByText('Past Due')).toBeInTheDocument();
    // a paid invoice whose linked payment was refunded surfaces the refund chip
    expect(within(invoicesGrid()).getByText('REFUNDED')).toBeInTheDocument();
  });

  it('opens the refund dialog from the row action', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(within(paymentsGrid()).getAllByRole('button', { name: 'refund' })[0]);

    expect(screen.getByText('Refund Payment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Issue Refund' })).toBeDisabled();
  });

  it('voids an open invoice after confirmation', async () => {
    const user = userEvent.setup();
    renderTab();

    expect(within(invoicesGrid()).getAllByText('Void')).toHaveLength(1);
    await user.click(within(invoicesGrid()).getAllByRole('button', { name: 'void invoice' })[0]);
    await user.click(screen.getByRole('button', { name: 'Void Invoice' }));

    // the confirm dialog unmounts; the grid regains visibility once the modal closes
    await waitFor(() => expect(within(invoicesGrid()).getAllByText('Void')).toHaveLength(2));
  });

  it('records a cash payment from the Add payment dialog', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('button', { name: 'Add payment' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Amount/), '12.50');
    await user.click(within(dialog).getByRole('radio', { name: 'Cash' }));
    await user.click(within(dialog).getByRole('button', { name: 'Record Payment' }));

    await waitFor(() => expect(within(paymentsGrid()).getByText('$12.50')).toBeInTheDocument());
  });

  it('issues an open invoice from the Issue invoice dialog', async () => {
    const user = userEvent.setup();
    renderTab();

    expect(within(invoicesGrid()).getAllByText('Open')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Issue invoice' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Amount/), '43.21');
    await user.click(within(dialog).getByRole('button', { name: 'Send Invoice' }));

    await waitFor(() => expect(within(invoicesGrid()).getAllByText('Open')).toHaveLength(2));
    expect(within(invoicesGrid()).getByText('$43.21')).toBeInTheDocument();
  });
});
