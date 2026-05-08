import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { createDischargeSummary, createPatientInstructionsPdf } from 'src/api/api';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import { useGetPatientDocs } from 'src/hooks/useGetPatientDocs';
import { useExcusePresignedFiles } from 'src/shared/hooks/useExcusePresignedFiles';
import { useAppointmentData, useChartData } from '../../stores/appointment/appointment.store';

interface DischargeDocumentsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const DischargeDocumentsDialog: FC<DischargeDocumentsDialogProps> = ({ open, onClose }) => {
  const { oystehrZambda } = useApiClients();
  const {
    resources: { appointment, patient },
  } = useAppointmentData();
  const { chartData } = useChartData();
  const { downloadDocument } = useGetPatientDocs(patient?.id ?? '');
  const schoolWorkExcuses = useExcusePresignedFiles(chartData?.schoolWorkNotes);

  const [isPrinting, setIsPrinting] = useState(false);

  const appointmentId = appointment?.id;
  const schoolExcuse = schoolWorkExcuses.find((f) => f.type === 'school');
  const workExcuse = schoolWorkExcuses.find((f) => f.type === 'work');

  const documentNames = [
    'Patient Instructions',
    'Discharge Summary',
    schoolExcuse?.presignedUrl ? 'School Note' : null,
    workExcuse?.presignedUrl ? 'Work Note' : null,
  ]
    .filter(Boolean)
    .join(', ');

  const handlePrint = async (): Promise<void> => {
    if (!oystehrZambda || !appointmentId || !patient?.id) return;
    setIsPrinting(true);
    try {
      const [patientInstructionsResponse, dischargeSummaryResponse] = await Promise.all([
        createPatientInstructionsPdf(oystehrZambda, { appointmentId }),
        createDischargeSummary(oystehrZambda, { appointmentId }),
      ]);

      const downloads: Promise<void>[] = [];

      if (patientInstructionsResponse?.documentId) {
        downloads.push(downloadDocument(patientInstructionsResponse.documentId));
      }
      if (dischargeSummaryResponse?.documentId) {
        downloads.push(downloadDocument(dischargeSummaryResponse.documentId));
      }

      await Promise.all(downloads);

      if (schoolExcuse?.presignedUrl) {
        window.open(schoolExcuse.presignedUrl, '_blank');
      }
      if (workExcuse?.presignedUrl) {
        window.open(workExcuse.presignedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error printing patient documents:', error);
      enqueueSnackbar('An error occurred while printing documents. Please try again.', { variant: 'error' });
    } finally {
      setIsPrinting(false);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      data-testid={dataTestIds.progressNotePage.dischargeDocumentsDialog}
    >
      <DialogTitle>Print Patient Documents</DialogTitle>
      <DialogContent>
        <Typography>Patient has been discharged. Do you want to print the documents: {documentNames}?</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined" disabled={isPrinting}>
          Cancel
        </Button>
        <Button
          onClick={handlePrint}
          variant="contained"
          disabled={isPrinting}
          startIcon={<PrintOutlinedIcon />}
          data-testid={dataTestIds.progressNotePage.dischargeDocumentsPrintButton}
        >
          {isPrinting ? 'Printing...' : 'Print'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
