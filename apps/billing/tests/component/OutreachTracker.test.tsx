import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { BillingOutreachTask } from 'utils/lib/types/data/billing/billing.types';
import { describe, expect, it, vi } from 'vitest';
import { OutreachTracker } from '../../src/components/OutreachTracker';

const mocks = vi.hoisted(() => ({ list: vi.fn(), retry: vi.fn(), client: {} }));
vi.mock('../../src/api/api', () => ({
  listOutreachTasks: mocks.list,
  retryOutreachTask: mocks.retry,
  cancelOutreachTask: vi.fn(),
}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: mocks.client }) }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

// Render cells without relying on grid layout in jsdom.
vi.mock('@mui/x-data-grid-pro', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mui/x-data-grid-pro')>()),
  DataGridPro: ({
    rows,
    columns,
  }: {
    rows: BillingOutreachTask[];
    columns: {
      field: string;
      renderCell?: (params: { row: BillingOutreachTask; value: ReactNode }) => ReactNode;
      valueGetter?: (params: { row: BillingOutreachTask }) => ReactNode;
    }[];
  }) => (
    <div>
      {rows.map((row) => (
        <div key={row.id} data-testid={`row-${row.id}`}>
          {columns.map((column) => {
            const value = column.valueGetter?.({ row });
            return <span key={column.field}>{column.renderCell?.({ row, value }) ?? value}</span>;
          })}
        </div>
      ))}
    </div>
  ),
}));

const task = (overrides: Partial<BillingOutreachTask>): BillingOutreachTask => ({
  id: 'task-1',
  status: 'failed',
  actionType: 'charge-card',
  triggerEvent: 'invoice-due',
  actionId: 'action-1',
  patientId: 'billing-pat-1',
  patientName: 'Sam Patient',
  focusReference: 'Invoice/inv-1',
  dueDateTime: '2026-11-05T15:00:00.000Z',
  authoredOn: '2026-11-05T15:00:00.000Z',
  description: '',
  invoice: {
    id: 'inv-1',
    status: 'issued',
    issueDate: '2026-11-01T15:00:00.000Z',
    dueDate: '2026-11-05',
    amount: 125,
    claimId: 'claim-1',
  },
  ...overrides,
});

describe('Outreach Tracker', () => {
  it('retries a failed task and loads the list again', async () => {
    mocks.list.mockResolvedValue({
      tasks: [
        task({ errorMessage: 'Card declined' }),
        task({ id: 'task-2', status: 'draft', actionType: 'send-notification', mediums: 'sms,email' }),
        task({ id: 'task-3', status: 'completed', notificationResults: [{ medium: 'sms', success: false }] }),
      ],
      totalCount: 3,
      pageSize: 25,
      offset: 0,
    });
    mocks.retry.mockResolvedValue({});
    const user = userEvent.setup();
    render(<OutreachTracker />, { wrapper: MemoryRouter });

    const failed = within(await screen.findByTestId('row-task-1'));
    expect(failed.getByText('Card declined')).toBeVisible();
    expect(failed.getByRole('link', { name: '$125.00' })).toHaveAttribute('href', '/claims/claim-1');
    const pending = within(screen.getByTestId('row-task-2'));
    expect(pending.getByText('Send Notification (SMS, Email)')).toBeVisible();
    expect(pending.getByRole('button', { name: 'Cancel' })).toBeVisible();
    expect(within(screen.getByTestId('row-task-3')).getByText('sms: not sent')).toBeVisible();
    await user.click(failed.getByRole('button', { name: 'Retry' }));

    expect(mocks.retry).toHaveBeenCalledWith(mocks.client, { taskId: 'task-1' });
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
  });
});
