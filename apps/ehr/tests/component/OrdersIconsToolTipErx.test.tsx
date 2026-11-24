import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { InPersonAppointmentInformation } from 'utils/lib/types/data/appointments/appointments.types';
import { OrdersForTrackingBoardRow } from 'utils/lib/types/data/orders/types';
import { describe, expect, it } from 'vitest';
import { OrdersIconsToolTip } from '../../src/features/visits/shared/components/OrdersIconsToolTip';

const appointment = { id: 'appt-1', encounterId: 'enc-1' } as InPersonAppointmentInformation;
const ERX_SURESCRIPTS_URL = '/in-person/appt-1/erx-surescripts?encounterId=enc-1';
const sent: PrescribedMedicationDTO = { resourceId: 'mr-1', name: 'Cetirizine 5 mg/5 mL solution', status: 'active' };

const rowWith = (
  erxOrders: PrescribedMedicationDTO[] | undefined,
  erxSavedForm: OrdersForTrackingBoardRow['erxSavedForm']
): OrdersForTrackingBoardRow => ({
  inHouseLabOrders: undefined,
  externalLabOrders: undefined,
  nursingOrders: undefined,
  inHouseMedications: undefined,
  radiologyOrders: undefined,
  erxOrders,
  erxSavedForm,
  procedures: undefined,
  immunizationOrders: undefined,
  dmeOrders: undefined,
});

const renderTooltip = (orders: OrdersForTrackingBoardRow): ReturnType<typeof render> =>
  render(
    <MemoryRouter>
      <OrdersIconsToolTip appointment={appointment} orders={orders} />
    </MemoryRouter>
  );

const badge = (container: HTMLElement): Element | null =>
  container.querySelector('.MuiBadge-badge:not(.MuiBadge-invisible)');

// Requirement 53g: a saved eRx form shows on the Tracking Board with the pending dot, and opens eRx (Surescripts).
describe('OrdersIconsToolTip eRx', () => {
  it('shows the eRx icon with the dot for a saved form, even with no prescriptions', () => {
    const { container } = renderTooltip(rowWith(undefined, { lines: ['Amoxicillin 400 mg/5ml Susp'] }));
    expect(screen.getByRole('link')).toHaveAttribute('href', ERX_SURESCRIPTS_URL);
    expect(badge(container)).not.toBeNull();
  });

  it('has no dot for sent prescriptions alone, and opens eRx (Surescripts) for them too', () => {
    const { container } = renderTooltip(rowWith([sent], undefined));
    expect(screen.getByRole('link')).toHaveAttribute('href', ERX_SURESCRIPTS_URL);
    expect(badge(container)).toBeNull();
  });

  it('shows nothing with neither', () => {
    const { container } = renderTooltip(rowWith(undefined, undefined));
    expect(container).toBeEmptyDOMElement();
  });

  it('lists the saved lines as "Saved" beside the sent prescriptions, each opening eRx (Surescripts)', async () => {
    const user = userEvent.setup();
    renderTooltip(rowWith([sent], { lines: ['Amoxicillin 400 mg/5ml Susp'] }));
    await user.hover(screen.getByRole('link'));
    const tooltip = await screen.findByRole('tooltip');
    const savedRow = within(tooltip).getByText('Amoxicillin 400 mg/5ml Susp').closest('a')!;
    expect(within(savedRow).getByText('saved')).toBeInTheDocument();
    expect(savedRow).toHaveAttribute('href', ERX_SURESCRIPTS_URL);
    const sentRow = within(tooltip).getByText('Cetirizine 5 mg/5 mL solution').closest('a')!;
    expect(within(sentRow).getByText('active')).toBeInTheDocument();
    expect(sentRow).toHaveAttribute('href', ERX_SURESCRIPTS_URL);
    expect(within(tooltip).getByText('2 orders')).toBeInTheDocument();
  });
});
