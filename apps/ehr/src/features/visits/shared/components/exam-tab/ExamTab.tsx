import { CircularProgress, Stack } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { examConfig } from 'utils';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useExamObservationsInitializationStore } from '../../stores/appointment/exam-observations.store';
import { useAppFlags } from '../../stores/contexts/useAppFlags';
import { ExaminationContainer } from '../review-tab/components/ExaminationContainer';
import { ExamMigrationWarning } from './ExamMigrationWarning';
import { ExamTable } from './ExamTable';
import { useUnmatchedExamFields } from './useUnmatchedExamFields';

export const ExamTab: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { isInPerson } = useAppFlags();
  const hasInitialData = useExamObservationsInitializationStore((state) => state.hasInitialData);

  const config = examConfig[isInPerson ? 'inPerson' : 'telemed'].default.components;
  console.log('config', config);
  const unmatchedFields = useUnmatchedExamFields(config);

  return (
    <Stack direction="column" gap={1}>
      {!hasInitialData ? (
        <Stack direction="row" justifyContent="center">
          <CircularProgress />
        </Stack>
      ) : (
        <>
          {unmatchedFields.length > 0 && <ExamMigrationWarning unmatchedFields={unmatchedFields} />}
          {isReadOnly ? (
            <AccordionCard>
              <Stack p={2}>
                <ExaminationContainer examConfig={config} />
              </Stack>
            </AccordionCard>
          ) : (
            <ExamTable examConfig={config} />
          )}
        </>
      )}
    </Stack>
  );
};
