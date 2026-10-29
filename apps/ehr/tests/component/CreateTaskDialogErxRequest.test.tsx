import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import { MemoryRouter } from 'react-router-dom';
import { MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it, vi } from 'vitest';

type FieldProps = { name: string; label: string };

// Each input as a plain field on the form, so the test sets values the way a user picks them.
const Field = ({ name, label }: FieldProps): React.JSX.Element => {
  const { setValue } = useFormContext();
  return <input aria-label={label} onChange={(event) => setValue(name, event.target.value || null)} />;
};
const ObjectField = ({ name, label }: FieldProps): React.JSX.Element => {
  const { setValue } = useFormContext();
  return (
    <input
      aria-label={label}
      onChange={(event) => setValue(name, event.target.value ? { id: event.target.value, name: 'x' } : null)}
    />
  );
};

// Rendered later than the mocks are made, so each refers to the field components at render time.
vi.mock('src/components/input/SelectInput', () => ({ SelectInput: (props: FieldProps) => <Field {...props} /> }));
vi.mock('src/components/input/TextInput', () => ({ TextInput: (props: FieldProps) => <Field {...props} /> }));
vi.mock('src/components/input/PatientSelectInput', () => ({
  PatientSelectInput: (props: FieldProps) => <ObjectField {...props} />,
}));
vi.mock('src/components/input/EmployeeSelectInput', () => ({
  EmployeeSelectInput: (props: FieldProps) => <ObjectField {...props} />,
}));
vi.mock('src/components/input/LocationSelectInput', () => ({
  LocationSelectInput: (props: FieldProps) => <ObjectField {...props} />,
  getLocationLabel: () => '',
}));
vi.mock('src/features/visits/in-person/components/InPersonModal', () => ({
  InPersonModal: ({ ContentComponent, disabled }: { ContentComponent: ReactNode; disabled?: boolean }) => (
    <div>
      {ContentComponent}
      <button disabled={disabled}>Create new task</button>
    </div>
  ),
}));
vi.mock('src/features/visits/in-person/hooks/useTasks', () => ({
  useCreateManualTask: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { id: 'encounter-1' } }),
}));
vi.mock('../../src/hooks/useGetPatientVisitHistory', () => ({
  useGetPatientVisitHistory: () => ({ data: { visits: [] }, isLoading: false }),
}));
vi.mock('../../src/features/tasks/common', () => {
  const none = (name: string) => () => ({ [`${name}Loading`]: false, [`${name}Options`]: [] });
  return {
    getPatientLabel: () => '',
    TASK_CATEGORY_LABEL: {},
    useInHouseLabOrdersOptions: none('inHouseLabOrders'),
    useExternalLabOrdersOptions: none('externalLabOrders'),
    useNursingOrdersOptions: none('nursingOrders'),
    useRadiologyOrdersOptions: none('radiologyOrders'),
    useProceduresOptions: none('procedures'),
    useInHouseMedicationsOptions: none('inHouseMedications'),
    usePrescriptionsOptions: () => ({
      prescriptionsLoading: false,
      prescriptionsOptions: [{ id: 'rx-1', label: 'Lisinopril' }],
      compoundPrescriptionIds: [],
    }),
  };
});

import { CreateTaskDialog } from '../../src/features/tasks/components/CreateTaskDialog';

describe('New task: a refill or change request', () => {
  it.each(['Refill request', 'Change request'])('%s can’t be created without a prescription', async (checkbox) => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CreateTaskDialog open handleClose={vi.fn()} />
      </MemoryRouter>
    );
    await user.type(screen.getByLabelText('Category'), MANUAL_TASK.category.erx);
    await user.type(screen.getByLabelText('Title'), 'Refill');
    await user.type(screen.getByLabelText('Location'), 'location-1');
    const create = screen.getByRole('button', { name: 'Create new task' });
    expect(create).toBeEnabled();
    await user.click(screen.getByText(checkbox).previousElementSibling!.querySelector('input')!);
    expect(create).toBeDisabled();
    await user.type(screen.getByLabelText('Prescription'), 'rx-1');
    expect(create).toBeEnabled();
  });
});
