import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DmeOrderDTO, DmeOrderStatus } from 'utils/lib/types/api/dme.types';
import { InPersonAppointmentInformation } from 'utils/lib/types/data/appointments/appointments.types';
import { OrdersForTrackingBoardRow } from 'utils/lib/types/data/orders/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdersIconsToolTip } from '../../src/features/visits/shared/components/OrdersIconsToolTip';

const { flags } = vi.hoisted(() => ({ flags: { dme: true } }));

vi.mock('src/constants/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/constants/feature-flags')>();
  return {
    ...actual,
    FEATURE_FLAGS: {
      ...actual.FEATURE_FLAGS,
      get DME_ORDERS_ENABLED() {
        return flags.dme;
      },
    },
  };
});

const appointment = { id: 'appt-1', encounterId: 'enc-1' } as InPersonAppointmentInformation;

const pendingDmeOrder: DmeOrderDTO = {
  id: 'dr-1',
  encounterId: 'enc-1',
  itemName: 'Knee brace',
  diagnoses: [],
  quantity: 1,
  billingCodes: [],
  external: false,
  status: DmeOrderStatus.pending,
  orderedBy: { practitionerId: 'pr-1', name: 'Dana Doc' },
  orderedAt: '2026-10-16T10:00:00Z',
};

const rowWith = (dmeOrders: DmeOrderDTO[] | undefined): OrdersForTrackingBoardRow => ({
  inHouseLabOrders: undefined,
  externalLabOrders: undefined,
  nursingOrders: undefined,
  inHouseMedications: undefined,
  radiologyOrders: undefined,
  erxOrders: undefined,
  procedures: undefined,
  immunizationOrders: undefined,
  dmeOrders,
});

const renderTooltip = (orders: OrdersForTrackingBoardRow): ReturnType<typeof render> =>
  render(
    <MemoryRouter>
      <OrdersIconsToolTip appointment={appointment} orders={orders} />
    </MemoryRouter>
  );

describe('OrdersIconsToolTip DME orders', () => {
  beforeEach(() => {
    flags.dme = true;
  });

  it('links a pending DME order icon to the visit DME orders page', () => {
    renderTooltip(rowWith([pendingDmeOrder]));
    expect(screen.getByRole('link')).toHaveAttribute('href', '/in-person/appt-1/dme?encounterId=enc-1');
  });

  it('shows nothing for DME when there are no pending orders', () => {
    const { container } = renderTooltip(rowWith(undefined));
    expect(container).toBeEmptyDOMElement();
  });

  it('hides the DME icon when the feature is off', () => {
    flags.dme = false;
    renderTooltip(rowWith([pendingDmeOrder]));
    expect(screen.queryByRole('link')).toBeNull();
  });
});
