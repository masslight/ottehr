import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WorkQueue, WorkQueueSummary } from 'utils/lib/types/data/billing/work-queue.schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClaimsListViewState } from '../../src/pages/ClaimsList';
import WorkQueueDetail from '../../src/pages/WorkQueueDetail';
import WorkQueues from '../../src/pages/WorkQueues';

const {
  getBillingWorkQueuesMock,
  getBillingWorkQueueMock,
  saveBillingWorkQueueMock,
  deleteBillingWorkQueueMock,
  searchBillingWorkQueueOwnersMock,
  enqueueSnackbarMock,
  claimsListViewMock,
  mockOystehrZambda,
} = vi.hoisted(() => ({
  getBillingWorkQueuesMock: vi.fn(),
  getBillingWorkQueueMock: vi.fn(),
  saveBillingWorkQueueMock: vi.fn(),
  deleteBillingWorkQueueMock: vi.fn(),
  searchBillingWorkQueueOwnersMock: vi.fn(),
  enqueueSnackbarMock: vi.fn(),
  claimsListViewMock: vi.fn(),
  mockOystehrZambda: {},
}));

vi.mock('../../src/api/api', () => ({
  getBillingWorkQueues: getBillingWorkQueuesMock,
  getBillingWorkQueue: getBillingWorkQueueMock,
  saveBillingWorkQueue: saveBillingWorkQueueMock,
  deleteBillingWorkQueue: deleteBillingWorkQueueMock,
  searchBillingWorkQueueOwners: searchBillingWorkQueueOwnersMock,
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: mockOystehrZambda }),
}));

vi.mock('notistack', () => ({
  enqueueSnackbar: enqueueSnackbarMock,
  SnackbarProvider: ({ children }: { children?: ReactNode }) => children ?? null,
}));

// The claims list itself is covered by ClaimsList.test.tsx. The stand-in shows what the queue page
// hands it, and lets a test change the view the way filtering, sorting, or dragging a column would.
vi.mock('../../src/pages/ClaimsList', () => ({
  ClaimsListView: (props: {
    title?: ReactNode;
    actions?: ReactNode;
    initialFilters?: unknown;
    initialLayout?: unknown;
    onStateChange?: (state: ClaimsListViewState) => void;
  }) => {
    claimsListViewMock(props);
    return (
      <div>
        {props.title}
        {props.actions}
        <button
          type="button"
          onClick={() =>
            props.onStateChange?.({
              filters: { arStage: ['insurance-payer'], status: ['submitted'] },
              layout: { columnOrder: ['billed', 'patientName'], sort: { field: 'billed', direction: 'desc' } },
              paginationModel: { page: 0, pageSize: 25 },
            })
          }
        >
          change view
        </button>
      </div>
    );
  },
}));

const owners = [
  { practitionerId: 'prac-1', name: 'Sarah Chen' },
  { practitionerId: 'prac-2', name: 'Mike Rodriguez' },
];

const summary = (overrides: Partial<WorkQueueSummary>): WorkQueueSummary => ({
  id: 'q-1',
  name: 'Medicaid Claims',
  description: 'Claims with state Medicaid (MC) primary coverage.',
  owner: owners[0],
  filters: {},
  layout: {},
  claimCount: 42,
  charged: 38120.5,
  incomplete: false,
  ...overrides,
});

