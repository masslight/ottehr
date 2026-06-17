import { progressNoteIcon } from '@ehrTheme/icons';
import ContactPageOutlinedIcon from '@mui/icons-material/ContactPageOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import MergeIcon from '@mui/icons-material/MergeType';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Alert, Box, Button, CircularProgress, Paper, Skeleton, Stack, Tab, Tooltip, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
import { useDownloadMedicalRecord } from 'src/hooks/useDownloadMedicalRecord';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useGetActiveMergeTask } from 'src/hooks/useGetPatient';
import { otherColors } from 'src/themes/ottehr/colors';
import { getFirstName, getLastName, RoleType } from 'utils';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import GoToButton from '../components/GoToButton';
import { PatientEncountersGrid } from '../components/PatientEncountersGrid';
import { PatientLabsTab } from '../components/PatientLabsTab';
import { PatientMergedBanner } from '../components/PatientMergedBanner';
import { PatientsMergeDifference } from '../components/patients-merge/PatientsMergeDifference';
import { dataTestIds } from '../constants/data-test-ids';
import { FEATURE_FLAGS } from '../constants/feature-flags';
import { useApiClients } from '../hooks/useAppClients';
import { useGetPatient } from '../hooks/useGetPatient';
import { useGetPatientVisitHistory } from '../hooks/useGetPatientVisitHistory';
import PageContainer from '../layout/PageContainer';

export default function PatientPage(): JSX.Element {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
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

  const { downloadMedicalRecord, isDownloading: isDownloadingMedicalRecord } = useDownloadMedicalRecord(id);

  const queryClient = useQueryClient();
  const { data: mergeTaskData, refetch: refetchMergeTask } = useGetActiveMergeTask(id);
  const activeMergeTask = mergeTaskData?.task ?? null;
  const mergeFailed = activeMergeTask?.status === 'failed';
  const mergeInProgress = !!activeMergeTask && !mergeFailed;
  const wasMergeInProgressRef = useRef(false);

  const { oystehr: oystehrAdmin } = useApiClients();
  const handleDismissMergeTask = async (): Promise<void> => {
    if (!activeMergeTask?.id || !oystehrAdmin) return;
    try {
      await oystehrAdmin.fhir.patch({
        resourceType: 'Task',
        id: activeMergeTask.id,
        operations: [
          { op: 'replace', path: '/status', value: 'cancelled' },
          {
            op: 'add',
            path: '/statusReason',
            value: { text: 'Dismissed by user' },
          },
        ],
      });
      await refetchMergeTask();
    } catch (e) {
      enqueueSnackbar('Failed to dismiss the merge task. Please try again.', { variant: 'error' });
      console.error('Dismiss merge task error', e);
    }
  };

  // When the merge task disappears (completed/failed), refresh patient/coverage
  // queries so the UI picks up the merged state.
  useEffect(() => {
    if (mergeTaskData && mergeTaskData.task === null) {
      if (wasMergeInProgressRef.current) {
        enqueueSnackbar('Patients merged successfully', { variant: 'success' });
      }
      void queryClient.refetchQueries({ queryKey: ['useGetPatientPatientResources'], type: 'all' });
      void queryClient.refetchQueries({ queryKey: ['patient-account-get'], type: 'all' });
      void queryClient.refetchQueries({ queryKey: ['patient-coverages'], type: 'all' });
      void queryClient.refetchQueries({ queryKey: ['otherPatientsWithSameNameResources'], type: 'all' });
    }
    if (mergeInProgress) {
      wasMergeInProgressRef.current = true;
    }
  }, [mergeTaskData, mergeInProgress, queryClient]);

  const handleMergeClick = (): void => {
    if (mergeInProgress) {
      enqueueSnackbar('A merge is already in progress for this patient.', { variant: 'info' });
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
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1,
                alignSelf: 'flex-start',
              }}
            >
              {latestAppointment && (
                <GoToButton
                  text="Progress Note"
                  backgroundColor={otherColors.lightBlue}
                  onClick={() =>
                    window.open(
                      `/in-person/${latestAppointment.appointmentId}/${ROUTER_PATH.REVIEW_AND_SIGN}`,
                      '_blank',
                      'noopener,noreferrer'
                    )
                  }
                >
                  <img src={progressNoteIcon} alt="" />
                </GoToButton>
              )}
              {!isMergedPatient && (
                <>
                  <GoToButton
                    text="Patient Profile"
                    backgroundColor={otherColors.lightBlue}
                    dataTestId={dataTestIds.patientRecordPage.seeAllPatientInfoButton}
                    onClick={() => navigate(`/patient/${id}/info`)}
                  >
                    <ContactPageOutlinedIcon />
                  </GoToButton>
                  <GoToButton
                    text="Account Settings"
                    backgroundColor={otherColors.lightBlue}
                    onClick={() => setShowAccountSettingsDialog(true)}
                  >
                    <SettingsOutlinedIcon />
                  </GoToButton>
                  <GoToButton
                    text="Review Docs"
                    backgroundColor={otherColors.lightBlue}
                    onClick={() => navigate(`/patient/${id}/docs`)}
                  >
                    <DescriptionOutlinedIcon />
                  </GoToButton>
                  <GoToButton
                    text="Medical Record"
                    backgroundColor={otherColors.lightBlue}
                    loading={isDownloadingMedicalRecord}
                    onClick={downloadMedicalRecord}
                  >
                    <Inventory2OutlinedIcon />
                  </GoToButton>
                </>
              )}
            </Box>
          </Paper>

          <PatientMergedBanner patient={patient} />

          {mergeInProgress && (
            <Alert
              severity="info"
              icon={<CircularProgress size={20} />}
              sx={{ '& .MuiAlert-icon': { display: 'flex', alignItems: 'center' } }}
            >
              Patients merge in progress (merging with patient {activeMergeTask?.otherPatientId || 'unknown'})
            </Alert>
          )}

          {mergeFailed && (
            <Alert
              severity="error"
              action={
                <Button color="error" size="small" onClick={() => void handleDismissMergeTask()}>
                  Dismiss
                </Button>
              }
            >
              Patients merge failed
              {activeMergeTask?.otherPatientId ? ` (with patient ${activeMergeTask.otherPatientId})` : ''}:{' '}
              {activeMergeTask?.statusReason || 'Unknown error.'}
            </Alert>
          )}

          {!isMergedPatient && (
            <>
              {!mergeInProgress && !mergeFailed && duplicatePatients.length > 0 && id && (
                <Alert
                  severity="warning"
                  action={
                    <Tooltip
                      title={!isAdmin ? 'To merge patients you must have the Administrator role' : ''}
                      placement="top"
                    >
                      <span>
                        <Button
                          color="warning"
                          size="small"
                          startIcon={<MergeIcon />}
                          onClick={handleMergeClick}
                          disabled={!isAdmin}
                        >
                          Merge Patients
                        </Button>
                      </span>
                    </Tooltip>
                  }
                >
                  Potential duplicate patients found
                </Alert>
              )}

              {mergePatientIds && !mergeInProgress && !mergeFailed && (
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
