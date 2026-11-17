import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ENCOUNTER_ID = 'enc-1';
const patient = { resourceType: 'Patient', id: 'patient-1', name: [{ given: ['Perseus'], family: 'Abingdon' }] };
const featureFlags = vi.hoisted(() => ({}) as { DME_ORDERS_ENABLED?: boolean });

vi.mock('src/constants/feature-flags', async () => {
  const actual = await vi.importActual<typeof import('src/constants/feature-flags')>('src/constants/feature-flags');
  return { ...actual, FEATURE_FLAGS: Object.assign(featureFlags, actual.FEATURE_FLAGS) };
});

vi.mock('src/components/input/PatientSelectInput', () => ({ PatientSelectInput: () => null }));
vi.mock('src/components/input/EmployeeSelectInput', () => ({ EmployeeSelectInput: () => null }));
vi.mock('src/components/input/LocationSelectInput', () => ({ LocationSelectInput: () => null }));
vi.mock('src/features/visits/in-person/hooks/useTasks', () => ({
  useCreateManualTask: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ patient, encounter: { resourceType: 'Encounter', id: ENCOUNTER_ID } }),
}));
vi.mock('src/hooks/useGetPatientVisitHistory', () => ({
  useGetPatientVisitHistory: () => ({
    data: { visits: [{ appointmentId: 'appt-1', type: 'walk-in', dateTime: '2026-11-13T20:45:00Z' }] },
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
  useGetImmunizationOrders: ({ encounterIds }: { encounterIds?: string[] }) => ({
    data: encounterIds?.includes(ENCOUNTER_ID)
      ? {
          orders: [
            { id: 'imm-1', status: 'pending', details: { medication: { id: 'm-1', name: 'Tdap' } } },
            { id: 'imm-2', status: 'cancelled', details: { medication: { id: 'm-2', name: 'MMR' } } },
          ],
        }
      : undefined,
    isLoading: false,
  }),
}));
vi.mock('src/features/dme/dme.queries', () => ({
  useDmeOrders: (encounterId: string) => ({
    data: encounterId === ENCOUNTER_ID ? [{ id: 'dme-1', encounterId, itemName: 'Crutches' }] : undefined,
    isLoading: false,
  }),
}));

import { CreateTaskDialog } from '../../src/features/tasks/components/CreateTaskDialog';

const renderAt = (pathname: string): void => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[pathname]}>
        <Routes>
          <Route
            path="/in-person/:id/*"
            element={
              <Routes>
                <Route
                  element={
                    <>
                      <CreateTaskDialog open handleClose={vi.fn()} />
                      <Outlet />
                    </>
                  }
                >
                  <Route path="progress-note" element={null} />
                  <Route path="immunization/order/:orderId" element={null} />
                  <Route path="dme/:dmeOrderId/order-details" element={null} />
                </Route>
              </Routes>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const categoryInput = (): HTMLElement => screen.getByRole('combobox', { name: /^Category/ });
const orderInput = (): HTMLElement => screen.getByRole('combobox', { name: /^Order/ });

const optionsOf = async (input: HTMLElement): Promise<string[]> => {
  await userEvent.click(input);
  return within(await screen.findByRole('listbox'))
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');
};

const choose = async (input: HTMLElement, option: string): Promise<void> => {
  await userEvent.click(input);
  await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: option }));
};

describe('New Task order categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featureFlags.DME_ORDERS_ENABLED = true;
  });

  it('lists DME and Immunization alphabetically among the order categories', async () => {
    renderAt('/in-person/appt-1/progress-note');

    expect((await optionsOf(categoryInput())).slice(0, 4)).toEqual([
      'DME',
      'External Lab',
      'Immunization',
      'In-house Lab',
    ]);
  });

  it('leaves DME out of the categories while DME orders are disabled', async () => {
    featureFlags.DME_ORDERS_ENABLED = false;
    renderAt('/in-person/appt-1/progress-note');

    expect(await optionsOf(categoryInput())).not.toContain('DME');
  });

  it.each([
    ['Immunization', 'Tdap'],
    ['DME', 'Crutches'],
  ])("offers the visit's %s orders once that category is chosen", async (category, order) => {
    renderAt('/in-person/appt-1/progress-note');

    await choose(categoryInput(), category);

    expect(await optionsOf(orderInput())).toEqual([order]);
  });

  it('leaves cancelled immunization orders out', async () => {
    renderAt('/in-person/appt-1/progress-note');

    await choose(categoryInput(), 'Immunization');

    expect(await optionsOf(orderInput())).not.toContain('MMR');
  });

  it('drops the chosen order when the category changes', async () => {
    renderAt('/in-person/appt-1/progress-note');

    await choose(categoryInput(), 'Immunization');
    await choose(orderInput(), 'Tdap');
    await choose(categoryInput(), 'DME');
    await choose(categoryInput(), 'Immunization');

    expect(orderInput()).toHaveValue('');
  });

  it.each([
    ['/in-person/appt-1/immunization/order/imm-1', 'Immunization', 'Tdap'],
    ['/in-person/appt-1/dme/dme-1/order-details', 'DME', 'Crutches'],
  ])('prefills the category and order when opened from %s', async (pathname, category, order) => {
    renderAt(pathname);

    expect(categoryInput()).toHaveValue(category);
    expect(orderInput()).toHaveValue(order);
  });
});
