import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Chip, Grid, IconButton, MenuItem, Skeleton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { TypographyOptions } from '@mui/material/styles/createTypography';
import { styled } from '@mui/system';
import { useQuery } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGetPatientCoverages } from 'src/hooks/useGetPatient';
import {
  getAdmitterPractitionerId,
  getAttendingPractitionerId,
  getInsuranceNameFromCoverage,
  PaymentVariant,
  PRACTITIONER_CODINGS,
  ProviderDetails,
  VisitStatusLabel,
} from 'utils';
import { getEmployees } from '../../../../api/api';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useApiClients } from '../../../../hooks/useAppClients';
import { ProfileAvatar } from '../../shared/components/ProfileAvatar';
import { useChartFields } from '../../shared/hooks/useChartFields';
import { useGetAppointmentAccessibility } from '../../shared/hooks/useGetAppointmentAccessibility';
import { useOystehrAPIClient } from '../../shared/hooks/useOystehrAPIClient';
import { usePractitionerActions } from '../../shared/hooks/usePractitioner';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';
import { ChangeStatusDropdown } from './ChangeStatusDropdown';
import { InternalNotes } from './InternalNotes';
import { PrintVisitLabelButton } from './PrintVisitLabelButton';
import { SwitchIntakeModeButton } from './SwitchIntakeModeButton';

const HeaderWrapper = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: '8px 16px 8px 0',
  borderBottom: `1px solid ${theme.palette.divider}`,
  boxShadow: '0px 2px 4px -1px #00000033',
}));

const PatientName = styled(Typography)(({ theme }) => ({
  ...(theme?.typography as TypographyOptions).h4,
  textAlign: 'left',
  fontWeight: 'bold',
  color: theme.palette.primary.dark,
  cursor: 'pointer',
}));

const PatientMetadata = styled(Typography)(({ theme }) => ({
  fontSize: '14px',
  fontWeight: 400,
  color: theme.palette.text.secondary,
}));

const PatientInfoWrapper = styled(Box)({
  display: 'flex',
  alignItems: 'baseline',
  gap: '8px',
});

const format = (
  value: string | undefined,
  placeholder = '',
  keepPlaceholderIfValueFulfilled = false,
  emptyValuePlaceholder = 'N/A'
): string => {
  const prefix = !value || (keepPlaceholderIfValueFulfilled && value) ? `${placeholder}: ` : '';
  return prefix + (value || emptyValuePlaceholder);
};

const getFollowupStatusChip = (status: 'OPEN' | 'RESOLVED'): ReactElement => {
  interface ColorScheme {
    bg: string;
    text: string;
  }

  type StatusType = 'OPEN' | 'RESOLVED';

  const StatusChip = styled(Chip)(() => ({
    borderRadius: '8px',
    padding: '0 9px',
    margin: 0,
    height: '24px',
    '& .MuiChip-label': {
      padding: 0,
      fontWeight: 'bold',
      fontSize: '0.7rem',
    },
    '& .MuiChip-icon': {
      marginLeft: 'auto',
      marginRight: '-4px',
      order: 1,
    },
  }));

  const statusColors: Record<StatusType, ColorScheme> = {
    OPEN: { bg: '#b3e5fc', text: '#01579B' },
    RESOLVED: { bg: '#c8e6c9', text: '#1b5e20' },
  };
  const statusVal =
    status === 'OPEN'
      ? { statusText: 'OPEN', statusColors: statusColors.OPEN }
      : { statusText: 'RESOLVED', statusColors: statusColors.RESOLVED };
  return (
    <StatusChip
      label={statusVal.statusText}
      sx={{
        backgroundColor: statusVal.statusColors.bg,
        color: statusVal.statusColors.text,
        '& .MuiSvgIcon-root': {
          color: 'inherit',
          fontSize: '1.2rem',
          margin: '0 -4px 0 2px',
        },
      }}
    />
  );
};

