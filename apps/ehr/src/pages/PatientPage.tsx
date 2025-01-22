import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Paper, Skeleton, Typography, Tab, Stack } from '@mui/material';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getFirstName, getLastName } from 'utils';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { Contacts, FullNameDisplay, IdentifiersRow, PatientAvatar, Summary } from '../components/patient';
import { PatientEncountersGrid } from '../components/PatientEncountersGrid';
import { RoundedButton } from '../components/RoundedButton';
import { useGetPatient } from '../hooks/useGetPatient';
import PageContainer from '../layout/PageContainer';
import { PatientFollowupEncountersGrid } from '../components/patient/PatientFollowupEncountersGrid';

export default function PatientPage(): JSX.Element {
  const { id } = useParams();
  const [tab, setTab] = useState('encounters');

  const { appointments, loading, patient } = useGetPatient(id);

  const { firstName, lastName } = useMemo(() => {
    if (!patient) return {};
    return {
      firstName: getFirstName(patient),
      lastName: getLastName(patient),
    };
  }, [patient]);

  const latestAppointment = appointments?.[0];

  return (
    <>
      <PageContainer tabTitle="Patient Information">
        <Stack spacing={2}>
          <CustomBreadcrumbs
            chain={[
              { link: '/patients', children: 'Patients' },
              {
                link: '#',
                children: loading ? (
                  <Skeleton width={150} />
                ) : (
                  <>
                    <Typography component="span" sx={{ fontWeight: 700 }}>{`${lastName}, `}</Typography>
                    <Typography component="span">{`${firstName}`}</Typography>
                  </>
                ),
              },
            ]}
          />
          <Typography variant="subtitle1" color="primary.main">
            Patient Record
          </Typography>

          <Paper
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              mt: 2,
              p: 3,
            }}
          >
            <PatientAvatar id={id} />

            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <IdentifiersRow id={id} />

              <FullNameDisplay id={id} />

              <Summary id={id} />

              <Contacts id={id} />

              <Box sx={{ display: 'flex', gap: 1 }}>
                <RoundedButton to={`/patient/${id}/info`}>See All Patient Info</RoundedButton>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {latestAppointment && (
                <RoundedButton
                  target="_blank"
                  sx={{ width: '100%' }}
                  to={
                    latestAppointment.type === 'Telemed'
                      ? `/telemed/appointments/${latestAppointment.id}?tab=sign`
                      : `/in-person/${latestAppointment.id}/progress-note`
                  }
                >
                  Recent Progress Note
                </RoundedButton>
              )}
              <RoundedButton sx={{ width: '100%' }} to={`/patient/${id}/docs`}>
                Review Docs
              </RoundedButton>
            </Box>
          </Paper>

          <TabContext value={tab}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <TabList onChange={(_, newTab) => setTab(newTab)}>
                <Tab
                  value="encounters"
                  label={
                    <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>
                      Visits - {appointments?.length || 0}
                    </Typography>
                  }
                />
                <Tab
                  value="followups"
                  label={
                    <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>
                      Patient Follow-ups
                    </Typography>
                  }
                />
              </TabList>
            </Box>

            <TabPanel value="encounters" sx={{ p: 0 }}>
              <PatientEncountersGrid appointments={appointments} loading={loading} />
            </TabPanel>
            <TabPanel value="followups" sx={{ p: 0 }}>
              <PatientFollowupEncountersGrid patient={patient} loading={loading}></PatientFollowupEncountersGrid>
            </TabPanel>
          </TabContext>
        </Stack>
      </PageContainer>
    </>
  );
}
