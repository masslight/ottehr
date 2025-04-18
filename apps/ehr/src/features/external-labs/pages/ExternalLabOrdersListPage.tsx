import React from 'react';
import { Box, Paper } from '@mui/material';
import ExternalLabsTable from '../components/ExternalLabsTable';
import { OrderButton } from '../../css-module/components/medication-administration/OrderButton';
import { PageTitle } from '../../../telemed/components/PageTitle';

interface ExternalLabOrdersListPageProps {
  appointmentID?: string;
}

export const ExternalLabOrdersListPage: React.FC<ExternalLabOrdersListPageProps> = () => {
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <PageTitle label="Labs" showIntakeNotesButton={false} />
        <OrderButton />
      </Box>
      <Paper>
        <ExternalLabsTable></ExternalLabsTable>
      </Paper>
    </Box>
  );
};
