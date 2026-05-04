import { CircularProgress, Stack } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { examConfig, isInPersonAppointment } from 'utils';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { useExamObservationsInitializationStore } from '../../stores/appointment/exam-observations.store';
import { PageTitle } from '../PageTitle';
import { ExaminationContainer } from '../review-tab/components/ExaminationContainer';
import { ExamMigrationWarning } from './ExamMigrationWarning';
import { ExamTable } from './ExamTable';
import { useUnmatchedExamFields } from './useUnmatchedExamFields';

export const ExamTab: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { appointment } = useAppointmentData();
  const hasInitialData = useExamObservationsInitializationStore((state) => state.hasInitialData);

  // Derive from the appointment's FHIR module tag so the selected config matches
  // what save-chart-data validates against (it uses isInPersonAppointment on the
  // same tag). Driving this from route-scoped app flags desyncs the two when a
  // telemed appointment is opened under /in-person/:id/*.
  const config = examConfig[isInPersonAppointment(appointment) ? 'inPerson' : 'telemed'].default.components;
  const unmatchedFields = useUnmatchedExamFields(config);

  return (
    <Stack direction="column" gap={1}>
      <PageTitle label="Exam" showIntakeNotesButton={false} />
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
