import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  Box,
  Chip,
  FormControlLabel,
  Grid,
  IconButton,
  Link,
  ListItemIcon,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { TypographyOptions } from '@mui/material/styles/createTypography';
import { styled } from '@mui/system';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { CommandPaletteSearchButton } from 'src/components/CommandPaletteSearchButton';
import { CreateTaskDialog } from 'src/features/tasks/components/CreateTaskDialog';
import { useGetPatientCoverages } from 'src/hooks/useGetPatient';
import { formatLabelValue } from 'src/shared/utils';
import {
  FhirAppointmentType,
  formatDateToMDYWithTime,
  formatWeightKg,
  getAdmitterPractitionerId,
  getAnnotationFollowupStatusLabel,
  getAppointmentServiceCategoryAbbreviation,
  getAttendingPractitionerId,
  getEncounterLocationId,
  getFullestAvailableName,
  getInitialEncounterIdForFollowUp,
  getInsuranceNameFromCoverage,
  isInPersonAppointment,
  PaymentVariant,
  PRACTITIONER_CODINGS,
  ProviderDetails,
  VisitStatusLabel,
  VitalFieldNames,
  type VitalsWeightObservationDTO,
} from 'utils';
import { getEmployees } from '../../../../api/api';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useApiClients } from '../../../../hooks/useAppClients';
import { ProfileAvatar } from '../../shared/components/ProfileAvatar';
import { useGetHistoricalVitals, useGetVitals } from '../../shared/components/vitals/hooks/useGetVitals';
import { useChartFields } from '../../shared/hooks/useChartFields';
import { useGetAppointmentAccessibility } from '../../shared/hooks/useGetAppointmentAccessibility';
import { useGroupMemberPractitionerIds } from '../../shared/hooks/useGroupMemberPractitionerIds';
import { useOystehrAPIClient } from '../../shared/hooks/useOystehrAPIClient';
import { usePractitionerActions } from '../../shared/hooks/usePractitioner';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { ChangeStatusDropdown } from './ChangeStatusDropdown';
import { InternalNotes } from './InternalNotes';
import { PrintVisitLabelButton } from './PrintVisitLabelButton';

