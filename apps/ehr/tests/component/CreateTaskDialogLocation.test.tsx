import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createManualTask = vi.hoisted(() => vi.fn());
const patient = { resourceType: 'Patient', id: 'patient-1', name: [{ given: ['Perseus'], family: 'Abingdon' }] };

const visitLocations: Record<string, string> = {
  'appt-open': 'Open Visit Clinic',
};

vi.mock('src/components/input/PatientSelectInput', () => ({ PatientSelectInput: () => null }));
vi.mock('src/components/input/EmployeeSelectInput', () => ({ EmployeeSelectInput: () => null }));
vi.mock('src/components/input/LocationSelectInput', async () => {
  const { useFormContext, useWatch } = await vi.importActual<typeof import('react-hook-form')>('react-hook-form');
  return {
    LocationSelectInput: ({ name, required }: { name: string; required?: boolean }) => {
      const { setValue } = useFormContext();
      const value = useWatch({ name });
      return (
        <div>
          <span data-testid="location-value">{value?.name ?? ''}</span>
          <span data-testid="location-required">{String(!!required)}</span>
          <button type="button" onClick={() => setValue(name, null)}>
            clear location
          </button>
        </div>
      );
    },
  };
});
vi.mock('src/features/visits/in-person/hooks/useTasks', () => ({
  useCreateManualTask: () => ({ mutateAsync: createManualTask }),
}));
vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: (appointmentId?: string) => {
    if (!appointmentId || !visitLocations[appointmentId]) return { isLoading: false };
    return {
      patient: appointmentId === 'appt-open' ? patient : undefined,
      encounter: { resourceType: 'Encounter', id: `enc-${appointmentId}` },
      location: { resourceType: 'Location', id: `loc-${appointmentId}`, name: visitLocations[appointmentId] },
      isLoading: false,
    };
  },
}));
vi.mock('src/hooks/useGetPatientVisitHistory', () => ({
  useGetPatientVisitHistory: () => ({
    data: { visits: [{ appointmentId: 'appt-open', type: 'walk-in', dateTime: '2026-11-10T20:45:00Z' }] },
    isLoading: false,
  }),
}));
vi.mock('src/features/external-labs/components/labs-orders/usePatientLabOrders', () => ({
  usePatientLabOrders: () => ({ groupedLabOrdersForChartTable: undefined, loading: false }),
}));
vi.mock('src/features/in-house-labs/components/orders/useInHouseLabOrders', () => ({
  useInHouseLabOrders: () => ({ labOrders: [], loading: false }),
}));
vi.mock('src/features/nursing-orders/components/orders/useNursingOrders', () => ({
  useGetNursingOrders: () => ({ nursingOrders: [], loading: false }),
}));
vi.mock('src/features/radiology/components/usePatientRadiologyOrders', () => ({
  usePatientRadiologyOrders: () => ({ orders: [], loading: false }),
}));
vi.mock('src/features/visits/shared/hooks/useChartData', () => ({
  useChartData: () => ({ chartData: undefined, isLoading: false }),
}));
vi.mock('src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetMedicationOrders: () => ({ data: undefined, isLoading: false }),
}));
vi.mock('src/features/visits/in-person/hooks/useImmunization', () => ({
  useGetImmunizationOrders: () => ({ data: undefined, isLoading: false }),
}));
vi.mock('src/features/dme/dme.queries', () => ({
  useDmeOrders: () => ({ data: undefined, isLoading: false }),
}));

import { CreateTaskDialog } from '../../src/features/tasks/components/CreateTaskDialog';

const renderDialog = (pathname: string): void => {
  const dialog = (
    <CreateTaskDialog open handleClose={vi.fn()} initialPatient={{ id: patient.id, name: 'Perseus Abingdon' }} />
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[pathname]}>
        <Routes>
          <Route path="/tasks" element={dialog} />
          <Route path="/in-person/:id/*" element={dialog} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const choose = async (label: RegExp, option: string): Promise<void> => {
  await userEvent.click(screen.getByRole('combobox', { name: label }));
  await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: option }));
};

const locationValue = (): string => screen.getByTestId('location-value').textContent ?? '';

describe('New Task location', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a task with only a category and a title, without a location', async () => {
    renderDialog('/tasks');

    expect(screen.getByTestId('location-required')).toHaveTextContent('false');
    await choose(/^Category/, 'Other');
    await userEvent.type(screen.getByRole('textbox', { name: /^Title/ }), 'Call the lab');
    await userEvent.click(screen.getByRole('button', { name: 'Create new task' }));

    expect(createManualTask).toHaveBeenCalledTimes(1);
    expect(createManualTask.mock.calls[0][0].location).toBeNull();
  });

  it('prefills the location of the visit the dialog is opened from', async () => {
    renderDialog('/in-person/appt-open/progress-note');

    expect(await screen.findByText('Open Visit Clinic')).toBeInTheDocument();
  });

  it('keeps the prefilled location cleared once staff clear it', async () => {
    renderDialog('/in-person/appt-open/progress-note');
    expect(await screen.findByText('Open Visit Clinic')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'clear location' }));
    await choose(/^Category/, 'Other');

    expect(locationValue()).toBe('');
  });
});
