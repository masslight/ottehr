import { Box } from '@mui/material';
import { FC } from 'react';
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
