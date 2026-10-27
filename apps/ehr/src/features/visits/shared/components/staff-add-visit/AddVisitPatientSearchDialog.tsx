import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
} from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { AddVisitPatientInfo } from 'src/pages/AddPatient';

interface AddVisitPatientSearchDialogProps {
  openSearchResults: boolean;
  setOpenSearchResults: (open: boolean) => void;
  selectedPatient: AddVisitPatientInfo | undefined;
  setSelectedPatient: (patient: AddVisitPatientInfo | undefined) => void;
  patients: AddVisitPatientInfo[];
  handleSelectExistingPatient: () => void;
  handleManuallyEnterPatientDetails: () => void;
}
export const AddVisitPatientSearchDialog: FC<AddVisitPatientSearchDialogProps> = ({
  openSearchResults,
  setOpenSearchResults,
  selectedPatient,
  setSelectedPatient,
  patients,
  handleSelectExistingPatient,
  handleManuallyEnterPatientDetails,
}) => {
  const getFullNameFromPatientInfo = (patient: AddVisitPatientInfo): string => {
    return `${patient.firstName}${patient.middleName ? ` ${patient.middleName}` : ''} ${patient.lastName}`;
  };

  return (
    <Dialog
      open={openSearchResults}
      onClose={() => {
        setSelectedPatient(undefined);
        setOpenSearchResults(false);
      }}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { maxHeight: '450px' } }}
    >
      <DialogTitle variant="h4" sx={{ fontWeight: '600 !important', color: 'primary.main' }}>
        Select Patient
      </DialogTitle>
      <DialogContent dividers>
        <RadioGroup
          onChange={(e) => {
            const id = e.target.value;
            const patient = patients.find((p) => p.id === id);
            setSelectedPatient(patient);
          }}
        >
          {patients.map((patient) => {
            const label = `${getFullNameFromPatientInfo(patient)} (DOB: ${DateTime.fromISO(
              patient?.dateOfBirth || ''
            ).toFormat('MMMM dd, yyyy')})`;
            return <FormControlLabel key={patient.id} value={patient.id} control={<Radio />} label={label} />;
          })}
        </RadioGroup>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
        <Button
          data-testid={dataTestIds.addPatientPage.patientNotFoundButton}
          variant="contained"
          sx={{
            borderRadius: 100,
            textTransform: 'none',
            fontWeight: 600,
          }}
          onClick={handleManuallyEnterPatientDetails}
        >
          Patient Not Found - Add Manually
        </Button>
        {selectedPatient && (
          <Button
            data-testid={dataTestIds.addPatientPage.prefillForButton}
            variant="outlined"
            sx={{
              borderRadius: 100,
              textTransform: 'none',
              fontWeight: 600,
            }}
            onClick={handleSelectExistingPatient}
          >
            Prefill for {getFullNameFromPatientInfo(selectedPatient)}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
