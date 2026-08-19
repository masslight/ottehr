import { Stack } from '@mui/material';
import { FC } from 'react';
import { PageTitle } from '../PageTitle';
import { ExamBody } from './ExamBody';

export const ExamTab: FC = () => {
  return (
    <Stack direction="column" gap={1}>
      <PageTitle label="Exam" showIntakeNotesButton={false} />
      <ExamBody />
    </Stack>
  );
};
