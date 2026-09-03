import { Stack } from '@mui/material';
import { FC } from 'react';
import { PageTitle } from 'src/features/visits/shared/components/PageTitle';
import { AssessmentBody } from './AssessmentBody';

export const AssessmentCard: FC = () => {
  return (
    <Stack spacing={1}>
      <PageTitle label="Assessment" showIntakeNotesButton={false} />
      <AssessmentBody />
    </Stack>
  );
};
