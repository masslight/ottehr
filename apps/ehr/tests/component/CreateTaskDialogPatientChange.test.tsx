import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createManualTask = vi.hoisted(() => vi.fn());
const loading = vi.hoisted(() => ({ visitData: false, visitHistory: false }));

const patients = {
  a: { resourceType: 'Patient', id: 'patient-a', name: [{ given: ['Alice'], family: 'Alpha' }] },
  b: { resourceType: 'Patient', id: 'patient-b', name: [{ given: ['Bob'], family: 'Beta' }] },
};
const visitsByPatient: Record<string, { appointmentId: string; type: string; dateTime: string }[]> = {
  'patient-a': [{ appointmentId: 'appt-a', type: 'walk-in', dateTime: '2026-11-10T15:00:00Z' }],
  'patient-b': [{ appointmentId: 'appt-b', type: 'walk-in', dateTime: '2026-11-12T15:00:00Z' }],
};
const visitData: Record<string, unknown> = {
  'appt-a': {
    patient: patients.a,
    encounter: { resourceType: 'Encounter', id: 'enc-a' },
    location: { resourceType: 'Location', id: 'loc-1', name: 'Main Clinic' },
  },
  'appt-b': {
    patient: patients.b,
    encounter: { resourceType: 'Encounter', id: 'enc-b' },
    location: { resourceType: 'Location', id: 'loc-1', name: 'Main Clinic' },
  },
};

vi.mock('src/components/input/PatientSelectInput', async () => {
  const { useFormContext } = await vi.importActual<typeof import('react-hook-form')>('react-hook-form');
  return {
    PatientSelectInput: ({ name }: { name: string }) => {
      const { setValue } = useFormContext();
      return (
        <div>
          <button type="button" onClick={() => setValue(name, { id: 'patient-a', name: 'Alice Alpha' })}>
            pick patient A
          </button>
          <button type="button" onClick={() => setValue(name, { id: 'patient-b', name: 'Bob Beta' })}>
            pick patient B
          </button>
        </div>
      );
    },
  };
});
vi.mock('src/components/input/EmployeeSelectInput', () => ({ EmployeeSelectInput: () => null }));
vi.mock('src/components/input/LocationSelectInput', async () => {
  const { useFormContext } = await vi.importActual<typeof import('react-hook-form')>('react-hook-form');
  return {
    LocationSelectInput: ({ name }: { name: string }) => {
      const { setValue } = useFormContext();
      return (
        <button type="button" onClick={() => setValue(name, { id: 'loc-1', name: 'Main Clinic' })}>
          pick location
        </button>
      );
    },
  };
});
vi.mock('src/features/visits/in-person/hooks/useTasks', () => ({
  useCreateManualTask: () => ({ mutateAsync: createManualTask }),
}));
vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: (appointmentId?: string) => {
    const { id: appointmentIdFromUrl } = useParams();
    if (loading.visitData) return {};
    return visitData[appointmentId ?? appointmentIdFromUrl ?? ''] ?? {};
  },
}));
vi.mock('src/hooks/useGetPatientVisitHistory', () => ({
  useGetPatientVisitHistory: (patientId?: string) => ({
    data: patientId && !loading.visitHistory ? { visits: visitsByPatient[patientId] ?? [] } : undefined,
    isLoading: loading.visitHistory,
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

const renderDialog = (pathname: string, initialPatient?: { id: string; name: string }): void => {
  const dialog = <CreateTaskDialog open handleClose={vi.fn()} initialPatient={initialPatient} />;
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

const visitInput = (): HTMLInputElement => screen.getByRole('combobox', { name: /^Visit/ }) as HTMLInputElement;

const choose = async (label: RegExp, option: string | RegExp): Promise<void> => {
  await userEvent.click(screen.getByRole('combobox', { name: label }));
  await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: option }));
};

const createTask = async (): Promise<Record<string, unknown>> => {
  await choose(/^Category/, 'Other');
  await userEvent.type(screen.getByRole('textbox', { name: /^Title/ }), 'Call back');
  await userEvent.click(screen.getByRole('button', { name: 'pick location' }));
  await userEvent.click(screen.getByRole('button', { name: 'Create new task' }));
  expect(createManualTask).toHaveBeenCalledTimes(1);
  return createManualTask.mock.calls[0][0];
};

describe('New Task patient change', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loading.visitData = false;
    loading.visitHistory = false;
  });

  it('clears the visit picked for one patient when another patient is chosen', async () => {
    renderDialog('/tasks');

    await userEvent.click(screen.getByRole('button', { name: 'pick patient A' }));
    await choose(/^Visit/, /11\/10\/2026/);
    expect(visitInput().value).toMatch(/11\/10\/2026/);

    await userEvent.click(screen.getByRole('button', { name: 'pick patient B' }));

    expect(visitInput().value).toBe('');
  });

  it('keeps the visit picked when the same patient is chosen again', async () => {
    renderDialog('/tasks');

    await userEvent.click(screen.getByRole('button', { name: 'pick patient A' }));
    await choose(/^Visit/, /11\/10\/2026/);
    await userEvent.click(screen.getByRole('button', { name: 'pick patient A' }));

    expect(visitInput().value).toMatch(/11\/10\/2026/);
  });

  it('keeps the patient and visit of the chart the dialog is opened from', async () => {
    renderDialog('/in-person/appt-a/progress-note');

    expect(visitInput().value).toMatch(/11\/10\/2026/);
    const task = await createTask();
    expect(task).toMatchObject({ appointmentId: 'appt-a', encounterId: 'enc-a' });
  });

  it("does not link the chart visit's encounter to a task for another patient", async () => {
    renderDialog('/in-person/appt-a/progress-note');
    expect(visitInput().value).toMatch(/11\/10\/2026/);

    await userEvent.click(screen.getByRole('button', { name: 'pick patient B' }));
    const task = await createTask();

    expect(task.patient).toEqual({ id: 'patient-b', name: 'Bob Beta' });
    expect(task.appointmentId ?? undefined).toBeUndefined();
    expect(task.encounterId).toBeUndefined();
  });

  it('keeps the chart visit when its data arrives after another patient was already set', async () => {
    loading.visitData = true;
    renderDialog('/in-person/appt-a/progress-note', { id: 'patient-b', name: 'Bob Beta' });

    loading.visitData = false;
    await userEvent.click(screen.getByRole('button', { name: 'pick location' }));
    expect(visitInput().value).toMatch(/11\/10\/2026/);

    const task = await createTask();
    expect(task).toMatchObject({
      patient: { id: 'patient-a' },
      appointmentId: 'appt-a',
      encounterId: 'enc-a',
    });
  });

  it('drops the progress note section of the chart visit when another patient is chosen', async () => {
    renderDialog('/in-person/appt-a/vitals');
    expect(screen.getByRole('combobox', { name: /^Progress Note section/ })).toHaveValue('Vitals');

    await userEvent.click(screen.getByRole('button', { name: 'pick patient B' }));
    const task = await createTask();

    expect(task.progressNoteSection ?? undefined).toBeUndefined();
  });

  it("links the chart visit's encounter while the patient's visit history is still loading", async () => {
    loading.visitHistory = true;
    renderDialog('/in-person/appt-a/progress-note');

    const task = await createTask();

    expect(task).toMatchObject({ appointmentId: 'appt-a', encounterId: 'enc-a' });
  });
});
