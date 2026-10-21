import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enqueueSnackbar } from 'notistack';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DmeOrderDTO, DmeOrderStatus } from 'utils/lib/types/api/dme.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ getPdf: vi.fn(), sendFax: vi.fn() }));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

vi.mock('../../src/features/dme/dme.queries', () => ({
  useDmeOrderPdf: () => ({ mutateAsync: state.getPdf, isPending: false }),
  useUpdateDmeOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSendDmeOrderFax: () => ({ mutateAsync: state.sendFax, isPending: false }),
}));

vi.mock('../../src/features/visits/shared/components/FormsCard', () => ({ FormsCard: () => null }));

import { DmeOrderDetails } from '../../src/features/dme/components/DmeOrderDetails';

const order: DmeOrderDTO = {
  id: 'order-1',
  encounterId: 'enc1',
  itemName: 'Knee brace',
  diagnoses: [],
  quantity: 1,
  billingCodes: [],
  external: true,
  status: DmeOrderStatus.pending,
  orderedBy: { practitionerId: 'p1', name: 'Dr. Ordering' },
  orderedAt: '2026-10-16T10:00:00.000Z',
};

type FakeTab = { location: { href: string }; close: ReturnType<typeof vi.fn> };
let openedTabs: FakeTab[] = [];

describe('DmeOrderDetails print', () => {
  beforeEach(() => {
    openedTabs = [];
    state.getPdf.mockReset();
    vi.mocked(enqueueSnackbar).mockClear();
    vi.stubGlobal(
      'open',
      vi.fn(() => {
        const tab = { location: { href: '' }, close: vi.fn() };
        openedTabs.push(tab);
        return tab;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the tab inside the click and points it at the PDF once generated', async () => {
    let resolvePdf: (value: { presignedURL: string }) => void = () => undefined;
    state.getPdf.mockReturnValue(new Promise((resolve) => (resolvePdf = resolve)));
    render(<DmeOrderDetails order={order} />);

    await userEvent.click(screen.getByTestId(dataTestIds.dmeOrders.details.printButton));

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(openedTabs).toHaveLength(1);
    resolvePdf({ presignedURL: 'https://example.test/dme.pdf' });

    await waitFor(() => expect(openedTabs[0].location.href).toBe('https://example.test/dme.pdf'));
    expect(state.getPdf).toHaveBeenCalledWith('order-1');
    expect(window.open).toHaveBeenCalledTimes(1);
  });

  it('closes the blank tab when the PDF cannot be generated', async () => {
    state.getPdf.mockRejectedValue(new Error('pdf failed'));
    render(<DmeOrderDetails order={order} />);

    await userEvent.click(screen.getByTestId(dataTestIds.dmeOrders.details.printButton));

    await waitFor(() => expect(openedTabs[0].close).toHaveBeenCalled());
    expect(enqueueSnackbar).toHaveBeenCalledWith('Failed to generate the DME order PDF', { variant: 'error' });
  });

  it('falls back to opening the PDF directly when the blank tab was blocked', async () => {
    vi.stubGlobal('open', vi.fn().mockReturnValue(null));
    state.getPdf.mockResolvedValue({ presignedURL: 'https://example.test/dme.pdf' });
    render(<DmeOrderDetails order={order} />);

    await userEvent.click(screen.getByTestId(dataTestIds.dmeOrders.details.printButton));

    await waitFor(() => expect(window.open).toHaveBeenCalledWith('https://example.test/dme.pdf', '_blank'));
  });
});

describe('DmeOrderDetails fax', () => {
  beforeEach(() => {
    state.sendFax.mockReset();
    vi.mocked(enqueueSnackbar).mockClear();
  });

  it('faxes an external order to the third party fax number', async () => {
    state.sendFax.mockResolvedValue({ outboundAttemptId: 'task-1' });
    render(
      <DmeOrderDetails
        order={{ ...order, status: DmeOrderStatus.ordered, thirdParty: { name: 'Acme', fax: '(212) 555-0199' } }}
      />
    );

    await userEvent.click(screen.getByTestId(dataTestIds.progressNotePage.sendFaxButton));
    expect(screen.getByLabelText(/Fax number/)).toHaveValue('(212) 555-0199');
    await userEvent.click(screen.getByTestId(dataTestIds.dialog.proceedButton));

    await waitFor(() =>
      expect(state.sendFax).toHaveBeenCalledWith({ deviceRequestId: 'order-1', faxNumber: '2125550199' })
    );
    expect(enqueueSnackbar).toHaveBeenCalledWith('Fax sent.', { variant: 'success' });
  });

  it('offers no fax for an in-house order', () => {
    render(<DmeOrderDetails order={{ ...order, external: false }} />);

    expect(screen.queryByTestId(dataTestIds.progressNotePage.sendFaxButton)).not.toBeInTheDocument();
  });
});

describe('DmeOrderDetails history', () => {
  it('lists the order and dispense events of an in-house order', () => {
    render(
      <DmeOrderDetails
        order={{
          ...order,
          external: false,
          status: DmeOrderStatus.dispensed,
          dispensed: { practitionerId: 'p2', name: 'Nurse Dispenser', at: '2026-10-16T11:00:00.000Z' },
        }}
      />
    );

    const history = within(screen.getByTestId(dataTestIds.dmeOrders.historySection));
    expect(history.getByText('PENDING')).toBeInTheDocument();
    expect(history.getByText('Dr. Ordering')).toBeInTheDocument();
    expect(history.getByText('DISPENSED')).toBeInTheDocument();
    expect(history.getByText('Nurse Dispenser')).toBeInTheDocument();
  });

  it('shows an external order as ordered', () => {
    render(<DmeOrderDetails order={{ ...order, status: DmeOrderStatus.ordered }} />);

    const history = within(screen.getByTestId(dataTestIds.dmeOrders.historySection));
    expect(history.getByText('ORDERED')).toBeInTheDocument();
    expect(history.queryByText('DISPENSED')).not.toBeInTheDocument();
  });
});
