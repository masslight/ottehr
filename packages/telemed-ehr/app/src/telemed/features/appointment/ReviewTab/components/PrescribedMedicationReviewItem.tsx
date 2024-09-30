import { Typography } from '@mui/material';
import { FC } from 'react';
import { PrescribedMedicationDTO } from 'ehr-utils';

export const PrescribedMedicationReviewItem: FC<{ medication: PrescribedMedicationDTO }> = (props) => {
  const { medication } = props;

  return (
    <>
      <Typography fontWeight={700} mb={0.5}>
        {medication.name}
      </Typography>
      <Typography>{medication.instructions}</Typography>
    </>
  );
};
