import { CircularProgress, FormControlLabel, Grid, Radio, RadioGroup, Typography } from '@mui/material';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
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

            <RadioGroup
              row
              value={followupSubtype}
              onChange={(e) => setFollowupSubtype(e.target.value as FollowupSubtype)}
              sx={{ mb: 2, mt: 1 }}
            >
              <FormControlLabel value="annotation" control={<Radio />} label="Annotation" />
              <FormControlLabel value="scheduled" control={<Radio />} label="Scheduled Visit" />
            </RadioGroup>

            {followupSubtype === 'annotation' ? (
              <PatientFollowupForm patient={patient} />
            ) : (
              <ScheduledFollowupParentSelector patient={patient} />
            )}
          </Grid>
        )}
      </Grid>
    </PageContainer>
  );
}
