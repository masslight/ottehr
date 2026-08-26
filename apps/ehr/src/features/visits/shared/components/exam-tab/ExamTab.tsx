import { Stack } from '@mui/material';
import { FC } from 'react';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useExamObservationsInitializationStore } from '../../stores/appointment/exam-observations.store';
import { PageTitle } from '../PageTitle';
import { ClearExamButton } from './ClearExamButton';
import { ExamBody } from './ExamBody';

export const ExamTab: FC = () => {
  // Read only to gate the page-title action; the rest of the screen lives in ExamBody.
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const hasInitialData = useExamObservationsInitializationStore((state) => state.hasInitialData);

  return (
    <Stack direction="column" gap={1}>
      <PageTitle
        label="Exam"
        showIntakeNotesButton={false}
        actions={hasInitialData && !isReadOnly ? <ClearExamButton /> : undefined}
      />
      <ExamBody />
    </Stack>
  );
};