const savedQueue: WorkQueue = {
  id: 'q-1',
  name: 'Medicaid Claims',
  description: 'Medicaid',
  owner: owners[0],
  filters: { arStage: ['insurance-payer'] },
  layout: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  searchBillingWorkQueueOwnersMock.mockResolvedValue({ owners });
});

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/work-queues" element={<WorkQueues />} />
        <Route path="/work-queues/:id" element={<WorkQueueDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('WorkQueues', () => {
  it("lists each queue with its claims, what they're charged, and its owner", async () => {
    getBillingWorkQueuesMock.mockResolvedValue({
      queues: [summary({}), summary({ id: 'q-2', name: 'Aging Claims', description: undefined, owner: undefined })],
    });

    renderAt('/work-queues');

    const row = (await screen.findByText('Medicaid Claims')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Claims with state Medicaid (MC) primary coverage.')).toBeInTheDocument();
    expect(within(row).getByText('42')).toBeInTheDocument();
    expect(within(row).getByText('$38,120.50')).toBeInTheDocument();
    expect(within(row).getByText('Sarah Chen')).toBeInTheDocument();
    expect(screen.getByText('Aging Claims')).toBeInTheDocument();
    // No Expected column until fee schedules can say what a queue's claims should pay.
    expect(screen.queryByText('Expected')).not.toBeInTheDocument();
  });

  it('links every cell of a row to its queue, so it can be opened in a new tab', async () => {
    getBillingWorkQueuesMock.mockResolvedValue({ queues: [summary({})] });
    getBillingWorkQueueMock.mockResolvedValue({ queue: savedQueue });

    renderAt('/work-queues');

    const row = (await screen.findByText('Medicaid Claims')).closest('tr') as HTMLElement;
    const links = row.querySelectorAll('a');
    expect(links).toHaveLength(4);
    links.forEach((link) => expect(link).toHaveAttribute('href', '/work-queues/q-1'));
    // One tab stop per row: the queue name's link.
    expect(
      within(row)
        .getAllByRole('link')
        .filter((link) => link.tabIndex !== -1)
    ).toHaveLength(1);

    fireEvent.click(within(row).getByText('$38,120.50'));
    await waitFor(() => expect(getBillingWorkQueueMock).toHaveBeenCalledWith(mockOystehrZambda, { queueId: 'q-1' }));
  });

  it('marks figures that are lower bounds, and ones that could not be worked out', async () => {
    getBillingWorkQueuesMock.mockResolvedValue({
      queues: [
        summary({ claimCount: 10000, charged: 5, incomplete: true }),
        summary({ id: 'q-2', name: 'Broken', claimCount: null, charged: null }),
      ],
    });

    renderAt('/work-queues');

    expect(await screen.findByText('10,000+')).toBeInTheDocument();
    const broken = screen.getByText('Broken').closest('tr') as HTMLElement;
    expect(within(broken).getAllByText('—')).toHaveLength(2);
  });

  it('creates a queue from the dialog and opens it', async () => {
    getBillingWorkQueuesMock.mockResolvedValue({ queues: [] });
    saveBillingWorkQueueMock.mockResolvedValue({ queue: { ...savedQueue, id: 'q-new', filters: {} } });
    getBillingWorkQueueMock.mockResolvedValue({ queue: { ...savedQueue, id: 'q-new', filters: {} } });

    renderAt('/work-queues');
    fireEvent.click(await screen.findByRole('button', { name: 'Create Work Queue' }));
    const dialog = await screen.findByRole('dialog');

    // The name is required.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await within(dialog).findByText('Queue name is required')).toBeInTheDocument();
    expect(saveBillingWorkQueueMock).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/Queue Name/), { target: { value: '  Medicaid Claims ' } });
    fireEvent.change(within(dialog).getByLabelText('Queue Description'), { target: { value: 'Medicaid' } });
    fireEvent.mouseDown(within(dialog).getByLabelText('Owner'));
    fireEvent.click(await screen.findByRole('option', { name: 'Sarah Chen' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(saveBillingWorkQueueMock).toHaveBeenCalledWith(mockOystehrZambda, {
        name: 'Medicaid Claims',
        description: 'Medicaid',
        owner: owners[0],
        filters: {},
        layout: {},
      })
    );
    await waitFor(() => expect(getBillingWorkQueueMock).toHaveBeenCalledWith(mockOystehrZambda, { queueId: 'q-new' }));
  });

  it('deletes a queue only once the dialog is confirmed, and drops it from the list', async () => {
    getBillingWorkQueuesMock.mockResolvedValue({
      queues: [summary({}), summary({ id: 'q-2', name: 'Aging Claims' })],
    });
    deleteBillingWorkQueueMock.mockResolvedValue({ deleted: true });

    renderAt('/work-queues');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Medicaid Claims' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Medicaid Claims')).toBeInTheDocument();
    expect(deleteBillingWorkQueueMock).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteBillingWorkQueueMock).toHaveBeenCalledWith(mockOystehrZambda, { queueId: 'q-1' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: /Medicaid Claims/ })).not.toBeInTheDocument());
    expect(screen.getByText('Aging Claims')).toBeInTheDocument();
    expect(enqueueSnackbarMock).toHaveBeenCalledWith('Work queue deleted.', { variant: 'success' });
  });

  it('keeps the queue when the delete is cancelled', async () => {
    getBillingWorkQueuesMock.mockResolvedValue({ queues: [summary({})] });

    renderAt('/work-queues');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Medicaid Claims' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(deleteBillingWorkQueueMock).not.toHaveBeenCalled();
    expect(screen.getByText('Medicaid Claims')).toBeInTheDocument();
  });
});

