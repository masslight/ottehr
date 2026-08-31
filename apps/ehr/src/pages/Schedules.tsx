import { Box } from '@mui/material';
import { ReactElement } from 'react';
import { SchedulesTable } from '../components/schedule/SchedulesTable';

export default function SchedulesPage(): ReactElement {
  return (
    <Box sx={{ marginTop: 2 }}>
      <SchedulesTable />
    </Box>
  );
}
