import { CircularProgress, Stack } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { examConfig } from 'utils';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useChartData } from '../../stores/appointment/appointment.store';
import { useAppFlags } from '../../stores/contexts/useAppFlags';
import { ExaminationContainer } from '../review-tab/components/ExaminationContainer';
import { ExamTable } from './ExamTable';

export const ExamTab: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { isInPerson } = useAppFlags();
  const { isChartDataLoading } = useChartData();

  const config = examConfig[isInPerson ? 'inPerson' : 'telemed'].default.components;

  return (
    <Stack direction="column" gap={1}>
      {isChartDataLoading ? (
        <Stack direction="row" justifyContent="center">
          <CircularProgress />
        </Stack>
      ) : isReadOnly ? (
        <AccordionCard>
          <Stack p={2}>
            <ExaminationContainer examConfig={config} />
          </Stack>
        </AccordionCard>
      ) : (
        <ExamTable examConfig={config} />
      )}
    </Stack>
  );
};