const HeaderWrapper = styled(Box)(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: 100,
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

const getPatientWeightFallback = (weight: string | undefined): string | undefined => {
  const normalizedWeight = weight?.replace(/\s/g, '');
  return normalizedWeight?.match(/^\d+(?:\.\d+)?kg/)?.[0];
};

const getWeightRefusedLabel = (): string => 'Weight: Patient Refused';

const isPatientRefusedWeightObservation = (observation: VitalsWeightObservationDTO): boolean =>
  observation.extraWeightOptions?.includes('patient_refused') ?? false;

const getDisplayWeight = (
  currentObservations: VitalsWeightObservationDTO[],
  historicalObservations: VitalsWeightObservationDTO[],
  patientWeight: string | undefined
): string | undefined => {
  const latestDisplayableObservation = [...currentObservations, ...historicalObservations].find(
    (observation) => isPatientRefusedWeightObservation(observation) || typeof observation.value === 'number'
  );

  if (latestDisplayableObservation) {
    if (isPatientRefusedWeightObservation(latestDisplayableObservation)) {
      return getWeightRefusedLabel();
    }

    if (typeof latestDisplayableObservation.value === 'number') {
      return `${formatWeightKg(latestDisplayableObservation.value)}kg`;
    }
  }

  if (currentObservations.length === 0 && historicalObservations.length === 0) {
    return getPatientWeightFallback(patientWeight);
  }

  return undefined;
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
  const theme = useTheme();

  const {
    resources: { appointment: appointmentValues, patient, encounter: encounterValues },
    mappedData,
    appointment,
    practitioners,
    group,
    location,
    locations,
    encounter,
    followUpOriginEncounter,
    appointmentRefetch,
    selectedEncounterId,
  } = useAppointmentData();

  const apiClient = useOystehrAPIClient();

  const { data: insuranceData } = useGetPatientCoverages({
    apiClient,
    patientId: patient?.id ?? null,
  });

  const { visitType } = useGetAppointmentAccessibility();
  const isFollowup = visitType === 'follow-up';

  const { chartData } = useChartData();

  const effectiveEncounterId = selectedEncounterId ?? encounter?.id;
  const { data: encounterVitals } = useGetVitals(effectiveEncounterId);
  const { data: historicalVitals } = useGetHistoricalVitals(effectiveEncounterId);

  const start = encounter?.period?.start ?? appointmentValues?.start;

  let optionalVisitLabel = '';

  if (isFollowup) {
    const locationId = getEncounterLocationId(encounter);
    if (locationId) {
      const matchedLocation = locations.find((location) => location?.id === locationId);
      optionalVisitLabel = matchedLocation?.name ?? '';
    }
  } else {
    if (!optionalVisitLabel && appointment?.participant?.length) {
      const nonPatientParticipant = appointment.participant.find(
        (p) => typeof p?.actor?.reference === 'string' && !p.actor.reference.includes('Patient/')
      );

      const ref = nonPatientParticipant?.actor?.reference;

      if (ref) {
        const [type, id] = ref.split('/');

        if (type === 'Location' && location?.name) {
          optionalVisitLabel = location.name;
        }

        if (type === 'HealthcareService' && group?.name) {
          optionalVisitLabel = group.name;
        }

        const visitOwner = practitioners?.find((p) => p?.id === id);
        if (type === 'Practitioner' && visitOwner) {
          optionalVisitLabel = getFullestAvailableName(visitOwner) ?? '';
        }
      }
    }
  }

  const userTimezone = DateTime.local().zoneName;
  const { date = '', time = '' } = formatDateToMDYWithTime(start, userTimezone) ?? {};
  const visitText = `Visit: ${date} ${time}${optionalVisitLabel ? ` | ${optionalVisitLabel}` : ''}`.trim();
  const serviceCategory = getAppointmentServiceCategoryAbbreviation(appointment);
  const visitBookingType = appointment
    ? appointment.appointmentType?.text === FhirAppointmentType.prebook
      ? 'Scheduled'
      : 'On Demand'
    : undefined;
  const visitTypeAndCategory = [isInPersonAppointment(appointment) ? 'In Person' : 'Virtual', serviceCategory]
    .filter(Boolean)
    .join(' | ');

  const assignedIntakePerformerId = encounter ? getAdmitterPractitionerId(encounter) : undefined;
  const assignedProviderId = encounter ? getAttendingPractitionerId(encounter) : undefined;
  const paymentVariant = formatLabelValue(
    encounterValues?.payment === PaymentVariant.selfPay
      ? 'Self-pay'
      : (insuranceData?.coverages.primary && getInsuranceNameFromCoverage(insuranceData?.coverages.primary)) ??
          (insuranceData?.coverages.secondary && getInsuranceNameFromCoverage(insuranceData?.coverages.secondary))
  );
  const patientName = formatLabelValue(mappedData?.patientName, 'Name');
  const pronouns = formatLabelValue(mappedData?.pronouns, 'Pronouns');
  const gender = formatLabelValue(mappedData?.gender, 'Gender');
  const language = formatLabelValue(mappedData?.preferredLanguage, 'Lang');
  const dob = formatLabelValue(mappedData?.DOB, 'DOB', true);
  const weight = getDisplayWeight(
    encounterVitals?.[VitalFieldNames.VitalWeight] ?? [],
    historicalVitals?.[VitalFieldNames.VitalWeight] ?? [],
    mappedData?.weight
  );

  const allergies = formatLabelValue(
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

  const reasonForVisit = formatLabelValue(appointmentValues?.description, 'Reason for Visit');
  const userId = formatLabelValue(patient?.id);
  const [_status, setStatus] = useState<VisitStatusLabel | undefined>(undefined);
  const [headerMenuAnchorEl, setHeaderMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const {
    isEncounterUpdatePending: isUpdatingPractitionerForIntake,
    handleUpdatePractitioner: handleUpdatePractitionerForIntake,
  } = usePractitionerActions(encounter, 'start', PRACTITIONER_CODINGS.Admitter);
  const {
    isEncounterUpdatePending: isUpdatingPractitionerForProvider,
    handleUpdatePractitioner: handleUpdatePractitionerForProvider,
  } = usePractitionerActions(encounter, 'start', PRACTITIONER_CODINGS.Attender);

  const { oystehrZambda } = useApiClients();

  const { data: employees, isLoading: employeesIsLoading } = useQuery({
    queryKey: ['progress-note-header-employees'],
    queryFn: async () => {
      if (!oystehrZambda) return null;
      const getEmployeesRes = await getEmployees(oystehrZambda, { lite: true });
      const activeEmployees = getEmployeesRes.employees.filter((employee) => employee.status === 'Active');
      const providers = activeEmployees.filter((employee) => employee.isProvider && !employee.isCustomerSupport);
      const formattedProviders: ProviderDetails[] = providers
        .map((prov) => {
          const id = prov.profile.split('/')[1];
          return {
            practitionerId: id,
            name: `${prov.firstName} ${prov.lastName}`.trim(),
          };
        })
        .filter((prov) => prov.name);

      // TODO: remove this once we have nurses role
      // const nonProviders = getEmployeesRes.employees.filter((employee) => !employee.isProvider);
      const nonProviders = activeEmployees.filter((employee) => !employee.isCustomerSupport);
      const formattedNonProviders: ProviderDetails[] = nonProviders
        .map((prov) => {
          const id = prov.profile.split('/')[1];
          return {
            practitionerId: id,
            name: `${prov.firstName} ${prov.lastName}`.trim(),
          };
        })
        .filter((prov) => prov.name);
      return {
        providers: formattedProviders,
        nonProviders: formattedNonProviders,
      };
    },
    enabled: !!oystehrZambda,
    // Employees rarely change — cache across navigations to keep the header fast.
    staleTime: 5 * 60 * 1000,
  });

  // Group-membership filter for the Provider/ATND dropdown. Only renders when
  // the appointment came through a group HS — confines the picker to the
  // group's roster so the front desk doesn't unknowingly assign outside it.
  // Toggle defaults on; user can flip it off when a deliberate cross-group
  // assignment is needed.
  const groupMemberPractitionerIds = useGroupMemberPractitionerIds(group);
  const [restrictProvidersToGroup, setRestrictProvidersToGroup] = useState(true);
  const filteredProviders =
    group && restrictProvidersToGroup && groupMemberPractitionerIds
      ? employees?.providers?.filter((p) => groupMemberPractitionerIds.includes(p.practitionerId))
      : employees?.providers;

  if (!employeesIsLoading && oystehrZambda && !employees) {
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
            <Grid container alignItems="center" justifyContent="space-between" wrap="nowrap">
              <Grid item>
                <Grid container alignItems="center" spacing={2} wrap="nowrap">
                  <Grid item>
                    {isFollowup ? (
                      getFollowupStatusChip(getAnnotationFollowupStatusLabel(encounter?.status))
                    ) : (
                      <ChangeStatusDropdown
                        appointmentID={appointmentID}
                        onStatusChange={setStatus}
                        dataTestId={dataTestIds.inPersonHeader.changeStatusDropdown}
                      />
                    )}
                  </Grid>
                  <Grid item>
                    <Link
                      component={RouterLink}
                      to={`/visit/${appointmentValues?.id}`}
                      variant="body2"
                      sx={{
                        color: theme.palette.text.secondary,
                        textDecorationColor: theme.palette.text.secondary,
                      }}
                    >
                      <PatientMetadata sx={{ whiteSpace: 'nowrap' }}>{visitText}</PatientMetadata>
                    </Link>
                  </Grid>
                  {visitTypeAndCategory && (
                    <Grid item>
                      <PatientMetadata sx={{ whiteSpace: 'nowrap' }}>{visitTypeAndCategory}</PatientMetadata>
                    </Grid>
                  )}
                  {visitBookingType && (
                    <Grid item>
                      <PatientMetadata sx={{ whiteSpace: 'nowrap' }}>{visitBookingType}</PatientMetadata>
                    </Grid>
                  )}
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
                        <PatientMetadata sx={{ whiteSpace: 'nowrap' }}>Follow-up provider: </PatientMetadata>
                        {employees ? (
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
                        ) : (
                          <Skeleton sx={{ width: 120, minWidth: 120 }} animation="wave" />
                        )}
                      </Stack>
                    ) : (
                      <Stack direction="row" spacing={2}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <PatientMetadata>Intake: </PatientMetadata>
                          {employees ? (
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
                          ) : (
                            <Skeleton sx={{ width: 120, minWidth: 120 }} animation="wave" />
                          )}
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center">
                          <PatientMetadata>Provider: </PatientMetadata>
                          {employees ? (
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
                              {group && (
                                <MenuItem
                                  // Embedding a non-option control inside a MUI Select
                                  // menu requires defending against several behaviors that
                                  // would otherwise close the dropdown on every toggle:
                                  //   - `disabled` makes Select's selection logic skip
                                  //     this child instead of treating clicks as option
                                  //     picks. The sx overrides undo `disabled`'s visual
                                  //     dimming and pointer-events blocking so the Switch
                                  //     stays interactive.
                                  //   - Stops on mousedown/click/keydown at the MenuItem
                                  //     level catch Select's event delegation before it
                                  //     can read the toggle interaction as an option pick.
                                  //   - Stops on the Switch's own change/click prevent the
                                  //     events from bubbling to any parent input listener.
                                  //   - `inputProps.tabIndex: -1` keeps focus on the
                                  //     MenuList — without it the hidden checkbox grabs
                                  //     focus on click and the Menu closes thinking focus
                                  //     left the option list.
                                  // We don't know which single piece is sufficient (each
                                  // trim attempt regressed). Treat this as a load-bearing
                                  // bundle and edit only when MUI behavior changes.
                                  disabled
                                  disableRipple
                                  sx={{
                                    px: 2,
                                    py: 1,
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                    cursor: 'default',
                                    '&.Mui-disabled': {
                                      opacity: 1,
                                      pointerEvents: 'auto',
                                    },
                                    '&:hover': { backgroundColor: 'transparent' },
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  <FormControlLabel
                                    onClick={(e) => e.stopPropagation()}
                                    control={
                                      <Switch
                                        size="small"
                                        checked={restrictProvidersToGroup}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          setRestrictProvidersToGroup(e.target.checked);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        inputProps={{ tabIndex: -1 }}
                                      />
                                    }
                                    label={
                                      <Typography variant="caption">Members of {group.name ?? 'group'} only</Typography>
                                    }
                                  />
                                </MenuItem>
                              )}
                              {filteredProviders
                                ?.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                                ?.map((provider) => (
                                  <MenuItem key={provider.practitionerId} value={provider.practitionerId}>
                                    {provider.name}
                                  </MenuItem>
                                ))}
                            </TextField>
                          ) : (
                            <Skeleton sx={{ width: 120, minWidth: 120 }} animation="wave" />
                          )}
                        </Stack>
                      </Stack>
                    )}
                  </Grid>
                </Grid>
              </Grid>
              <Grid item>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CommandPaletteSearchButton />
                  <IconButton onClick={() => navigate('/visits')}>
                    <CloseIcon />
                  </IconButton>
                </Stack>
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
                      <PrintVisitLabelButton encounterId={effectiveEncounterId} />
                      <PatientMetadata sx={{ fontWeight: 500 }}>{dob}</PatientMetadata> |
                    </PatientInfoWrapper>
                    <PatientInfoWrapper>
                      <PatientMetadata>{pronouns}</PatientMetadata> | <PatientMetadata>{gender}</PatientMetadata> |
                      {weight ? (
                        <>
                          <PatientMetadata data-testid={dataTestIds.inPersonHeader.weight}>{weight}</PatientMetadata> |
                        </>
                      ) : null}
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
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {effectiveEncounterId ? <InternalNotes /> : null}
                  <IconButton
                    onClick={(e) => setHeaderMenuAnchorEl(e.currentTarget)}
                    sx={{ color: theme.palette.primary.main }}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Stack>
                <Menu
                  anchorEl={headerMenuAnchorEl}
                  open={!!headerMenuAnchorEl}
                  onClose={() => setHeaderMenuAnchorEl(null)}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                >
                  <MenuItem
                    onClick={() => {
                      setHeaderMenuAnchorEl(null);
                      if (patient?.id) {
                        const initialEncounterId = getInitialEncounterIdForFollowUp(encounter, followUpOriginEncounter);
                        navigate(`/patient/${patient.id}/followup/add`, {
                          state: { initialEncounterId },
                        });
                      }
                    }}
                    disabled={!patient?.id}
                    sx={{ color: theme.palette.primary.main, fontWeight: 500 }}
                  >
                    <ListItemIcon sx={{ color: theme.palette.primary.main }}>
                      <CalendarMonthOutlinedIcon fontSize="small" />
                    </ListItemIcon>
                    Create Follow-Up Visit
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setHeaderMenuAnchorEl(null);
                      setShowCreateTaskDialog(true);
                    }}
                    sx={{ color: theme.palette.primary.main, fontWeight: 500 }}
                  >
                    <ListItemIcon sx={{ color: theme.palette.primary.main }}>
                      <AddOutlinedIcon fontSize="small" />
                    </ListItemIcon>
                    Create Task
                  </MenuItem>
                </Menu>
                <CreateTaskDialog open={showCreateTaskDialog} handleClose={() => setShowCreateTaskDialog(false)} />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Stack>
    </HeaderWrapper>
  );
};
