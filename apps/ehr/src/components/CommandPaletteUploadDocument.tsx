import { useQueryClient } from '@tanstack/react-query';
import { FC, useEffect } from 'react';
import { UploadDocumentDialog } from '../features/visits/shared/components/patient/docs/UploadDocumentDialog';
import { useAppointmentData } from '../features/visits/shared/stores/appointment/appointment.store';
import { useApiClients } from '../hooks/useAppClients';
import { useCommandPaletteRouteContext } from '../hooks/useCommandPaletteRouteContext';
import { prefetchPatientDocsFolders } from '../hooks/useGetPatientDocs';
import { useCommandPaletteStore } from '../state/command-palette.store';

/**
 * Mounts the upload/scan dialog at App level so the command palette's "Upload" and "Scan" actions open it
 * over the current screen without navigating. On a visit page the document is also filed against the
 * visit's encounter (the follow-up note's, when one is open). Rendered only while open.
 */
export const CommandPaletteUploadDocument: FC = () => {
  const mode = useCommandPaletteStore((state) => state.uploadDocumentMode);
  const setUploadDocumentMode = useCommandPaletteStore((state) => state.setUploadDocumentMode);
  const { visitId, patientId: routePatientId } = useCommandPaletteRouteContext();
  const { patient, encounter } = useAppointmentData(visitId);
  const patientId = visitId ? patient?.id : routePatientId;

  // Load the patient's folders as the palette opens, so Upload/Scan show them without a wait.
  const paletteIsOpen = useCommandPaletteStore((state) => state.isOpen);
  const queryClient = useQueryClient();
  const { oystehr } = useApiClients();
  useEffect(() => {
    if (paletteIsOpen && patientId && oystehr) prefetchPatientDocsFolders(queryClient, oystehr, patientId);
  }, [paletteIsOpen, patientId, oystehr, queryClient]);

  if (!mode || !patientId) {
    return null;
  }

  return (
    <UploadDocumentDialog
      open
      mode={mode}
      onClose={() => setUploadDocumentMode(null)}
      patientId={patientId}
      encounterId={visitId ? encounter?.id : undefined}
    />
  );
};
