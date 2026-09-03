import { Stack } from '@mui/material';
import { FC } from 'react';
import { ADDITIONAL_QUESTIONS_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import { Loader } from '../../../shared/components/Loader';
import { useChartFields } from '../../../shared/hooks/useChartFields';
import AskThePatient from './AskThePatient';
import { ASQ } from './ASQ';
import { Questions } from './PaperworkAndConfirmedQuestions';
import { ScreeningNotes } from './ScreeningNotes';

export const ScreeningBody: FC = () => {
  const { isLoading } = useChartFields({
    requestedFields: {
      observations: {
        _tag: ADDITIONAL_QUESTIONS_META_SYSTEM,
        _search_by: 'encounter',
      },
    },
  });

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
