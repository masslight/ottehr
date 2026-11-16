import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { VitalsIconTooltip } from 'src/features/visits/shared/components/VitalsIconTooltip';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetVitalsResponseData } from 'utils/lib/types/api/chart-data/get-vitals.types';
import { InPersonAppointmentInformation } from 'utils/lib/types/data/appointments/appointments.types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('src/features/visits/in-person/routing/routesInPerson', () => ({ ROUTER_PATH: { VITALS: 'vitals' } }));
vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

describe('VitalsIconTooltip', () => {
  it('labels an abnormal head circumference "Head circumference"', async () => {
    const headCircumference = {
      field: VitalFieldNames.VitalHeadCircumference,
      value: 50,
      resourceId: 'obs-hc',
      alertCriticality: 'abnormal',
    } as unknown as VitalsObservationDTO;
    const abnormalVitals = {
      [VitalFieldNames.VitalHeadCircumference]: [headCircumference],
    } as unknown as GetVitalsResponseData;
    render(
      <MemoryRouter>
        <VitalsIconTooltip
          appointment={{ id: 'a1' } as InPersonAppointmentInformation}
          abnormalVitals={abnormalVitals}
        />
      </MemoryRouter>
    );
    await userEvent.hover(screen.getByRole('link'));
    expect(await screen.findByText(/Head circumference -/)).toBeInTheDocument();
  });
});
