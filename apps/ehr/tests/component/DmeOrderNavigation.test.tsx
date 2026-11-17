import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DmeOrderDTO, DmeOrderStatus } from 'utils/lib/types/api/dme.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ order: null as DmeOrderDTO | null }));

vi.mock('../../src/features/dme/dme.queries', () => ({
  useDmeOrder: () => ({ data: state.order, isLoading: false, error: null }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { id: 'enc-follow-up' } }),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('../../src/features/visits/shared/components/PageTitle', () => ({
  PageTitle: ({ label }: { label: string }) => <h1>{label}</h1>,
}));

vi.mock('../../src/features/dme/components/DmeOrdersTable', () => ({
  DmeOrdersTable: () => null,
}));

vi.mock('../../src/features/dme/components/DmeOrderForm', () => ({
  DmeOrderForm: ({ onFinished, onCancel }: { onFinished: (id: string) => void; onCancel: () => void }) => (
    <>
      <button onClick={() => onFinished('order-1')}>save</button>
      <button onClick={onCancel}>cancel</button>
    </>
  ),
}));

vi.mock('../../src/features/dme/components/DmeOrderDetails', () => ({
  DmeOrderDetails: ({ onEdit, onDeleted }: { onEdit: () => void; onDeleted: () => void }) => (
    <>
      <button onClick={onEdit}>edit</button>
      <button onClick={onDeleted}>deleted</button>
    </>
  ),
}));

import { DmeOrderCreatePage } from '../../src/features/dme/pages/DmeOrderCreatePage';
import { DmeOrderDetailsPage } from '../../src/features/dme/pages/DmeOrderDetailsPage';
import { DmeOrderEditPage } from '../../src/features/dme/pages/DmeOrderEditPage';
import { DmeOrdersPage } from '../../src/features/dme/pages/DmeOrdersPage';

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

const FOLLOW_UP = '?encounterId=enc-follow-up';

const CurrentLocation = (): ReactElement => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const renderAt = (url: string): void => {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/in-person/:id/dme" element={<DmeOrdersPage />} />
        <Route path="/in-person/:id/dme/create" element={<DmeOrderCreatePage />} />
        <Route path="/in-person/:id/dme/:dmeOrderId/order-details" element={<DmeOrderDetailsPage />} />
        <Route path="/in-person/:id/dme/:dmeOrderId/edit" element={<DmeOrderEditPage />} />
      </Routes>
      <CurrentLocation />
    </MemoryRouter>
  );
};

const location = (): string | null => screen.getByTestId('location').textContent;

describe('DME navigation keeps the selected follow-up encounter', () => {
  beforeEach(() => {
    state.order = order;
  });

  it('carries it from the list to the create page', async () => {
    renderAt(`/in-person/appt1/dme${FOLLOW_UP}`);
    await userEvent.click(screen.getByTestId(dataTestIds.dmeOrders.newOrderButton));
    expect(location()).toBe(`/in-person/appt1/dme/create${FOLLOW_UP}`);
  });

  it('carries it back to the list after creating and in the breadcrumb', async () => {
    renderAt(`/in-person/appt1/dme/create${FOLLOW_UP}`);
    expect(screen.getByRole('link', { name: 'Durable Medical Equipment' })).toHaveAttribute(
      'href',
      `/in-person/appt1/dme${FOLLOW_UP}`
    );
    await userEvent.click(screen.getByRole('button', { name: 'save' }));
    expect(location()).toBe(`/in-person/appt1/dme${FOLLOW_UP}`);
  });

  it('carries it from the details page to edit and back to the list', async () => {
    renderAt(`/in-person/appt1/dme/order-1/order-details${FOLLOW_UP}`);
    await userEvent.click(screen.getByRole('button', { name: 'edit' }));
    expect(location()).toBe(`/in-person/appt1/dme/order-1/edit${FOLLOW_UP}`);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));
    expect(location()).toBe(`/in-person/appt1/dme/order-1/order-details${FOLLOW_UP}`);

    await userEvent.click(screen.getByRole('button', { name: 'deleted' }));
    expect(location()).toBe(`/in-person/appt1/dme${FOLLOW_UP}`);
  });

  it('carries it back from a missing order', async () => {
    state.order = null;
    renderAt(`/in-person/appt1/dme/order-1/order-details${FOLLOW_UP}`);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(location()).toBe(`/in-person/appt1/dme${FOLLOW_UP}`);
  });

  it('adds no encounter param when the chart was opened without one', async () => {
    renderAt('/in-person/appt1/dme');
    await userEvent.click(screen.getByTestId(dataTestIds.dmeOrders.newOrderButton));
    expect(location()).toBe('/in-person/appt1/dme/create');
  });
});
