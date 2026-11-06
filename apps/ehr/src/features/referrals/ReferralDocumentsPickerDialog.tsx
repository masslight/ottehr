import { Box, Typography } from '@mui/material';
import { FC, useCallback, useMemo, useState } from 'react';
import { CustomDialog } from 'src/components/dialogs/CustomDialog';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PatientDocumentsExplorer } from 'src/features/visits/shared/components/patient/docs/PatientDocumentsExplorer';
import { PatientDocumentInfo } from 'src/hooks/useGetPatientDocs';
import { usePatientVisitOptions } from 'src/hooks/usePatientVisitOptions';
import { isReferralDocumentFolderAllowed, REFERRAL_DOCUMENT_FOLDERS } from 'utils/lib/fhir/referral';
import { ReferralEarlierDocument } from 'utils/lib/types/api/referrals/referrals.types';

const isDocumentAllowed = (folderName: string, document: PatientDocumentInfo): boolean =>
  isReferralDocumentFolderAllowed(folderName, !!document.isLabResult);

interface ReferralDocumentsPickerDialogProps {
  patientId: string;
  /** The referral's own visit: its documents are the "This visit" checkboxes, so the picker leaves them out. */
  encounterId?: string;
  selected: ReferralEarlierDocument[];
  onClose: () => void;
  onAdd: (documents: ReferralEarlierDocument[]) => void;
}

/** The Patient Docs view as a picker, limited to the folders a referral sends from. Mounted only while open. */
export const ReferralDocumentsPickerDialog: FC<ReferralDocumentsPickerDialogProps> = ({
  patientId,
  encounterId,
  selected,
  onClose,
  onAdd,
}) => {
  const { visitsByEncounterId, visitsByAppointmentId } = usePatientVisitOptions(patientId);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => selected.map((document) => document.id));
  const [documentsById, setDocumentsById] = useState<ReadonlyMap<string, PatientDocumentInfo>>(new Map());

  const onSelectionChange = useCallback((ids: string[], documents: ReadonlyMap<string, PatientDocumentInfo>): void => {
    setSelectedIds(ids);
    setDocumentsById(documents);
  }, []);

  // Read once: the explorer takes its initial selection and preset when it mounts.
  const picker = useMemo(
    () => ({
      folderNames: REFERRAL_DOCUMENT_FOLDERS,
      isDocumentAllowed,
      excludeEncounterId: encounterId,
      initialSelectedIds: selected.map((document) => document.id),
      // A referral from the patient record starts from the latest visit; a visit referral starts empty.
      preselectLatestVisit: !encounterId && selected.length === 0,
      onSelectionChange,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleAdd = (): void => {
    const toChip = (id: string): ReferralEarlierDocument | undefined => {
      const document = documentsById.get(id);
      if (!document) return selected.find((chip) => chip.id === id);
      const visit =
        (document.encounterId ? visitsByEncounterId.get(document.encounterId) : undefined) ??
        (document.appointmentId ? visitsByAppointmentId.get(document.appointmentId) : undefined);
      return { id, title: document.docName, date: document.whenAddedDate, visitDate: visit?.dateTime };
    };
    // Chips keep the order they were chosen in: the ones already on the form first, then the new ones.
    const kept = selected.map((chip) => chip.id).filter((id) => selectedIds.includes(id));
    const added = selectedIds.filter((id) => !kept.includes(id));
    onAdd([...kept, ...added].map(toChip).filter((chip): chip is ReferralEarlierDocument => !!chip));
  };

  return (
    <CustomDialog
      open
      handleClose={onClose}
      title="Add documents to referral"
      maxWidth="lg"
      fullWidth
      dataTestId={dataTestIds.referrals.documentsPicker}
      description={<PatientDocumentsExplorer patientId={patientId} picker={picker} />}
      actions={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
            {selectedIds.length} {selectedIds.length === 1 ? 'document' : 'documents'} selected
          </Typography>
          <RoundedButton onClick={onClose}>Cancel</RoundedButton>
          <RoundedButton
            variant="contained"
            onClick={handleAdd}
            data-testid={dataTestIds.referrals.documentsPickerAddButton}
          >
            Add
          </RoundedButton>
        </Box>
      }
    />
  );
};
