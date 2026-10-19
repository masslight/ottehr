import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DmeOrderDTO, DmeOrderStatus } from 'utils/lib/types/api/dme.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ orders: [] as DmeOrderDTO[] }));

vi.mock('../../src/features/dme/dme.queries', () => ({
  useDmeOrders: () => ({ data: state.orders, isLoading: false, error: null }),
  useUpdateDmeOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { DmeOrdersTable } from '../../src/features/dme/components/DmeOrdersTable';

const order: DmeOrderDTO = {
  id: 'order-1',
  encounterId: 'enc-follow-up',
  itemName: 'Knee brace',
  diagnoses: [],
  quantity: 1,
  billingCodes: [],
  external: false,
  status: DmeOrderStatus.pending,
  orderedBy: { practitionerId: 'p1', name: 'Dr. Ordering' },
  orderedAt: '2026-10-16T10:00:00.000Z',
};

const CurrentLocation = (): ReactElement => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const renderTable = (initialUrl: string, onRowClick?: (order: DmeOrderDTO) => void): void => {
  render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route
          path="/in-person/:id/dme"
          element={<DmeOrdersTable encounterId="enc-follow-up" appointmentId="appt1" onRowClick={onRowClick} />}
        />
        <Route path="*" element={<CurrentLocation />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('DmeOrdersTable', () => {
  beforeEach(() => {
    state.orders = [order];
  });

  it('opens an order from the keyboard through the item name', async () => {
    const onRowClick = vi.fn();
    renderTable('/in-person/appt1/dme', onRowClick);
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Knee brace' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(order);
  });

  it('opens an order once when the item name is clicked inside the clickable row', async () => {
    const onRowClick = vi.fn();
    renderTable('/in-person/appt1/dme', onRowClick);

    await userEvent.click(screen.getByRole('button', { name: 'Knee brace' }));

    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the selected follow-up encounter when navigating to the order', async () => {
    renderTable('/in-person/appt1/dme?encounterId=enc-follow-up');

    await userEvent.click(screen.getByTestId(dataTestIds.dmeOrders.orderRow(order.id)));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/in-person/appt1/dme/order-1/order-details?encounterId=enc-follow-up'
    );
  });

  it('adds no encounter param when the chart was opened without one', async () => {
    renderTable('/in-person/appt1/dme');

    await userEvent.click(screen.getByRole('button', { name: 'Knee brace' }));

    expect(screen.getByTestId('location').textContent).toBe('/in-person/appt1/dme/order-1/order-details');
  });
});
