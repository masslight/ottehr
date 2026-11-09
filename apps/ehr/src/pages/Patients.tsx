import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { dataTestIds } from '../constants/data-test-ids';
import { PatientSearch } from '../features/visits/shared/components/patients-search/PatientSearch';
import PageContainer from '../layout/PageContainer';

export default function PatientsPage(): ReactElement {
  return (
    <PageContainer>
      <Box sx={{ px: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Link to="/patients/add" style={{ display: 'contents' }}>
            <Button
              data-testid={dataTestIds.patients.addPatientButton}
              sx={{ borderRadius: 100, textTransform: 'none', fontWeight: 600 }}
              color="primary"
              variant="contained"
            >
              <AddIcon />
              <Typography fontWeight="bold">Patient</Typography>
            </Button>
          </Link>
        </Box>
        <PatientSearch />
      </Box>
    </PageContainer>
  );
}
