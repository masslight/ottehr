import { CircularProgress, FormControlLabel, Grid, Paper, Radio, RadioGroup, Typography } from '@mui/material';
import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import { useGetPatient } from 'src/hooks/useGetPatient';
import PageContainer from 'src/layout/PageContainer';
import { FollowupSubtype, getFullName } from 'utils';
import PatientFollowupForm from './PatientFollowupForm';
import ScheduledFollowupParentSelector from './ScheduledFollowupParentSelector';

export default function AddPatientFollowup(): JSX.Element {
  const { id } = useParams();
  const { patient } = useGetPatient(id);
  const [followupSubtype, setFollowupSubtype] = useState<FollowupSubtype>('annotation');
  const location = useLocation();
  const routerState = location.state as { initialEncounterId?: string } | undefined;
  const initialEncounterId = routerState?.initialEncounterId;

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
            <Typography variant="h3" marginTop={1} marginBottom={2} color={'primary.dark'}>
              Add Follow-up Visit
            </Typography>

            <Paper elevation={3} sx={{ p: 3 }}>
              <RadioGroup
                row
                value={followupSubtype}
                onChange={(e) => setFollowupSubtype(e.target.value as FollowupSubtype)}
                sx={{ mb: 2 }}
              >
                <FormControlLabel value="annotation" control={<Radio />} label="Annotation" />
                <FormControlLabel value="scheduled" control={<Radio />} label="Scheduled Visit" />
              </RadioGroup>

              {followupSubtype === 'annotation' ? (
                <PatientFollowupForm patient={patient} initialEncounterId={initialEncounterId} />
              ) : (
                <ScheduledFollowupParentSelector patient={patient} initialEncounterId={initialEncounterId} />
              )}
            </Paper>
          </Grid>
        )}
      </Grid>
    </PageContainer>
  );
}
