import { useQueryClient } from '@tanstack/react-query';
import { FC, useEffect, useRef } from 'react';
import { UploadDocumentDialog } from '../features/visits/shared/components/patient/docs/UploadDocumentDialog';
import { useApiClients } from '../hooks/useAppClients';
import { useCommandPaletteDocumentTarget } from '../hooks/useCommandPaletteDocumentTarget';
import { prefetchPatientDocsFolders } from '../hooks/useGetPatientDocs';
import { useCommandPaletteStore } from '../state/command-palette.store';

interface UploadContext {
  visitId?: string;
  routePatientId?: string;
  encounterId?: string;
}

// An encounter appearing as the visit loads isn't a switch; one follow-up giving way to another is.
const hasUploadContextChanged = (previous: UploadContext, next: UploadContext): boolean =>
  previous.visitId !== next.visitId ||
  previous.routePatientId !== next.routePatientId ||
  (!!previous.encounterId && !!next.encounterId && previous.encounterId !== next.encounterId);

export const CommandPaletteUploadDocument: FC = () => {
  const mode = useCommandPaletteStore((state) => state.uploadDocumentMode);
  const setUploadDocumentMode = useCommandPaletteStore((state) => state.setUploadDocumentMode);
  const { visitId, routePatientId, patientId, encounterId } = useCommandPaletteDocumentTarget();

  // A dialog left open across navigation must not file into another patient, visit or follow-up.
  const context = useRef({ visitId, routePatientId, encounterId });
  const contextChanged = hasUploadContextChanged(context.current, { visitId, routePatientId, encounterId });
  useEffect(() => {
    const previous = context.current;
    context.current = { visitId, routePatientId, encounterId };
    if (hasUploadContextChanged(previous, context.current)) setUploadDocumentMode(null);
  }, [visitId, routePatientId, encounterId, setUploadDocumentMode]);

  // A hidden dialog would keep Cmd+K blocked.
  useEffect(() => {
    if (mode && !patientId) setUploadDocumentMode(null);
  }, [mode, patientId, setUploadDocumentMode]);

  const paletteIsOpen = useCommandPaletteStore((state) => state.isOpen);
  const queryClient = useQueryClient();
  const { oystehr } = useApiClients();
  useEffect(() => {
    if (paletteIsOpen && patientId && oystehr) prefetchPatientDocsFolders(queryClient, oystehr, patientId);
  }, [paletteIsOpen, patientId, oystehr, queryClient]);

  if (!mode || !patientId || contextChanged) {
    return null;
  }

  return (
    <UploadDocumentDialog
      open
      mode={mode}
      onClose={() => setUploadDocumentMode(null)}
      patientId={patientId}
      encounterId={encounterId}
    />
  );
};
