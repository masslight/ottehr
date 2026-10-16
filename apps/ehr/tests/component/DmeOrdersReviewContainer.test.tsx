import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DmeOrderDTO, DmeOrderStatus } from 'utils/lib/types/api/dme.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ENCOUNTER_ID = '11111111-1111-4111-8111-111111111111';

const state = vi.hoisted(() => ({
  orders: [] as DmeOrderDTO[],
  isLoading: false,
  readOnly: false,
  refreshSummaries: vi.fn(),
}));

vi.mock('../../src/features/dme/dme.queries', () => ({
  DME_ORDERS_QUERY_KEY: 'dme-orders',
  useDmeOrders: () => ({ data: state.orders, isLoading: state.isLoading, error: null }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { id: ENCOUNTER_ID } }),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: state.readOnly }),
}));

vi.mock('../../src/features/visits/in-person/components/progress-note/useRefreshNoteSummaries', () => ({
  useRefreshNoteSummaries: () => state.refreshSummaries,
}));

vi.mock('../../src/features/dme/components/DmeOrdersTable', () => ({
  DmeOrdersTable: ({ onRowClick }: { onRowClick: (order: DmeOrderDTO) => void }) => (
    <div data-testid="dme-table">
      {state.orders.map((order) => (
        <button key={order.id} onClick={() => onRowClick(order)}>
          {`open ${order.itemName}`}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../src/features/dme/pages/DmeOrderCreatePage', () => ({
  DmeOrderCreatePage: ({ onFinished, onCancel }: { onFinished: () => void; onCancel: () => void }) => (
    <div data-testid="dme-create">
      <button onClick={onFinished}>finish create</button>
      <button onClick={onCancel}>cancel create</button>
    </div>
  ),
}));

vi.mock('../../src/features/dme/pages/DmeOrderDetailsPage', () => ({
  DmeOrderDetailsPage: ({
    deviceRequestId,
    onBack,
    onEdit,
  }: {
    deviceRequestId: string;
    onBack: () => void;
    onEdit: (order: DmeOrderDTO) => void;
  }) => (
    <div data-testid="dme-details">
      {`details ${deviceRequestId}`}
      <button onClick={onBack}>back</button>
      <button onClick={() => onEdit(state.orders.find((order) => order.id === deviceRequestId)!)}>edit</button>
    </div>
  ),
}));

vi.mock('../../src/features/dme/pages/DmeOrderEditPage', () => ({
  DmeOrderEditPage: ({ deviceRequestId, onFinished }: { deviceRequestId: string; onFinished: () => void }) => (
    <div data-testid="dme-edit">
      {`edit ${deviceRequestId}`}
      <button onClick={onFinished}>save</button>
    </div>
  ),
}));

import { dataTestIds } from '../../src/constants/data-test-ids';
import { DmeOrdersInlineFlow } from '../../src/features/dme/components/DmeOrdersInlineFlow';
import { DmeOrdersReviewContainer } from '../../src/features/dme/components/DmeOrdersReviewContainer';

const makeOrder = (overrides: Partial<DmeOrderDTO>): DmeOrderDTO => ({
  id: 'order-1',
  encounterId: ENCOUNTER_ID,
  itemName: 'Knee brace',
  diagnoses: [],
  quantity: 1,
  billingCodes: [],
  external: false,
  status: DmeOrderStatus.pending,
  orderedBy: { practitionerId: 'p1', name: 'Dr. Ordering' },
  orderedAt: '2026-10-16T10:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  state.orders = [];
  state.isLoading = false;
  state.readOnly = false;
  state.refreshSummaries.mockReset();
});

describe('DmeOrdersReviewContainer', () => {
  it('summarizes each order with its quantity, modifiers, codes, dx and status', () => {
    state.orders = [
      makeOrder({
        id: 'in-house',
        quantity: 2,
        laterality: 'LT',
        modifier: 'NU',
        duration: { value: 2, unit: 'weeks' },
        billingCodes: [
          { code: 'L1830', display: 'Knee orthosis' },
          { code: 'L1810', display: 'Knee orthosis, elastic' },
        ],
        diagnoses: [{ code: 'M25.561', display: 'Pain in right knee' }],
        status: DmeOrderStatus.dispensed,
      }),
      makeOrder({
        id: 'external',
        itemName: 'Wheelchair',
        laterality: 'NA',
        external: true,
        thirdParty: { name: 'Acme Medical Supply' },
        status: DmeOrderStatus.ordered,
      }),
    ];

    render(<DmeOrdersReviewContainer encounterId={ENCOUNTER_ID} />);

    const inHouse = within(screen.getByTestId(dataTestIds.dmeOrders.reviewItem('in-house')));
    expect(inHouse.getByText('Knee brace')).toBeInTheDocument();
    expect(inHouse.getByText('Qty 2 · LT · NU · 2 weeks')).toBeInTheDocument();
    expect(inHouse.getByText('HCPCS: L1830, L1810')).toBeInTheDocument();
    expect(inHouse.getByText('Dx: M25.561 Pain in right knee')).toBeInTheDocument();
    expect(inHouse.getByText('DISPENSED')).toBeInTheDocument();
    expect(inHouse.queryByText(/Third party/)).not.toBeInTheDocument();

    const external = within(screen.getByTestId(dataTestIds.dmeOrders.reviewItem('external')));
    expect(external.getByText('Qty 1')).toBeInTheDocument();
    expect(external.getByText('Third party: Acme Medical Supply')).toBeInTheDocument();
    expect(external.getByText('PRINT ONLY')).toBeInTheDocument();
  });

  it('shows pending orders that have not been dispensed yet', () => {
    state.orders = [makeOrder({ status: DmeOrderStatus.pending })];

    render(<DmeOrdersReviewContainer encounterId={ENCOUNTER_ID} />);

    expect(screen.getByText('Knee brace')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.queryByText('No DME orders')).not.toBeInTheDocument();
  });

  it('shows an empty message when the encounter has no orders', () => {
    render(<DmeOrdersReviewContainer encounterId={ENCOUNTER_ID} />);
    expect(screen.getByText('No DME orders')).toBeInTheDocument();
  });

  it('shows a loading message while the orders load', () => {
    state.isLoading = true;
    render(<DmeOrdersReviewContainer encounterId={ENCOUNTER_ID} />);
    expect(screen.getByText('Loading DME orders...')).toBeInTheDocument();
    expect(screen.queryByText('No DME orders')).not.toBeInTheDocument();
  });
});

describe('DmeOrdersInlineFlow', () => {
  const renderFlow = (): void => {
    render(
      <MemoryRouter initialEntries={['/in-person/appt-1/review-and-sign']}>
        <Routes>
          <Route path="/in-person/:id/*" element={<DmeOrdersInlineFlow />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('opens create from the list and returns to the list, refreshing the note', async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole('button', { name: 'Order' }));
    await user.click(screen.getByText('finish create'));

    expect(screen.getByTestId('dme-table')).toBeInTheDocument();
    expect(state.refreshSummaries).toHaveBeenCalledTimes(1);
  });

  it('goes from a row to its details, to edit, and back to details after saving', async () => {
    const user = userEvent.setup();
    state.orders = [makeOrder({ id: 'order-7' })];
    renderFlow();

    await user.click(screen.getByText('open Knee brace'));
    expect(screen.getByText('details order-7')).toBeInTheDocument();

    await user.click(screen.getByText('edit'));
    expect(screen.getByText('edit order-7')).toBeInTheDocument();

    await user.click(screen.getByText('save'));
    expect(screen.getByText('details order-7')).toBeInTheDocument();

    await user.click(screen.getByText('back'));
    expect(screen.getByTestId('dme-table')).toBeInTheDocument();
  });

  it('hides the Order button on a read-only chart', () => {
    state.readOnly = true;
    renderFlow();
    expect(screen.queryByRole('button', { name: 'Order' })).not.toBeInTheDocument();
    expect(screen.getByTestId('dme-table')).toBeInTheDocument();
  });
});
