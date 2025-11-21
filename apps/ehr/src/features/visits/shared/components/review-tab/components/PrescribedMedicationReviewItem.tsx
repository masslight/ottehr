import { Typography } from '@mui/material';
import { FC } from 'react';
import { PrescribedMedicationDTO } from 'utils';

export const PrescribedMedicationReviewItem: FC<{ medication: PrescribedMedicationDTO }> = (props) => {
  const { medication } = props;

  return (
    <>
      <Typography fontWeight={500} mb={0.5}>
        {medication.name}
      </Typography>
      <Typography>{medication.instructions}</Typography>
    </>
  );
};
