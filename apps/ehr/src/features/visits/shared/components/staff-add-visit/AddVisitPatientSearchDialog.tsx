import { FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
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
    <AppDialog
      variant="form"
      size="m"
      open={openSearchResults}
      onClose={() => {
        setSelectedPatient(undefined);
        setOpenSearchResults(false);
      }}
      title="Select Patient"
      actions={
        selectedPatient
          ? [
              {
                label: `Prefill for ${getFullNameFromPatientInfo(selectedPatient)}`,
                onClick: handleSelectExistingPatient,
                'data-testid': dataTestIds.addPatientPage.prefillForButton,
              },
            ]
          : undefined
      }
      primary={{
        label: 'Patient Not Found - Add Manually',
        onClick: handleManuallyEnterPatientDetails,
        'data-testid': dataTestIds.addPatientPage.patientNotFoundButton,
      }}
    >
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
    </AppDialog>
  );
};
