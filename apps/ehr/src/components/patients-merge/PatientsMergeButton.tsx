import MergeIcon from '@mui/icons-material/MergeType';
import { Tooltip } from '@mui/material';
import { FC, useState } from 'react';
import { RoleType } from 'utils';
import useEvolveUser from '../../hooks/useEvolveUser';
import { RoundedButton } from '../RoundedButton';
import { PatientsMergeDifference } from './PatientsMergeDifference';

type PatientsMergeButtonProps = {
  /** The current patient's ID (will be the main/surviving patient) */
  patientId: string;
};

export const PatientsMergeButton: FC<PatientsMergeButtonProps> = ({ patientId }) => {
  const [mergePatientIds, setMergePatientIds] = useState<[string, string] | null>(null);

  const currentUser = useEvolveUser();
  const isAdmin = currentUser?.hasRole([RoleType.Administrator]) ?? false;

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
      <Tooltip title={isAdmin ? '' : 'Only Administrators can merge patient records'} placement="top">
        <span style={{ display: 'inline-block', width: '100%' }}>
          <RoundedButton onClick={handleClick} startIcon={<MergeIcon />} sx={{ width: '100%' }} disabled={!isAdmin}>
            Merge Patient
          </RoundedButton>
        </span>
      </Tooltip>
      {mergePatientIds && <PatientsMergeDifference open close={handleClose} patientIds={mergePatientIds} />}
    </>
  );
};
