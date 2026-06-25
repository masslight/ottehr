import { CircularProgress, Stack } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { examConfig, INCOMPATIBLE_EXAM_VERSION_MESSAGE } from 'utils';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useExamObservationsInitializationStore } from '../../stores/appointment/exam-observations.store';
import { PageTitle } from '../PageTitle';
import { ExaminationContainer } from '../review-tab/components/ExaminationContainer';
import { ExamMigrationWarning } from './ExamMigrationWarning';
import { ExamTable } from './ExamTable';
import { useExamConfigState } from './useExamConfigState';

export const ExamTab: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const hasInitialData = useExamObservationsInitializationStore((state) => state.hasInitialData);

  // Derive from the appointment's FHIR module tag so the selected config matches
  // what save-chart-data validates against (it uses isInPersonAppointment on the
  // same tag). Driving this from route-scoped app flags desyncs the two when a
  // telemed appointment is opened under /in-person/:id/*.
  const config = examConfig.default.components;
  const { displayExamMigrationWarning, unmatchedExamFields, hasIncompatibleExamConfig } = useExamConfigState(config);

  // If the exam version is flagged as incompatible, we cannot run the migration safely.
  // If it both needs migration and is incompatible, hide the exam and direct the user to the visit PDF.
  if (hasIncompatibleExamConfig && displayExamMigrationWarning) {
    return (
      <Stack direction="column" gap={1}>
        <PageTitle label="Exam" showIntakeNotesButton={false} />
        <AccordionCard>
          <Stack direction="row" p={2}>
            {INCOMPATIBLE_EXAM_VERSION_MESSAGE}
          </Stack>
        </AccordionCard>
      </Stack>
    );
  }

  return (
    <Stack direction="column" gap={1}>
      <PageTitle label="Exam" showIntakeNotesButton={false} />
      {!hasInitialData ? (
        <Stack direction="row" justifyContent="center">
          <CircularProgress />
        </Stack>
      ) : (
        <>
          {displayExamMigrationWarning && <ExamMigrationWarning unmatchedFields={unmatchedExamFields} />}
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
