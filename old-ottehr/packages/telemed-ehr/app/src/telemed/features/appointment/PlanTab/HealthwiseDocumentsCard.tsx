import React, { FC, useState } from 'react';
import { Box } from '@mui/material';
import { AccordionCard, RoundedButton } from '../../../components';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';

export const HealthwiseDocumentsCard: FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { isReadOnly } = getSelectors(useAppointmentStore, ['isReadOnly']);

  return (
    <AccordionCard
      label="Healthwise education documents"
      collapsed={collapsed}
      onSwitch={() => setCollapsed((prevState) => !prevState)}
    >
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'start' }}>
        <RoundedButton disabled={isReadOnly}>Find Healthwise education documents</RoundedButton>
      </Box>
    </AccordionCard>
  );
};
