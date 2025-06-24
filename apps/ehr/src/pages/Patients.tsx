import { Box } from '@mui/material';
import { ReactElement } from 'react';
import { PatientSearch } from '../components/PatientsSearch/PatientSearch';
import PageContainer from '../layout/PageContainer';

export default function PatientsPage(): ReactElement {
  return (
    <PageContainer>
      <Box sx={{ px: 3 }}>
        <PatientSearch />
      </Box>
    </PageContainer>
  );
}
