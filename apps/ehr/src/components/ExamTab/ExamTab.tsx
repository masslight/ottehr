import { CircularProgress, Stack } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { useExamObservations } from 'src/features/telemed/hooks/useExamObservations';
import { useAppFlags } from 'src/shared/contexts/useAppFlags';
import { useGetAppointmentAccessibility } from 'src/shared/hooks/appointment/useGetAppointmentAccessibility';
import { examConfig } from 'utils';
import { ExaminationContainer } from '../ReviewTab';
import { ExamTable } from './components/ExamTable';

export const ExamTab: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { isInPerson: inPerson } = useAppFlags();
  const { value: examObservations } = useExamObservations();

  const config = examConfig[inPerson ? 'inPerson' : 'telemed'].default.components;

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
