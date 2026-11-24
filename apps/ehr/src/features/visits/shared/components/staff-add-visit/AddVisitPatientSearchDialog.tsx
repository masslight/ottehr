import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { AddVisitPatientInfo } from 'src/pages/AddPatient';
import { getFullNameFromPatientInfo, PatientCandidateRadioGroup } from './PatientCandidateRadioGroup';

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
  return (
    <Dialog
      open={openSearchResults}
      onClose={() => {
        setSelectedPatient(undefined);
        setOpenSearchResults(false);
      }}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { maxHeight: 'min(650px, calc(100% - 64px))' } }}
    >
      <DialogTitle variant="h4" sx={{ fontWeight: '600 !important', color: 'primary.main' }}>
        Select Patient
      </DialogTitle>
      <DialogContent dividers>
        <PatientCandidateRadioGroup
          patients={patients}
          value={selectedPatient?.id ?? ''}
          onChange={(id) => setSelectedPatient(patients.find((p) => p.id === id))}
        />
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
