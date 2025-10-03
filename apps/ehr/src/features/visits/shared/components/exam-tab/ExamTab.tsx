import { CircularProgress, Stack } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { useExamObservations } from 'src/features/visits/telemed/hooks/useExamObservations';
import { examConfig } from 'utils';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useAppFlags } from '../../stores/contexts/useAppFlags';
import { ExaminationContainer } from '../review-tab/components/ExaminationContainer';
import { ExamTable } from './ExamTable';

export const ExamTab: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { isInPerson } = useAppFlags();
  const { value: examObservations } = useExamObservations();

  const config = examConfig[isInPerson ? 'inPerson' : 'telemed'].default.components;

  return (
    <Stack direction="column" gap={1}>
      {examObservations.length === 0 ? (
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
