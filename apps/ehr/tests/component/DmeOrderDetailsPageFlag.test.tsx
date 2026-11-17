import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DmeOrderDTO, DmeOrderStatus } from 'utils/lib/types/api/dme.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ flagEnabled: true }));

vi.mock('../../src/constants/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/constants/feature-flags')>();
  return {
    ...actual,
    FEATURE_FLAGS: {
      ...actual.FEATURE_FLAGS,
      get DME_ORDERS_ENABLED() {
        return state.flagEnabled;
      },
    },
  };
});

const order: DmeOrderDTO = {
  id: 'order-1',
  encounterId: 'enc1',
  itemName: 'Knee brace',
  diagnoses: [],
  quantity: 1,
  billingCodes: [],
  external: false,
  status: DmeOrderStatus.pending,
  orderedBy: { practitionerId: 'p1', name: 'Dr. Ordering' },
  orderedAt: '2026-10-16T10:00:00.000Z',
};

vi.mock('../../src/features/dme/dme.queries', () => ({
  useDmeOrder: () => ({ data: order, isLoading: false, error: null }),
  useDmeOrderPdf: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateDmeOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSendDmeOrderFax: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('../../src/features/visits/shared/components/FormsCard', () => ({ FormsCard: () => null }));

import { DmeOrderDetailsPage } from '../../src/features/dme/pages/DmeOrderDetailsPage';

const ids = dataTestIds.dmeOrders.details;

const renderDetails = (): void => {
  render(
    <MemoryRouter initialEntries={['/in-person/appt1/dme/order-1/order-details']}>
      <Routes>
        <Route path="/in-person/:id/dme/:dmeOrderId/order-details" element={<DmeOrderDetailsPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('DmeOrderDetailsPage and the DME feature flag', () => {
  beforeEach(() => {
    state.flagEnabled = true;
  });

  it('offers edit, delete and dispense while DME is enabled', () => {
    renderDetails();
    expect(screen.getByTestId(ids.editButton)).toBeInTheDocument();
    expect(screen.getByTestId(ids.deleteButton)).toBeInTheDocument();
    expect(screen.getByTestId(ids.dispenseButton)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Durable Medical Equipment' })).toHaveAttribute(
      'href',
      '/in-person/appt1/dme'
    );
  });

  it('keeps dispense but blocks edit and delete once DME is disabled', () => {
    state.flagEnabled = false;
    renderDetails();
    expect(screen.getByTestId(ids.title)).toHaveTextContent('Knee brace');
    expect(screen.getByTestId(ids.printButton)).toBeInTheDocument();
    expect(screen.queryByTestId(ids.editButton)).not.toBeInTheDocument();
    expect(screen.queryByTestId(ids.deleteButton)).not.toBeInTheDocument();
    expect(screen.getByTestId(ids.dispenseButton)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Durable Medical Equipment' })).not.toBeInTheDocument();
  });
});
