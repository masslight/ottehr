import { Box } from '@mui/material';
import { ReactElement } from 'react';
import PageContainer from '../layout/PageContainer';
import { PatientSearch } from '../components/PatientsSearch/PatientSearch';

export default function PatientsPage(): ReactElement {
  return (
    <PageContainer>
      <Box sx={{ px: 3 }}>
        <PatientSearch />
      </Box>
    </PageContainer>
  );
}
