import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Paper, Skeleton, Stack, Tab, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { PatientInHouseLabsTab } from 'src/components/PatientInHouseLabsTab';
import { PatientRadiologyTab } from 'src/components/PatientRadiologyTab';
import { getFirstName, getLastName, ServiceMode } from 'utils';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { Contacts, FullNameDisplay, IdentifiersRow, PatientAvatar, Summary } from '../components/patient';
import { PatientFollowupEncountersGrid } from '../components/patient/PatientFollowupEncountersGrid';
import { PatientEncountersGrid } from '../components/PatientEncountersGrid';
import { PatientLabsTab } from '../components/PatientLabsTab';
import { RoundedButton } from '../components/RoundedButton';
import { dataTestIds } from '../constants/data-test-ids';
import { FEATURE_FLAGS } from '../constants/feature-flags';
import { useGetPatient } from '../hooks/useGetPatient';
import PageContainer from '../layout/PageContainer';

export default function PatientPage(): JSX.Element {
  const { id } = useParams();
  const location = useLocation();
  const [tab, setTab] = useState(location.state?.defaultTab || 'encounters');

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
                    <Typography component="span" sx={{ fontWeight: 500 }}>{`${lastName}, `}</Typography>
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
              <FullNameDisplay patient={patient} loading={loading} />
              <Summary patient={patient} loading={loading} />
              <Contacts patient={patient} loading={loading} />

              <Box sx={{ display: 'flex', gap: 1 }}>
                <RoundedButton
                  to={`/patient/${id}/info`}
                  data-testid={dataTestIds.patientRecordPage.seeAllPatientInfoButton}
                >
                  See All Patient Info
                </RoundedButton>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {latestAppointment && (
                <RoundedButton
                  target="_blank"
                  sx={{ width: '100%' }}
                  to={
                    latestAppointment.serviceMode === ServiceMode.virtual
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
                    <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>
                      Visits - {appointments?.length || 0}
                    </Typography>
                  }
                />
                <Tab
                  value="followups"
                  label={
                    <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>
                      Patient Follow-ups
                    </Typography>
                  }
                />
                {FEATURE_FLAGS.LAB_ORDERS_ENABLED && (
                  <Tab
                    value="labs"
                    label={
                      <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>Labs</Typography>
                    }
                  />
                )}
                {FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED && (
                  <Tab
                    value="in-house-labs"
                    label={
                      <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>
                        In-House Labs
                      </Typography>
                    }
                  />
                )}
                {FEATURE_FLAGS.RADIOLOGY_ENABLED && (
                  <Tab
                    value="radiology"
                    label={
                      <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>
                        Radiology
                      </Typography>
                    }
                  />
                )}
              </TabList>
            </Box>

            <TabPanel value="encounters" sx={{ p: 0 }}>
              <PatientEncountersGrid appointments={appointments} loading={loading} />
            </TabPanel>
            <TabPanel value="followups" sx={{ p: 0 }}>
              <PatientFollowupEncountersGrid patient={patient} loading={loading}></PatientFollowupEncountersGrid>
            </TabPanel>
            {FEATURE_FLAGS.LAB_ORDERS_ENABLED && (
              <TabPanel value="labs" sx={{ p: 0 }}>
                <PatientLabsTab patientId={id || ''} />
              </TabPanel>
            )}
            {FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED && (
              <TabPanel value="in-house-labs" sx={{ p: 0 }}>
                <PatientInHouseLabsTab titleText="In-house Labs" patientId={id || ''} />
              </TabPanel>
            )}
            {FEATURE_FLAGS.RADIOLOGY_ENABLED && (
              <TabPanel value="radiology" sx={{ p: 0 }}>
                <PatientRadiologyTab patientId={id || ''} />
              </TabPanel>
            )}
          </TabContext>
        </Stack>
      </PageContainer>
    </>
  );
}
