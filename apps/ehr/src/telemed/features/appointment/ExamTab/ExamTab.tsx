import { CircularProgress, Stack } from '@mui/material';
import { FC } from 'react';
import { useFeatureFlags } from 'src/features/css-module/context/featureFlags';
import { useExamObservations } from 'src/telemed/hooks/useExamObservations';
import { examConfig } from 'utils';
import { AccordionCard } from '../../../components';
import { useGetAppointmentAccessibility } from '../../../hooks';
import { ExaminationContainer } from '../ReviewTab';
import { ExamTable } from './components/ExamTable';

export const ExamTab: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { css } = useFeatureFlags();
  const { value: examObservations } = useExamObservations();

  const config = examConfig[css ? 'inPerson' : 'telemed'].default.components;

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
