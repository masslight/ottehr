import MergeIcon from '@mui/icons-material/MergeType';
import { FC, useState } from 'react';
import { RoundedButton } from '../RoundedButton';
import { PatientsMergeDifference } from './PatientsMergeDifference';

type PatientsMergeButtonProps = {
  /** The current patient's ID (will be the main/surviving patient) */
  patientId: string;
};

export const PatientsMergeButton: FC<PatientsMergeButtonProps> = ({ patientId }) => {
  const [mergePatientIds, setMergePatientIds] = useState<[string, string] | null>(null);

  const handleClick = (): void => {
    const secondPatientId = window.prompt('Enter the PID of the patient to merge from:');
    if (!secondPatientId || secondPatientId.trim().length === 0) return;
    const trimmedId = secondPatientId.trim();

    if (trimmedId === patientId) {
      window.alert('Cannot merge a patient with themselves.');
      return;
    }

    setMergePatientIds([patientId, trimmedId]);
  };

  const handleClose = (): void => {
    setMergePatientIds(null);
  };

  return (
    <>
      <RoundedButton onClick={handleClick} startIcon={<MergeIcon />} sx={{ width: '100%' }}>
        Merge Patient
      </RoundedButton>
      {mergePatientIds && <PatientsMergeDifference open close={handleClose} patientIds={mergePatientIds} />}
    </>
  );
};
