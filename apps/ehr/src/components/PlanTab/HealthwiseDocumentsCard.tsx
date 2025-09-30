import { Box } from '@mui/material';
import { FC, useState } from 'react';
import { useGetAppointmentAccessibility } from 'src/shared/hooks/appointment/useGetAppointmentAccessibility';
import { AccordionCard } from '../AccordionCard';
import { RoundedButton } from '../RoundedButton';

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
