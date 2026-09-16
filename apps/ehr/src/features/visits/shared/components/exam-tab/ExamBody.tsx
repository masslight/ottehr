import { Box, CircularProgress, Stack } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { useIsInlineFlow } from 'src/components/InlineFlow';
import { INCOMPATIBLE_EXAM_VERSION_MESSAGE } from 'utils/lib/fhir/constants';
import { examConfig } from 'utils/lib/ottehr-config/examination';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useExamObservationsInitializationStore } from '../../stores/appointment/exam-observations.store';
import { ExaminationContainer } from '../review-tab/components/ExaminationContainer';
import { ClearExamButton } from './ClearExamButton';
import { ExamMigrationWarning } from './ExamMigrationWarning';
import { ExamTable } from './ExamTable';
import { useExamConfigState } from './useExamConfigState';

export const ExamBody: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const hasInitialData = useExamObservationsInitializationStore((state) => state.hasInitialData);
  const isInlineFlow = useIsInlineFlow();

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
      <AccordionCard>
        <Stack direction="row" p={2}>
          {INCOMPATIBLE_EXAM_VERSION_MESSAGE}
        </Stack>
      </AccordionCard>
    );
  }

  if (!hasInitialData) {
    return (
      <Stack direction="row" justifyContent="center">
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <>
      {displayExamMigrationWarning && <ExamMigrationWarning unmatchedFields={unmatchedExamFields} />}
      {isReadOnly ? (
        <AccordionCard>
          <Stack p={2}>
            <ExaminationContainer examConfig={config} />
          </Stack>
        </AccordionCard>
      ) : (
        <Stack spacing={1}>
          {/* On its own screen this action sits in the page title, which the inline editor
              doesn't render — so inline it goes above the table instead. */}
          {isInlineFlow && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <ClearExamButton />
            </Box>
          )}
          <ExamTable examConfig={config} />
        </Stack>
      )}
    </>
  );
};
