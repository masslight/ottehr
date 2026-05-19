import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useState } from 'react';
import { createDischargeSummary } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { useGetPatientDocs } from 'src/hooks/useGetPatientDocs';
import { useExcusePresignedFiles } from 'src/shared/hooks/useExcusePresignedFiles';
import { SCHOOL_NOTE_CODE, WORK_NOTE_CODE } from 'utils';
import { handleChangeInPersonVisitStatus } from 'src/helpers/inPersonVisitStatusUtils';
import { useChartData } from '../../stores/appointment/appointment.store';

interface DischargeAndPrintDialogProps {
  open: boolean;
  onClose: () => void;
  encounterId: string;
  appointmentId?: string;
  patientId?: string;
  onDischargeSuccess: () => Promise<void>;
}

export const DischargeAndPrintDialog: FC<DischargeAndPrintDialogProps> = ({
  open,
  onClose,
  encounterId,
  appointmentId,
  patientId,
  onDischargeSuccess,
}) => {
  const { oystehrZambda } = useApiClients();
  const { chartData } = useChartData();
  const { downloadDocument } = useGetPatientDocs(patientId ?? '');

  const schoolWorkNotes = chartData?.schoolWorkNotes ?? [];
  const presignedFiles = useExcusePresignedFiles(schoolWorkNotes);
  const instructions = chartData?.instructions ?? [];

  const workNote = presignedFiles.find((file) => file.type === WORK_NOTE_CODE);
  const schoolNote = presignedFiles.find((file) => file.type === SCHOOL_NOTE_CODE);
  const hasWorkNote = Boolean(workNote);
  const hasSchoolNote = Boolean(schoolNote);
  const hasPatientInstructions = instructions.length > 0;
  // Discharge summary is always generatable if appointmentId is present
  const hasDischargeSummary = Boolean(appointmentId);

  const [printDischargeSummary, setPrintDischargeSummary] = useState(true);
  const [printWorkNote, setPrintWorkNote] = useState(true);
  const [printSchoolNote, setPrintSchoolNote] = useState(true);
  const [printPatientInstructions, setPrintPatientInstructions] = useState(true);

  const [isLoading, setIsLoading] = useState(false);

  const handleDischargeAndPrint = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) {
      enqueueSnackbar('API client not available. Please try again.', { variant: 'error' });
      return;
    }

    setIsLoading(true);

    try {
      // Discharge the patient
      await handleChangeInPersonVisitStatus({ encounterId, updatedStatus: 'discharged' }, oystehrZambda);

      // Print selected documents
      const printPromises: Promise<void>[] = [];

      if (printDischargeSummary && hasDischargeSummary && appointmentId) {
        printPromises.push(
          createDischargeSummary(oystehrZambda, { appointmentId })
            .then(async (response) => {
              const documentId = response?.documentId;
              if (documentId) {
                await downloadDocument(documentId);
              } else {
                enqueueSnackbar(
                  'Discharge summary created, but document is not accessible right now. You can find it later in the Patient Record > Review Docs.',
                  { variant: 'info' }
                );
              }
            })
            .catch((error) => {
              console.error('Error creating Discharge Summary:', error);
              enqueueSnackbar('Error creating Discharge Summary.', { variant: 'error' });
            })
        );
      }

      if (printWorkNote && hasWorkNote && workNote?.presignedUrl) {
        window.open(workNote.presignedUrl, '_blank');
      }

      if (printSchoolNote && hasSchoolNote && schoolNote?.presignedUrl) {
        window.open(schoolNote.presignedUrl, '_blank');
      }

      if (printPatientInstructions && hasPatientInstructions) {
        // Patient instructions are text-based (no separate document URL), skip opening new tab
        // They are part of the visit note / discharge summary
      }

      await Promise.all(printPromises);

      await onDischargeSuccess();
      enqueueSnackbar('Patient discharged successfully', { variant: 'success' });
      onClose();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [
    oystehrZambda,
    encounterId,
    printDischargeSummary,
    hasDischargeSummary,
    appointmentId,
    printWorkNote,
    hasWorkNote,
    workNote,
    printSchoolNote,
    hasSchoolNote,
    schoolNote,
    printPatientInstructions,
    hasPatientInstructions,
    downloadDocument,
    onDischargeSuccess,
    onClose,
  ]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Discharge &amp; Print</DialogTitle>
      <DialogContent>
        <Typography gutterBottom>
          Please confirm discharging the patient. Check if you want to print documents:
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={printDischargeSummary && hasDischargeSummary}
                disabled={!hasDischargeSummary}
                onChange={(e) => setPrintDischargeSummary(e.target.checked)}
              />
            }
            label={
              <Typography color={hasDischargeSummary ? 'text.primary' : 'text.disabled'}>Discharge Summary</Typography>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={printWorkNote && hasWorkNote}
                disabled={!hasWorkNote}
                onChange={(e) => setPrintWorkNote(e.target.checked)}
              />
            }
            label={<Typography color={hasWorkNote ? 'text.primary' : 'text.disabled'}>Work Note</Typography>}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={printSchoolNote && hasSchoolNote}
                disabled={!hasSchoolNote}
                onChange={(e) => setPrintSchoolNote(e.target.checked)}
              />
            }
            label={<Typography color={hasSchoolNote ? 'text.primary' : 'text.disabled'}>School Note</Typography>}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={printPatientInstructions && hasPatientInstructions}
                disabled={!hasPatientInstructions}
                onChange={(e) => setPrintPatientInstructions(e.target.checked)}
              />
            }
            label={
              <Typography color={hasPatientInstructions ? 'text.primary' : 'text.disabled'}>
                Patient Instructions
              </Typography>
            }
          />
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading} variant="outlined" sx={{ borderRadius: 100, textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          onClick={handleDischargeAndPrint}
          disabled={isLoading}
          variant="contained"
          sx={{ borderRadius: 100, textTransform: 'none' }}
        >
          {isLoading ? 'Processing...' : 'Discharge & Print'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
