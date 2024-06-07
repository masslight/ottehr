import React, { FC } from 'react';
import { Box } from '@mui/material';
import { AccordionCard, RoundedButton } from '../../../components';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';

export const ERxCard: FC = () => {
  const { isReadOnly } = getSelectors(useAppointmentStore, ['isReadOnly']);

  return (
    <AccordionCard label="eRx">
      <Box sx={{ p: 2 }}>
        <RoundedButton disabled={isReadOnly} variant="contained">
          Add eRx
        </RoundedButton>
      </Box>
    </AccordionCard>
  );
};
