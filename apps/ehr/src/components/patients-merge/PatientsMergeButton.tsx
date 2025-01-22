import React, { FC, useState } from 'react';
import { Button } from '@mui/material';
import { PatientsMergeSelect } from './PatientsMergeSelect';
import { PatientsMergeDifference } from './PatientsMergeDifference';

type PatientsMergeButtonProps = {
  patientIds?: string[];
};

export const PatientsMergeButton: FC<PatientsMergeButtonProps> = (props) => {
  const { patientIds } = props;

  const [open, setOpen] = useState<'select' | 'difference' | undefined>(undefined);
  const [difference, setDifference] = useState<string[]>([]);

  const close = (): void => {
    setDifference([]);
    setOpen(undefined);
  };

  const next = (patientIds: string[]): void => {
    setDifference(patientIds);
    setOpen('difference');
  };

  return (
    <>
      <Button onClick={() => setOpen('select')}>Open</Button>
      {open === 'select' && <PatientsMergeSelect open next={next} close={close} patientIds={patientIds} />}
      {open === 'difference' && (
        <PatientsMergeDifference open close={close} back={() => setOpen('select')} patientIds={difference} />
      )}
    </>
  );
};
