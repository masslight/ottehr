import { FC, useMemo } from 'react';
import { getPatientLabel } from '../features/tasks/common';
import { CreateTaskDialog } from '../features/tasks/components/CreateTaskDialog';
import { useCommandPaletteRouteContext } from '../hooks/useCommandPaletteRouteContext';
import { useGetPatient } from '../hooks/useGetPatient';
import { useCommandPaletteStore } from '../state/command-palette.store';

/**
 * Mounts the create-task dialog at App level so the command palette's
 * "Create Task" action can open it from anywhere without navigating.
 * Prefills the visit on visit pages (in-person progress note and visit details)
 * and the patient on patient-chart pages.
 * Rendered only while open: the dialog fires several option-loading queries
 * as soon as it mounts.
 */
export const CommandPaletteCreateTask: FC = () => {
  const open = useCommandPaletteStore((state) => state.createTaskDialogOpen);
  const setCreateTaskDialogOpen = useCommandPaletteStore((state) => state.setCreateTaskDialogOpen);
  const { visitId, patientId } = useCommandPaletteRouteContext();
  const { patient } = useGetPatient(open ? patientId : undefined);

  const initialPatient = useMemo(
    () => (patient?.id ? { id: patient.id, name: getPatientLabel(patient) } : undefined),
    [patient]
  );

  if (!open) {
    return null;
  }

  return (
    <CreateTaskDialog
      open
      handleClose={() => setCreateTaskDialogOpen(false)}
      appointmentId={visitId}
      initialPatient={initialPatient}
    />
  );
};
