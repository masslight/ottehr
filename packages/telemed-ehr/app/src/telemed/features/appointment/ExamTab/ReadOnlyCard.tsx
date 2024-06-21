import { FC } from 'react';
import { Box } from '@mui/material';
import { AccordionCard } from '../../../components';
import { ExaminationContainer } from '../ReviewTab';

export const ReadOnlyCard: FC = () => {
  return (
    <AccordionCard label="Examination">
      <Box sx={{ p: 2 }}>
        <ExaminationContainer noTitle />
      </Box>
    </AccordionCard>
  );
};
