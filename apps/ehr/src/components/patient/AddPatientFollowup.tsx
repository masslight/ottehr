import { Grid, Typography, Box, CircularProgress } from '@mui/material';
import { useParams } from 'react-router-dom';
import CustomBreadcrumbs from '../CustomBreadcrumbs';
import PageContainer from '../../layout/PageContainer';
import { getFullName } from 'utils';
import { useGetPatient } from '../../hooks/useGetPatient';
import PatientFollowupForm from './PatientFollowupForm';

export default function AddPatientFollowup(): JSX.Element {
  const { id } = useParams();
  const { patient } = useGetPatient(id);

  const fullName = patient ? getFullName(patient) : '';

  return (
    <PageContainer>
      <Grid container direction="row">
        <Grid item xs={3.5} />
        <Grid item xs={5}>
          {!patient ? (
            <Box sx={{ justifyContent: 'left' }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <CustomBreadcrumbs
                chain={[
                  { link: '/patients', children: 'Patients' },
                  {
                    link: `/patient/${id}`,
                    children: fullName,
                  },
                  {
                    link: '#',
                    children: 'Add Patient Follow-up',
                  },
                ]}
              />
              <Typography variant="h3" marginTop={1} color={'primary.dark'}>
                Add Patient Follow-up
              </Typography>
              <PatientFollowupForm patient={patient} followupStatus="NEW"></PatientFollowupForm>
            </>
          )}
        </Grid>
        <Grid item xs={3.5} />
      </Grid>
    </PageContainer>
  );
}
