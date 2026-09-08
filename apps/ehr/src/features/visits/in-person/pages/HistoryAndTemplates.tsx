import { Stack } from '@mui/material';
import React from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PageTitle } from '../../shared/components/PageTitle';
import { HistoryAndTemplatesBody } from '../components/hpi/HistoryAndTemplatesBody';

export const HistoryAndTemplates: React.FC = () => {
  return (
    <Stack spacing={1}>
      <PageTitle
        label="History of Present Illness"
        showIntakeNotesButton={false}
        dataTestId={dataTestIds.hpiAndTemplatesPage.hpiTitle}
      />
      <HistoryAndTemplatesBody />
    </Stack>
  );
};