describe('WorkQueueDetail', () => {
  beforeEach(() => {
    getBillingWorkQueueMock.mockResolvedValue({ queue: savedQueue });
  });

  it("opens the claims list on the queue's saved filters and layout", async () => {
    getBillingWorkQueueMock.mockResolvedValue({
      queue: { ...savedQueue, layout: { columnOrder: ['billed'], sort: { field: 'serviceDate', direction: 'asc' } } },
    });

    renderAt('/work-queues/q-1');

    await screen.findByRole('button', { name: 'change view' });
    expect(claimsListViewMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initialFilters: { arStage: ['insurance-payer'] },
        initialLayout: { columnOrder: ['billed'], sort: { field: 'serviceDate', direction: 'asc' } },
      })
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves the edited details together with the current filters, column order, and sort', async () => {
    saveBillingWorkQueueMock.mockImplementation(async (_client, { queueId, ...input }) => ({
      queue: { ...input, id: queueId },
    }));

    renderAt('/work-queues/q-1');
    fireEvent.click(await screen.findByRole('button', { name: 'change view' }));
    fireEvent.change(screen.getByLabelText(/Queue Name/), { target: { value: 'Medicaid Pre-Submission' } });
    fireEvent.mouseDown(screen.getByLabelText('Owner'));
    fireEvent.click(await screen.findByRole('option', { name: 'Mike Rodriguez' }));

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(saveBillingWorkQueueMock).toHaveBeenCalledWith(mockOystehrZambda, {
        queueId: 'q-1',
        name: 'Medicaid Pre-Submission',
        description: 'Medicaid',
        owner: owners[1],
        filters: { arStage: ['insurance-payer'], status: ['submitted'] },
        layout: { columnOrder: ['billed', 'patientName'], sort: { field: 'billed', direction: 'desc' } },
      })
    );
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument());
    expect(enqueueSnackbarMock).toHaveBeenCalledWith('Work queue saved.', { variant: 'success' });
  });

  it('can clear the owner', async () => {
    saveBillingWorkQueueMock.mockImplementation(async (_client, { queueId, ...input }) => ({
      queue: { ...input, id: queueId },
    }));

    renderAt('/work-queues/q-1');
    const owner = await screen.findByLabelText('Owner');
    fireEvent.mouseDown(owner);
    fireEvent.click(screen.getByTitle('Clear'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(saveBillingWorkQueueMock).toHaveBeenCalledWith(mockOystehrZambda, expect.objectContaining({ owner: null }))
    );
  });

  it('deletes the queue after confirmation and goes back to the list', async () => {
    deleteBillingWorkQueueMock.mockResolvedValue({ deleted: true });
    getBillingWorkQueuesMock.mockResolvedValue({ queues: [] });

    renderAt('/work-queues/q-1');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(deleteBillingWorkQueueMock).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteBillingWorkQueueMock).toHaveBeenCalledWith(mockOystehrZambda, { queueId: 'q-1' }));
    expect(await screen.findByText('No work queues yet')).toBeInTheDocument();
  });

  it('stays on the queue when the delete fails', async () => {
    deleteBillingWorkQueueMock.mockRejectedValue(new Error('boom'));

    renderAt('/work-queues/q-1');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Work Queue' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(enqueueSnackbarMock).toHaveBeenCalledWith(expect.any(String), { variant: 'error' }));
    // The dialog stays open to try again, over the queue's page.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(getBillingWorkQueuesMock).not.toHaveBeenCalled();
  });

  it("says so when the queue can't be loaded", async () => {
    getBillingWorkQueueMock.mockRejectedValue(new Error('Not found'));

    renderAt('/work-queues/missing');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Work Queues' })).toBeInTheDocument();
  });
});
