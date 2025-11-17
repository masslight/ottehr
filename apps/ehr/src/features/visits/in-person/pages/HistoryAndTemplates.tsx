import { Stack } from '@mui/material';
import React from 'react';
import { PageTitle } from '../../shared/components/PageTitle';

interface HistoryAndTemplatesProps {
  appointmentID?: string;
}

export const HistoryAndTemplates: React.FC<HistoryAndTemplatesProps> = () => {
  return (
    <Stack spacing={1}>
      <PageTitle label="History of Present Illness" showIntakeNotesButton={false} />
    </Stack>
  );
};
