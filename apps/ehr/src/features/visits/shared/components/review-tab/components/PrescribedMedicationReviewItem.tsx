import { Chip, Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { PrescribedMedicationDTO } from 'utils';

export const PrescribedMedicationReviewItem: FC<{ medication: PrescribedMedicationDTO }> = (props) => {
  const { medication } = props;

  return (
    <>
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" mb={0.5}>
        <Typography fontWeight={500}>{medication.name}</Typography>
        {medication.isRenewal && <Chip label="Refill" size="small" color="primary" variant="outlined" />}
      </Stack>
      <Typography>{medication.instructions}</Typography>
    </>
  );
};
