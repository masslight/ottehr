import { Stack } from '@mui/material';
import { FC } from 'react';
import { Loader } from '../../../shared/components/Loader';
import { useChartSection } from '../../../shared/hooks/useChartSection';
import AskThePatient from './AskThePatient';
import { ASQ } from './ASQ';
import { Questions } from './PaperworkAndConfirmedQuestions';
import { ScreeningNotes } from './ScreeningNotes';

export const ScreeningBody: FC = () => {
  const { isLoading } = useChartSection('screening');

  if (isLoading) return <Loader />;

  return (
    <Stack spacing={1}>
      <Questions />
      <AskThePatient />
      <ASQ />
      <ScreeningNotes />
    </Stack>
  );
};