export const Header = (): JSX.Element => {
  const { id: appointmentID } = useParams();
  const navigate = useNavigate();

  const {
    resources: { appointment, patient, encounter: encounterValues },
    mappedData,
    visitState,
    appointmentRefetch,
  } = useAppointmentData();

  const apiClient = useOystehrAPIClient();

  const { data: insuranceData } = useGetPatientCoverages({
    apiClient,
    patientId: patient?.id ?? null,
  });

  const { chartData } = useChartData();
  const { encounter } = visitState;
  const encounterId = encounter?.id;
  const { visitType } = useGetAppointmentAccessibility();
  const isFollowup = visitType === 'follow-up';
  const assignedIntakePerformerId = encounter ? getAdmitterPractitionerId(encounter) : undefined;
  const assignedProviderId = encounter ? getAttendingPractitionerId(encounter) : undefined;
  const paymentVariant = format(
    encounterValues?.payment === PaymentVariant.selfPay
      ? 'Self-pay'
      : (insuranceData?.coverages.primary && getInsuranceNameFromCoverage(insuranceData?.coverages.primary)) ??
          (insuranceData?.coverages.secondary && getInsuranceNameFromCoverage(insuranceData?.coverages.secondary))
  );
  const patientName = format(mappedData?.patientName, 'Name');
  const pronouns = format(mappedData?.pronouns, 'Pronouns');
  const gender = format(mappedData?.gender, 'Gender');
  const language = format(mappedData?.preferredLanguage, 'Lang');
  const dob = format(mappedData?.DOB, 'DOB', true);

  const allergies = format(
    chartData?.allergies
      ?.filter((allergy) => allergy.current === true)
      ?.map((allergy) => allergy.name)
      ?.join(', '),
    'Allergy',
    true,
    'none'
  );

  const [shouldRefetchPractitioners, setShouldRefetchPractitioners] = useState(false);

  const { setQueryCache, refetch } = useChartFields({
    requestedFields: {
      practitioners: {},
    },
    enabled: false,
    onSuccess: (data) => {
      if (!data) {
        return;
      }
      setQueryCache({
        practitioners: data.practitioners,
      });
    },
  });

  useEffect(() => {
    if (shouldRefetchPractitioners) {
      console.log('refetching practitioners');
      void refetch();
      setShouldRefetchPractitioners(false);
    }
  }, [shouldRefetchPractitioners, refetch]);

  const reasonForVisit = format(appointment?.description, 'Reason for Visit');
  const userId = format(patient?.id);
  const [_status, setStatus] = useState<VisitStatusLabel | undefined>(undefined);
  const { interactionMode, setInteractionMode } = useInPersonNavigationContext();
  const nextMode = interactionMode === 'intake' ? 'provider' : 'intake';
  const {
    isEncounterUpdatePending: isUpdatingPractitionerForIntake,
    handleUpdatePractitioner: handleUpdatePractitionerForIntake,
  } = usePractitionerActions(encounter, 'start', PRACTITIONER_CODINGS.Admitter);
  const {
    isEncounterUpdatePending: isUpdatingPractitionerForProvider,
    handleUpdatePractitioner: handleUpdatePractitionerForProvider,
  } = usePractitionerActions(encounter, 'start', PRACTITIONER_CODINGS.Attender);
  const isEncounterUpdatePending = isUpdatingPractitionerForIntake || isUpdatingPractitionerForProvider;
  const { oystehrZambda } = useApiClients();

  const { data: employees, isFetching: employeesIsFetching } = useQuery({
    queryKey: ['get-employees', { oystehrZambda }],
    queryFn: async () => {
      if (oystehrZambda) {
        const getEmployeesRes = await getEmployees(oystehrZambda);
        const providers = getEmployeesRes.employees.filter(
          (employee) => employee.isProvider && !employee.isCustomerSupport
        );
        const formattedProviders: ProviderDetails[] = providers.map((prov) => {
          const id = prov.profile.split('/')[1];
          return {
            practitionerId: id,
            name: `${prov.firstName} ${prov.lastName}`,
          };
        });

        // TODO: remove this once we have nurses role
        // const nonProviders = getEmployeesRes.employees.filter((employee) => !employee.isProvider);
        const nonProviders = getEmployeesRes.employees.filter((employee) => !employee.isCustomerSupport);
        const formattedNonProviders: ProviderDetails[] = nonProviders.map((prov) => {
          const id = prov.profile.split('/')[1];
          return {
            practitionerId: id,
            name: `${prov.firstName} ${prov.lastName}`,
          };
        });
        return {
          providers: formattedProviders,
          nonProviders: formattedNonProviders,
        };
      }
      return null;
    },
  });

  if (employeesIsFetching) {
    return <HeaderSkeleton />;
  }

  if (!employees) {
    return <Box sx={{ padding: '16px' }}>There must be some employees registered to use charting.</Box>;
  }

  const handleUpdateIntakeAssignment = async (practitionerId: string): Promise<void> => {
    try {
      if (!appointmentID) return;
      await handleUpdatePractitionerForIntake(practitionerId);
      await appointmentRefetch();
      setShouldRefetchPractitioners(true);
    } catch (error: any) {
      console.log(error.message);
      enqueueSnackbar(`An error occurred trying to update the intake assignment. Please try again.`, {
        variant: 'error',
      });
    }
  };

  const handleUpdateProviderAssignment = async (practitionerId: string): Promise<void> => {
    try {
      if (!appointmentID) return;
      await handleUpdatePractitionerForProvider(practitionerId);
      await appointmentRefetch();
      setShouldRefetchPractitioners(true);
    } catch (error: any) {
      console.log(error.message);
      enqueueSnackbar(`An error occurred trying to update the provider assignment. Please try again.`, {
        variant: 'error',
      });
    }
  };

  const handleSwitchMode = async (): Promise<void> => {
    try {
      if (!appointmentID) return;
      setInteractionMode(nextMode, true);
    } catch (error: any) {
      console.log(error.message);
      enqueueSnackbar(`An error occurred trying to switch to ${nextMode} mode. Please try again.`, {
        variant: 'error',
      });
    }
  };

  return (
    <HeaderWrapper data-testid={dataTestIds.inPersonHeader.container}>
      <Stack flexDirection="row">
        <Box sx={{ width: 70 }} display="flex" alignItems="center" justifyContent="center">
          <IconButton onClick={() => navigate('/visits')} sx={{ width: 40, height: 40 }}>
            <ArrowBackIcon />
          </IconButton>
        </Box>
        <Grid container spacing={2} sx={{ padding: '0 18px 0 4px' }}>
          <Grid item xs={12}>
            <Grid container alignItems="center" justifyContent="space-between">
              <Grid item>
                <Grid container alignItems="center" spacing={2}>
                  <Grid item>
                    {isFollowup ? (
                      getFollowupStatusChip(encounter?.status === 'in-progress' ? 'OPEN' : 'RESOLVED')
                    ) : (
                      <ChangeStatusDropdown
                        appointmentID={appointmentID}
                        onStatusChange={setStatus}
                        dataTestId={dataTestIds.inPersonHeader.changeStatusDropdown}
                      />
                    )}
                  </Grid>
                  <Grid item>
                    <Tooltip title={paymentVariant}>
                      <PatientMetadata
                        sx={{
                          maxWidth: 250,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Payment: {paymentVariant}
                      </PatientMetadata>
                    </Tooltip>
                  </Grid>
                  <Grid item>
                    {isFollowup ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PatientMetadata>Follow-up provider: </PatientMetadata>
                        <TextField
                          select
                          fullWidth
                          data-testid={dataTestIds.inPersonHeader.providerPractitionerInput}
                          sx={{ minWidth: 120 }}
                          variant="standard"
                          value={assignedProviderId ?? ''}
                          disabled={isUpdatingPractitionerForProvider}
                          onChange={(e) => {
                            void handleUpdateProviderAssignment(e.target.value);
                          }}
                        >
                          {employees.providers
                            ?.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                            ?.map((provider) => (
                              <MenuItem key={provider.practitionerId} value={provider.practitionerId}>
                                {provider.name}
                              </MenuItem>
                            ))}
                        </TextField>
                      </Stack>
                    ) : (
                      <Stack direction="row" spacing={2}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <PatientMetadata>Intake: </PatientMetadata>
                          <TextField
                            select
                            fullWidth
                            data-testid={dataTestIds.inPersonHeader.intakePractitionerInput}
                            sx={{ minWidth: 120 }}
                            variant="standard"
                            value={assignedIntakePerformerId ?? ''}
                            disabled={isUpdatingPractitionerForIntake}
                            onChange={(e) => {
                              void handleUpdateIntakeAssignment(e.target.value);
                            }}
                          >
                            {employees.nonProviders
                              ?.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                              ?.map((nonProvider) => (
                                <MenuItem key={nonProvider.practitionerId} value={nonProvider.practitionerId}>
                                  {nonProvider.name}
                                </MenuItem>
                              ))}
                          </TextField>
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center">
                          <PatientMetadata>Provider: </PatientMetadata>
                          <TextField
                            select
                            fullWidth
                            data-testid={dataTestIds.inPersonHeader.providerPractitionerInput}
                            sx={{ minWidth: 120 }}
                            variant="standard"
                            value={assignedProviderId ?? ''}
                            disabled={isUpdatingPractitionerForProvider}
                            onChange={(e) => {
                              void handleUpdateProviderAssignment(e.target.value);
                            }}
                          >
                            {employees.providers
                              ?.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                              ?.map((provider) => (
                                <MenuItem key={provider.practitionerId} value={provider.practitionerId}>
                                  {provider.name}
                                </MenuItem>
                              ))}
                          </TextField>
                        </Stack>
                      </Stack>
                    )}
                  </Grid>
                </Grid>
              </Grid>
              <Grid item>
                <IconButton onClick={() => navigate('/visits')}>
                  <CloseIcon />
                </IconButton>
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs={12} sx={{ mt: -2 }}>
            <Grid container alignItems="center" spacing={2}>
              <Grid item alignSelf={'flex-start'} sx={{ mt: 0.5 }}>
                <ProfileAvatar appointmentID={appointmentID} />
              </Grid>
              <Grid item xs>
                <PatientInfoWrapper>
                  <Grid>
                    <PatientInfoWrapper>
                      <PatientName
                        data-testid={dataTestIds.inPersonHeader.patientName}
                        onClick={() => navigate(`/patient/${userId}`)}
                      >
                        {patientName}
                      </PatientName>
                      <PrintVisitLabelButton encounterId={encounterId} />
                      <PatientMetadata sx={{ fontWeight: 500 }}>{dob}</PatientMetadata> |
                    </PatientInfoWrapper>
                    <PatientInfoWrapper>
                      <PatientMetadata>{pronouns}</PatientMetadata> | <PatientMetadata>{gender}</PatientMetadata> |
                      <PatientMetadata>{language}</PatientMetadata> |<PatientMetadata>{reasonForVisit}</PatientMetadata>
                    </PatientInfoWrapper>
                  </Grid>
                  <PatientMetadata
                    data-testid={dataTestIds.inPersonHeader.allergies}
                    sx={{ fontWeight: chartData?.allergies?.length ? 700 : 400, maxWidth: '60%' }}
                  >
                    {allergies}
                  </PatientMetadata>
                </PatientInfoWrapper>
              </Grid>
              <Grid
                item
                sx={{
                  '@media (max-width: 1179px)': {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                  },
                  alignSelf: 'flex-start',
                  mt: 0.5,
                }}
              >
                {!isFollowup && (
                  <SwitchIntakeModeButton
                    isDisabled={!appointmentID || isEncounterUpdatePending}
                    handleSwitchMode={handleSwitchMode}
                    nextMode={nextMode}
                  />
                )}
                {encounterId ? <InternalNotes /> : null}
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Stack>
    </HeaderWrapper>
  );
};

const HeaderSkeleton = (): JSX.Element => {
  return (
    <HeaderWrapper>
      <Stack flexDirection="row">
        <Box sx={{ width: 70 }} display="flex" alignItems="center" justifyContent="center">
          <Skeleton sx={{ height: 40, width: 40 }} animation="wave" variant="circular" />
        </Box>
        <Grid container spacing={2} sx={{ padding: '0 18px 0 4px' }}>
          <Grid item xs={12}>
            <Grid container alignItems="center" justifyContent="space-between">
              <Grid item>
                <Grid container alignItems="center" spacing={2}>
                  <Grid item>
                    <Skeleton sx={{ width: 120, height: 40 }} animation="wave" />
                  </Grid>
                  <Grid item>
                    <Skeleton sx={{ width: 200 }} animation="wave" variant="text" />
                  </Grid>
                  <Grid item>
                    <Stack direction="row" spacing={2}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Skeleton sx={{ width: 60 }} animation="wave" variant="text" />
                        <Skeleton sx={{ width: 120 }} animation="wave" />
                      </Stack>

                      <Stack direction="row" spacing={1} alignItems="center">
                        <Skeleton sx={{ width: 60 }} animation="wave" variant="text" />
                        <Skeleton sx={{ width: 120 }} animation="wave" />
                      </Stack>
                    </Stack>
                  </Grid>
                </Grid>
              </Grid>
              <Grid item>
                <Skeleton sx={{ height: 40, width: 40 }} animation="wave" variant="circular" />
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs={12} sx={{ mt: -2 }}>
            <Grid container alignItems="center" spacing={2}>
              <Grid item>
                <Skeleton sx={{ height: 50, width: 50 }} animation="wave" variant="circular" />
              </Grid>
              <Grid item xs>
                <PatientInfoWrapper>
                  <Skeleton sx={{ width: 160 }} animation="wave" variant="text" />
                  <Skeleton sx={{ width: 120 }} animation="wave" variant="text" />
                </PatientInfoWrapper>
                <PatientInfoWrapper>
                  <Skeleton sx={{ width: 120 }} animation="wave" variant="text" />
                  <Skeleton sx={{ width: 140 }} animation="wave" variant="text" />
                </PatientInfoWrapper>
              </Grid>
              <Grid
                item
                sx={{
                  '@media (max-width: 1179px)': {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                  },
                }}
              >
                <Skeleton width={200} height={40} animation="wave" />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Stack>
    </HeaderWrapper>
  );
};
