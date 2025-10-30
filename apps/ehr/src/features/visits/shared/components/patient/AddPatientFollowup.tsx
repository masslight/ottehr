import { CircularProgress, Grid, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import { useGetPatient } from 'src/hooks/useGetPatient';
import PageContainer from 'src/layout/PageContainer';
import { getFullName } from 'utils';
import PatientFollowupForm from './PatientFollowupForm';

export default function AddPatientFollowup(): JSX.Element {
  const { id } = useParams();
  const { patient } = useGetPatient(id);

  const fullName = patient ? getFullName(patient) : '';

  return (
    <PageContainer>
      <Grid container justifyContent="center">
        {!patient ? (
          <CircularProgress />
        ) : (
          <Grid item xs={5}>
            <CustomBreadcrumbs
              chain={[
                { link: '/patients', children: 'Patients' },
                {
                  link: `/patient/${id}`,
                  children: fullName,
                },
                {
                  link: '#',
                  children: 'Add Visit',
                },
              ]}
            />
            <Typography variant="h3" marginTop={1} color={'primary.dark'}>
              Add Follow-up Visit
            </Typography>
            <PatientFollowupForm patient={patient}></PatientFollowupForm>
          </Grid>
        )}
      </Grid>
    </PageContainer>
  );
}
