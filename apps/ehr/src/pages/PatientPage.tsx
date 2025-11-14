import PhoneIcon from '@mui/icons-material/Phone';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Paper, Skeleton, Stack, Tab, Typography } from '@mui/material';
import { IconButton } from '@mui/material';
import { Alert, Snackbar } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { DeviceVitalsPage } from 'src/components/DeviceVitalsPage';
import { PatientDevicesTab } from 'src/components/PatientDevicesTab';
import { PatientInHouseLabsTab } from 'src/components/PatientInHouseLabsTab';
import { PatientRadiologyTab } from 'src/components/PatientRadiologyTab';
import { PatientReportsTab } from 'src/components/PatientReportsTab';
import { ThresholdsTable } from 'src/components/ThresholdGrid';
import { loadRingCentralWidget, postToEmbeddable, waitForRingCentralReady } from 'src/hooks/useRingCentral';
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
import { PatientSummaryModal } from './PatientSummaryModal';

export default function PatientPage(): JSX.Element {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(location.state?.defaultTab || 'encounters');
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<{
    id: string;
    deviceType: string;
    thresholds: any;
    name: string;
  } | null>(null);
  const { appointments, loading, patient } = useGetPatient(id);

  const { firstName, lastName } = useMemo(() => {
    if (!patient) return {};
    return {
      firstName: getFirstName(patient),
      lastName: getLastName(patient),
    };
  }, [patient]);

  const latestAppointment = appointments?.[0];

  useEffect(() => {
    const deviceId = searchParams.get('deviceId');
    if (deviceId) {
      setTab('devices');
      if (location.state?.selectedDevice) {
        setSelectedDevice(location.state.selectedDevice);
      } else {
        setSelectedDevice({
          id: deviceId,
          deviceType: '',
          thresholds: [],
          name: '-',
        });
      }
    }
  }, [searchParams, location.state]);

  const handleOpenSummaryModal = (): void => {
    setIsSummaryModalOpen(true);
  };

  const handleCloseSummaryModal = (): void => {
    setIsSummaryModalOpen(false);
  };

  const patientPhoneNumber = useMemo(() => {
    if (!patient?.telecom) return null;

    const mobilePhone = patient.telecom.find((t) => t.system === 'phone');
    console.log('mobilePhone', mobilePhone);

    return mobilePhone?.value;
  }, [patient]);

  const handleRingCentralCall = async (): Promise<void> => {
    if (!patientPhoneNumber) {
      setSnackbarMessage('This patient does not have a phone number allocated.');
      setSnackbarOpen(true);
      return;
    }

    try {
      await loadRingCentralWidget();

      await waitForRingCentralReady();

      postToEmbeddable({ type: 'rc-adapter-show' });
      postToEmbeddable({ type: 'rc-adapter-navigate-to', path: '/dialer' });
      postToEmbeddable({
        type: 'rc-adapter-new-call',
        phoneNumber: patientPhoneNumber,
      });

      const minimizedHeader = document.querySelector('#rc-widget.Adapter_minimized .Adapter_header') as HTMLElement;
      const toggleButton = document.querySelector('#rc-widget [data-sign="adapterToggle"]') as HTMLElement;

      if (minimizedHeader) {
        minimizedHeader.click();
      } else if (toggleButton) {
        toggleButton.click();
      } else {
        console.warn('RingCentral widget not found');
      }
    } catch (err) {
      console.error('Error initializing RingCentral message widget:', err);
    }
  };

  return (
    <>
      <PageContainer tabTitle="Patient Information">
        <Stack spacing={4}>
          <Paper
            sx={{
              p: 'none',
              m: 'none',
              flexWrap: 'wrap',
              flexDirection: { xs: 'column', md: 'row' },
              display: 'flex',
              alignItems: { xs: 'stretch', md: 'center' },
              border: 'none',
              boxShadow: 'none',
              backgroundColor: 'transparent',
              justifyContent: 'space-between',
            }}
          >
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
          </Paper>
          <Typography variant="subtitle1" color="primary.main">
            Patient Record
          </Typography>

          <Paper
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              flexDirection: { xs: 'column', sm: 'column', md: 'column', lg: 'row' },
              alignItems: { xs: 'stretch', md: 'center' },
              flexWrap: { xs: 'wrap', sm: 'wrap', md: 'wrap', lg: 'nowrap' },
              p: 3,
            }}
          >
            <Box sx={{ display: 'flex', width: '100%', justifyContent: 'start', alignItems: 'center', gap: 4 }}>
              <PatientAvatar id={id} />

              <Box sx={{ flexGrow: 1, maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <IdentifiersRow id={id} />
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 1.5,
                  }}
                >
                  <FullNameDisplay patient={patient} loading={loading} />

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* RingCentral Voice Call */}
                    <IconButton
                      size="small"
                      sx={{
                        padding: '10px',
                        minWidth: '36px',
                        border: '1px solid #43A047',
                        '&:hover': { bgcolor: '#C8E6C9' },
                        '&:disabled': {
                          border: '1px solid #BDBDBD',
                          backgroundColor: '#F5F5F5',
                        },
                      }}
                      aria-label="ringcentral call"
                      onClick={() => handleRingCentralCall()}
                    >
                      <PhoneIcon
                        sx={{
                          color: '#43A047',
                        }}
                      />
                    </IconButton>
                  </Box>
                </Box>

                <Summary patient={patient} loading={loading} />
                <Contacts patient={patient} loading={loading} />

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <RoundedButton
                    to={`/patient/${id}/info`}
                    data-testid={dataTestIds.patientRecordPage.seeAllPatientInfoButton}
                  >
                    See All Patient Info
                  </RoundedButton>
                  <RoundedButton to={`/patient/${id}/docs`}>Review Docs</RoundedButton>
                  <RoundedButton onClick={handleOpenSummaryModal}>Summary</RoundedButton>
                  {latestAppointment && (
                    <RoundedButton
                      target="_blank"
                      to={
                        latestAppointment.serviceMode === ServiceMode.virtual
                          ? `/telemed/appointments/${latestAppointment.id}?tab=sign`
                          : `/in-person/${latestAppointment.id}/progress-note`
                      }
                    >
                      Recent Progress Note
                    </RoundedButton>
                  )}
                </Box>
              </Box>
            </Box>

            <Box>
              <ThresholdsTable />
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
                {FEATURE_FLAGS.DEVICES_ENABLED && (
                  <Tab
                    value="devices"
                    label={
                      <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>Devices</Typography>
                    }
                  />
                )}
                {FEATURE_FLAGS.REPORTS_ENABLED && (
                  <Tab
                    value="reports"
                    label={
                      <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>Reports</Typography>
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
            {FEATURE_FLAGS.DEVICES_ENABLED && (
              <TabPanel value="devices" sx={{ p: 0 }}>
                {selectedDevice ? (
                  <DeviceVitalsPage
                    patientId={id!}
                    deviceId={selectedDevice.id}
                    deviceType={selectedDevice.deviceType}
                    thresholds={selectedDevice.thresholds}
                    name={selectedDevice.name}
                    onBack={() => setSelectedDevice(null)}
                  />
                ) : (
                  <PatientDevicesTab
                    loading={loading}
                    onViewVitals={(deviceId: string, deviceType: string, thresholds: any, name: string) =>
                      setSelectedDevice({ id: deviceId, deviceType, thresholds, name })
                    }
                  />
                )}
              </TabPanel>
            )}
            {FEATURE_FLAGS.REPORTS_ENABLED && (
              <TabPanel value="reports" sx={{ p: 0 }}>
                <PatientReportsTab />
              </TabPanel>
            )}
          </TabContext>
        </Stack>
      </PageContainer>
      <PatientSummaryModal
        open={isSummaryModalOpen}
        onClose={handleCloseSummaryModal}
        patientId={id}
        loading={loading}
      />
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="warning" sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
}
