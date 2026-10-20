import { render } from '@testing-library/react';
import { Patient } from 'fhir/r4b';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let loadedPatient: Patient | undefined;
const useGetPatient = vi.fn((_patientId?: string) => ({ patient: loadedPatient }));
const dialogProps = vi.fn();

vi.mock('../../src/hooks/useGetPatient', () => ({
  useGetPatient: (patientId?: string) => useGetPatient(patientId),
}));

vi.mock('../../src/features/tasks/common', () => ({
  getPatientLabel: (patient: Patient) => `label-${patient.id}`,
}));

vi.mock('../../src/features/tasks/components/CreateTaskDialog', () => ({
  CreateTaskDialog: (props: unknown) => {
    dialogProps(props);
    return null;
  },
}));

import { CommandPaletteCreateTask } from '../../src/components/CommandPaletteCreateTask';
import { useCommandPaletteStore } from '../../src/state/command-palette.store';

const renderAt = (pathname: string): void => {
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <CommandPaletteCreateTask />
    </MemoryRouter>
  );
};

const lastDialogProps = (): { appointmentId?: string; initialPatient?: { id: string; name: string } } =>
  dialogProps.mock.calls.at(-1)?.[0];

describe('CommandPaletteCreateTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadedPatient = undefined;
    useCommandPaletteStore.setState({ createTaskDialogOpen: true });
  });

  it('prefills the patient from the patient record', () => {
    loadedPatient = { resourceType: 'Patient', id: 'patient-1' };

    renderAt('/patient/patient-1/info');

    expect(useGetPatient).toHaveBeenCalledWith('patient-1');
    expect(lastDialogProps()).toMatchObject({
      appointmentId: undefined,
      initialPatient: { id: 'patient-1', name: 'label-patient-1' },
    });
  });

  it('does not prefill a loaded patient that belongs to a different route', () => {
    loadedPatient = { resourceType: 'Patient', id: 'previous-patient' };

    renderAt('/patient/patient-1');

    expect(lastDialogProps().initialPatient).toBeUndefined();
  });

  it.each(['/in-person/appt-1/progress-note', '/visit/appt-1'])('prefills the visit from %s', (pathname) => {
    renderAt(pathname);

    expect(useGetPatient).toHaveBeenCalledWith(undefined);
    expect(lastDialogProps()).toMatchObject({ appointmentId: 'appt-1', initialPatient: undefined });
  });

  it('renders nothing and loads no patient while closed', () => {
    useCommandPaletteStore.setState({ createTaskDialogOpen: false });

    renderAt('/patient/patient-1');

    expect(useGetPatient).toHaveBeenCalledWith(undefined);
    expect(dialogProps).not.toHaveBeenCalled();
  });
});
