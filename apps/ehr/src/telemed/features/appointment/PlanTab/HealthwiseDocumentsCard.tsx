import { Box } from '@mui/material';
import React, { FC, useState } from 'react';
import { RoundedButton } from '../../../../components/RoundedButton';
import { AccordionCard } from '../../../components';
import { useGetAppointmentAccessibility } from '../../../hooks';

export const HealthwiseDocumentsCard: FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

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
