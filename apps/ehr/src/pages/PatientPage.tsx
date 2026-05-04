import MergeIcon from '@mui/icons-material/MergeType';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Alert, Box, Button, Paper, Skeleton, Stack, Tab, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { AccountSettingsDialog } from 'src/components/dialogs/AccountSettingsDialog';
import { PatientInHouseLabsTab } from 'src/components/PatientInHouseLabsTab';
import { PatientRadiologyTab } from 'src/components/PatientRadiologyTab';
import { ROUTER_PATH } from 'src/features/visits/in-person/routing/routesInPerson';
import { PatientAvatar } from 'src/features/visits/shared/components/patient/info/Avatar';
import Contacts from 'src/features/visits/shared/components/patient/info/Contacts';
import { FullNameDisplay } from 'src/features/visits/shared/components/patient/info/FullNameDisplay';
import { IdentifiersRow } from 'src/features/visits/shared/components/patient/info/IdentifiersRow';
import Summary from 'src/features/visits/shared/components/patient/info/Summary';
import { PatientFollowupEncountersGrid } from 'src/features/visits/shared/components/patient/PatientFollowupEncountersGrid';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { getFirstName, getLastName, RoleType } from 'utils';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { PatientEncountersGrid } from '../components/PatientEncountersGrid';
import { PatientLabsTab } from '../components/PatientLabsTab';
import { PatientMergedBanner } from '../components/PatientMergedBanner';
import { PatientsMergeDifference } from '../components/patients-merge/PatientsMergeDifference';
import { RoundedButton } from '../components/RoundedButton';
import { dataTestIds } from '../constants/data-test-ids';
import { FEATURE_FLAGS } from '../constants/feature-flags';
import { useGetPatient } from '../hooks/useGetPatient';
import { useGetPatientVisitHistory } from '../hooks/useGetPatientVisitHistory';
import PageContainer from '../layout/PageContainer';

export default function PatientPage(): JSX.Element {
  const { id } = useParams();
  const location = useLocation();
  const defaultTab = location.state?.defaultTab;
  const isLegacyPatientFollowupsEnabled = FEATURE_FLAGS.LEGACY_PATIENT_FOLLOWUPS_ENABLED;
  const [tab, setTab] = useState(
    !isLegacyPatientFollowupsEnabled && defaultTab === 'followups' ? 'encounters' : defaultTab || 'encounters'
  );
  const [showAccountSettingsDialog, setShowAccountSettingsDialog] = useState(false);
  const [mergePatientIds, setMergePatientIds] = useState<[string, string] | null>(null);

  const currentUser = useEvolveUser();
  const isAdmin = currentUser?.hasRole([RoleType.Administrator]) ?? false;

  const { loading, patient, duplicatePatients } = useGetPatient(id);

  const handleMergeClick = (): void => {
    if (!isAdmin) {
      enqueueSnackbar('You are not authorized to make this action. Please contact the administrator.', {
        variant: 'error',
      });
      return;
    }
    if (id && duplicatePatients[0]?.id) {
      setMergePatientIds([id, duplicatePatients[0].id]);
    }
  };

  const isMergedPatient = patient?.active === false && patient?.link?.some((l) => l.type === 'replaced-by');

  const { firstName, lastName } = useMemo(() => {
    if (!patient) return {};
    return {
      firstName: getFirstName(patient),
      lastName: getLastName(patient),
    };
  }, [patient]);

  const { data: visitHistory } = useGetPatientVisitHistory(patient?.id);

  const appointments = visitHistory?.visits || [];
  const latestAppointment = appointments?.[0];

  return (
    <>
      <PageContainer tabTitle="Patient Profile">
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
            Visit History
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
              <IdentifiersRow patient={patient} loading={loading} />
              <FullNameDisplay patient={patient} loading={loading} />
              <Summary patient={patient} loading={loading} />
              <Contacts patient={patient} loading={loading} />

              <Box sx={{ display: 'flex', gap: 1 }}>
                <RoundedButton
                  to={`/patient/${id}/info`}
                  data-testid={dataTestIds.patientRecordPage.seeAllPatientInfoButton}
                >
                  View Patient Profile
                </RoundedButton>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {latestAppointment && (
                <RoundedButton
                  target="_blank"
                  sx={{ width: '100%' }}
                  to={`/in-person/${latestAppointment.appointmentId}/${ROUTER_PATH.REVIEW_AND_SIGN}`}
                >
                  Recent Progress Note
                </RoundedButton>
              )}
              <RoundedButton sx={{ width: '100%' }} to={`/patient/${id}/docs`}>
                Review Docs
              </RoundedButton>
              <RoundedButton sx={{ width: '100%' }} onClick={() => setShowAccountSettingsDialog(true)}>
                Account Settings
              </RoundedButton>
            </Box>
          </Paper>

          <PatientMergedBanner patient={patient} />

          {!isMergedPatient && (
            <>
              {duplicatePatients.length > 0 && id && (
                <Alert
                  severity="warning"
                  action={
                    <Button color="warning" size="small" startIcon={<MergeIcon />} onClick={handleMergeClick}>
                      Merge Patients
                    </Button>
                  }
                >
                  Potential duplicate patients found
                </Alert>
              )}

              {mergePatientIds && (
                <PatientsMergeDifference
                  open
                  close={() => setMergePatientIds(null)}
                  patientIds={mergePatientIds}
                  onSuccess={() => setMergePatientIds(null)}
                />
              )}

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
                    {isLegacyPatientFollowupsEnabled && (
                      <Tab
                        value="followups"
                        label={
                          <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>
                            Patient Follow-ups
                          </Typography>
                        }
                      />
                    )}
                    {FEATURE_FLAGS.LAB_ORDERS_ENABLED && (
                      <Tab
                        data-testid={dataTestIds.externalLabs.patientRecordLabsTab}
                        value="labs"
                        label={
                          <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>
                            Labs
                          </Typography>
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
                  <PatientEncountersGrid
                    patient={patient}
                    totalCount={appointments.length}
                    latestVisitDate={latestAppointment?.dateTime ?? null}
                  />
                </TabPanel>
                {isLegacyPatientFollowupsEnabled && (
                  <TabPanel value="followups" sx={{ p: 0 }}>
                    <PatientFollowupEncountersGrid patient={patient} loading={loading}></PatientFollowupEncountersGrid>
                  </TabPanel>
                )}
                {FEATURE_FLAGS.LAB_ORDERS_ENABLED && (
                  <TabPanel value="labs" sx={{ p: 0 }}>
                    <PatientLabsTab patientId={id || ''} />
                  </TabPanel>
                )}
                {FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED && (
                  <TabPanel value="in-house-labs" sx={{ p: 0 }}>
                    <PatientInHouseLabsTab titleText="In-House Labs" patientId={id || ''} />
                  </TabPanel>
                )}
                {FEATURE_FLAGS.RADIOLOGY_ENABLED && (
                  <TabPanel value="radiology" sx={{ p: 0 }}>
                    <PatientRadiologyTab patientId={id || ''} />
                  </TabPanel>
                )}
              </TabContext>
              {showAccountSettingsDialog ? (
                <AccountSettingsDialog
                  patientId={id ?? ''}
                  handleClose={(): void => {
                    setShowAccountSettingsDialog(false);
                  }}
                />
              ) : null}
            </>
          )}
        </Stack>
      </PageContainer>
    </>
  );
}
