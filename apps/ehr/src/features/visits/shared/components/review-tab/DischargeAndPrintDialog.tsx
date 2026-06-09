import { LoadingButton } from '@mui/lab';
import { Button, Checkbox, FormControlLabel, FormGroup, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useState } from 'react';
import { CustomDialog } from 'src/components/dialogs/CustomDialog';
import { useApiClients } from 'src/hooks/useAppClients';
import { useGetPatientDocs } from 'src/hooks/useGetPatientDocs';
import { useExcusePresignedFiles } from 'src/shared/hooks/useExcusePresignedFiles';
import { SCHOOL_NOTE_CODE, WORK_NOTE_CODE } from 'utils';
import { useAppointmentData, useChartData } from '../../stores/appointment/appointment.store';
import { createAndOpenDischargeSummary, handleDischarge } from './DischargeButton';

interface DischargeAndPrintDialogProps {
  open: boolean;
  onClose: () => void;
  encounterId: string;
  appointmentId?: string;
  patientId?: string;
}

export const DischargeAndPrintDialog: FC<DischargeAndPrintDialogProps> = ({
  open,
  onClose,
  encounterId,
  appointmentId,
  patientId,
}) => {
  const { oystehrZambda } = useApiClients();
  const { chartData } = useChartData();
  const { appointmentRefetch } = useAppointmentData();
  const { downloadDocument } = useGetPatientDocs(patientId ?? '');

  const schoolWorkNotes = chartData?.schoolWorkNotes ?? [];
  const presignedFiles = useExcusePresignedFiles(schoolWorkNotes);
  const workNote = presignedFiles.find((file) => file.type === WORK_NOTE_CODE);
  const schoolNote = presignedFiles.find((file) => file.type === SCHOOL_NOTE_CODE);
  const hasWorkNote = Boolean(workNote);
  const hasSchoolNote = Boolean(schoolNote);
  const hasDischargeSummary = Boolean(appointmentId);

  const [printDischargeSummary, setPrintDischargeSummary] = useState(true);
  const [printWorkNote, setPrintWorkNote] = useState(true);
  const [printSchoolNote, setPrintSchoolNote] = useState(true);

  const [isLoading, setIsLoading] = useState(false);

  const handleDischargeAndPrint = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) {
      enqueueSnackbar('API client not available. Please try again.', { variant: 'error' });
      return;
    }

    setIsLoading(true);

    try {
      const printPromises: Promise<void>[] = [];

      if (printDischargeSummary && hasDischargeSummary && appointmentId) {
        printPromises.push(
          createAndOpenDischargeSummary(oystehrZambda, appointmentId, downloadDocument, { skipRelated: true })
        );
      }

      if (printWorkNote && hasWorkNote && workNote?.presignedUrl) {
        window.open(workNote.presignedUrl, '_blank');
      }

      if (printSchoolNote && hasSchoolNote && schoolNote?.presignedUrl) {
        window.open(schoolNote.presignedUrl, '_blank');
      }

      await Promise.all(printPromises);
      await handleDischarge(encounterId, oystehrZambda);
      await appointmentRefetch();
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
    downloadDocument,
    appointmentRefetch,
    onClose,
  ]);

  return (
    <CustomDialog
      open={open}
      handleClose={onClose}
      title="Discharge & Print"
      description={
        <>
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
                <Typography color={hasDischargeSummary ? 'text.primary' : 'text.disabled'}>
                  Discharge Summary + Patient Instructions
                </Typography>
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
          </FormGroup>
        </>
      }
      actions={
        <>
          <Button
            onClick={onClose}
            disabled={isLoading}
            variant="outlined"
            sx={{ borderRadius: 100, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <LoadingButton
            onClick={handleDischargeAndPrint}
            loading={isLoading}
            variant="contained"
            sx={{ borderRadius: 100, textTransform: 'none' }}
          >
            Discharge & Print
          </LoadingButton>
        </>
      }
    />
  );
};
