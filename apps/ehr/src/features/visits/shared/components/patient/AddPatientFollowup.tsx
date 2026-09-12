import { CircularProgress, FormControlLabel, Grid, Paper, Radio, RadioGroup, Tooltip, Typography } from '@mui/material';
import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import { useGetPatient } from 'src/hooks/useGetPatient';
import PageContainer from 'src/layout/PageContainer';
import { FollowupSubtype } from 'utils/lib/fhir/encounter';
import { getFullName } from 'utils/lib/fhir/patient';
import PatientFollowupForm from './PatientFollowupForm';
import ScheduledFollowupParentSelector from './ScheduledFollowupParentSelector';

/** The visit being retyped, when this page was opened from Visit Details → Convert to Follow-up. */
export interface ConvertFromVisit {
  appointmentId: string;
  encounterId: string;
  /** The visit's current booking reason, used to pre-fill the follow-up reason picker. */
  reasonForVisit?: string;
}

const ANNOTATION_DISABLED_MESSAGE = 'A visit can only be converted to a scheduled follow-up';

export default function AddPatientFollowup(): JSX.Element {
  const { id } = useParams();
  const { patient, person } = useGetPatient(id);
  const location = useLocation();
  const routerState = location.state as { initialEncounterId?: string; convertFrom?: ConvertFromVisit } | undefined;
  const initialEncounterId = routerState?.initialEncounterId;
  const convertFrom = routerState?.convertFrom;
  // Conversion only ever produces the scheduled subtype, so the annotation branch is closed off.
  const [followupSubtype, setFollowupSubtype] = useState<FollowupSubtype>(convertFrom ? 'scheduled' : 'annotation');

  const fullName = patient ? getFullName(patient) : '';

  const annotationRadio = (
    <FormControlLabel value="annotation" control={<Radio />} label="Annotation" disabled={!!convertFrom} />
  );

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
                convertFrom
                  ? { link: `/visit/${convertFrom.appointmentId}`, children: 'Visit Details' }
                  : { link: '#', children: 'Add Visit' },
              ]}
            />
            <Typography variant="h3" marginTop={1} marginBottom={2} color={'primary.dark'}>
              {convertFrom ? 'Convert to Follow-up Visit' : 'Add Follow-up Visit'}
            </Typography>

            <Paper elevation={3} sx={{ p: 3 }}>
              <RadioGroup
                row
                value={followupSubtype}
                onChange={(e) => setFollowupSubtype(e.target.value as FollowupSubtype)}
                sx={{ mb: 2 }}
              >
                {convertFrom ? (
                  <Tooltip title={ANNOTATION_DISABLED_MESSAGE} placement="top">
                    <span>{annotationRadio}</span>
                  </Tooltip>
                ) : (
                  annotationRadio
                )}
                <FormControlLabel value="scheduled" control={<Radio />} label="Scheduled Visit" />
              </RadioGroup>

              {followupSubtype === 'annotation' ? (
                <PatientFollowupForm patient={patient} initialEncounterId={initialEncounterId} />
              ) : (
                <ScheduledFollowupParentSelector
                  patient={patient}
                  person={person}
                  initialEncounterId={initialEncounterId}
                  convertFrom={convertFrom}
                />
              )}
            </Paper>
          </Grid>
        )}
      </Grid>
    </PageContainer>
  );
}
