import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock calls MUST come before component imports (Vitest hoists them)

const { mockUseAppointmentAccessibility, mockUseMainEncounterChartData, mockUseChartData } = vi.hoisted(() => ({
  mockUseAppointmentAccessibility: vi.fn(),
  mockUseMainEncounterChartData: vi.fn(),
  mockUseChartData: vi.fn(),
}));

vi.mock('src/features/visits/in-person/hooks/useImmunization', () => ({
  useGetVaccines: () => ({ data: [], isLoading: false }),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({}),
}));

vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: mockUseAppointmentAccessibility,
}));

vi.mock('src/features/visits/shared/hooks/useMainEncounterChartData', () => ({
  useMainEncounterChartData: mockUseMainEncounterChartData,
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useChartData: mockUseChartData,
}));

import { OrderDetailsSection } from '../../src/features/immunization/components/OrderDetailsSection';

const CURRENT_ENCOUNTER_DX = { resourceId: 'cond-current', code: 'J45.909', display: 'Asthma' };
const MAIN_ENCOUNTER_DX = { resourceId: 'cond-main', code: 'O29.011', display: 'Anesthesia complication' };

const renderWithForm = (): void => {
  const queryClient = new QueryClient();
  const Wrapper: React.FC = () => {
    const methods = useForm();
    return (
      <QueryClientProvider client={queryClient}>
        <FormProvider {...methods}>
          <OrderDetailsSection />
        </FormProvider>
      </QueryClientProvider>
    );
  };
  render(<Wrapper />);
};

describe('OrderDetailsSection — Associated Dx options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sources Associated Dx from the current encounter chart data on a non-follow-up visit', async () => {
    mockUseAppointmentAccessibility.mockReturnValue({ visitType: 'in-person' });
    mockUseChartData.mockReturnValue({ chartData: { diagnosis: [CURRENT_ENCOUNTER_DX] } });
    mockUseMainEncounterChartData.mockReturnValue({ data: undefined });

    renderWithForm();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Associated Dx'));

    expect(await screen.findByText('J45.909 - Asthma')).toBeInTheDocument();
    expect(screen.queryByText('O29.011 - Anesthesia complication')).not.toBeInTheDocument();
  });

  it('sources Associated Dx from the main encounter chart data on an annotation follow-up visit', async () => {
    mockUseAppointmentAccessibility.mockReturnValue({ visitType: 'follow-up' });
    mockUseChartData.mockReturnValue({ chartData: { diagnosis: [] } });
    mockUseMainEncounterChartData.mockReturnValue({ data: { diagnosis: [MAIN_ENCOUNTER_DX] } });

    renderWithForm();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Associated Dx'));

    expect(await screen.findByText('O29.011 - Anesthesia complication')).toBeInTheDocument();
  });
});
