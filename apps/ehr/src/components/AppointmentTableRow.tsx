import { progressNoteIcon } from '@ehrTheme/icons';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import ChatOutlineIcon from '@mui/icons-material/ChatOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MedicalInformationIcon from '@mui/icons-material/MedicalInformationOutlined';
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded';
import { LoadingButton } from '@mui/lab';
import {
  Badge,
  Box,
  capitalize,
  darken,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Operation } from 'fast-json-patch';
import { Appointment } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import {
  getInPersonUrlByAppointmentType,
  getInPersonVisitDetailsUrl,
} from 'src/features/visits/in-person/routing/helpers';
import { ROUTER_PATH } from 'src/features/visits/in-person/routing/routesInPerson';
import { VitalsIconTooltip } from 'src/features/visits/shared/components/VitalsIconTooltip';
import { otherColors } from 'src/themes/ottehr/colors';
import {
  formatMinutes,
  getAbnormalVitals,
  getAdmitterPractitionerId,
  getAttendingPractitionerId,
  getDurationOfStatus,
  getPatchBinary,
  getSupportPhoneFor,
  getVisitTotalTime,
  GetVitalsResponseData,
  InPersonAppointmentInformation,
  LOCATION_REVIEW_LINK_EXTENSION_URL,
  mdyStringFromISOString,
  NON_LOS_STATUSES,
  OrdersForTrackingBoardRow,
  PRACTITIONER_CODINGS,
  ProviderDetails,
  ROOM_EXTENSION_URL,
  VisitStatusHistoryEntry,
  VisitStatusWithoutUnknown,
} from 'utils';
import { dataTestIds } from '../constants/data-test-ids';
import ChatModal from '../features/chat/ChatModal';
import { InfoIconsToolTip } from '../features/visits/shared/components/InfoIconsToolTip';
import { useOystehrAPIClient } from '../features/visits/shared/hooks/useOystehrAPIClient';
import { usePractitionerActions } from '../features/visits/shared/hooks/usePractitioner';
import { useSignAppointmentMutation } from '../features/visits/shared/stores/tracking-board/tracking-board.queries';
import { checkInPatient, displayOrdersToolTip, hasAtLeastOneOrder, isEligibleSupervisor } from '../helpers';
import { completeIntakeWorkflow } from '../helpers/completeIntakeWorkflow';
import { formatPatientName } from '../helpers/formatPatientName';
import { getOfficePhoneNumber } from '../helpers/getOfficePhoneNumber';
import { handleChangeInPersonVisitStatus } from '../helpers/inPersonVisitStatusUtils';
import { getTrackingBoardPrimaryAction } from '../helpers/trackingBoardPrimaryAction';
import { useApiClients } from '../hooks/useAppClients';
import useEvolveUser from '../hooks/useEvolveUser';
import { useSupportPhonesMap } from '../hooks/useLocationSupportPhones';
import { useServiceCategoryAbbreviationResolver } from '../hooks/useServiceCategoryAbbreviation';
import AppointmentNote from './AppointmentNote';
import AppointmentTablePractitionerSelect from './AppointmentTablePractitionerSelect';
import AppointmentTableRowMobile from './AppointmentTableRowMobile';
import { ApptTab } from './AppointmentTabs';
import GoToButton from './GoToButton';
import { IN_PERSON_CHIP_STATUS_MAP, InPersonAppointmentStatusChip } from './InPersonAppointmentStatusChip';
import { PatientDateOfBirth } from './PatientDateOfBirth';
import { PriorityIconWithBorder } from './PriorityIconWithBorder';
import ReasonsForVisit from './ReasonForVisit';

const VITE_APP_PATIENT_APP_URL = import.meta.env.VITE_APP_PATIENT_APP_URL;

interface AppointmentTableRowProps {
  appointment: InPersonAppointmentInformation;
  now: DateTime;
  tab: ApptTab;
  updateAppointments: () => void;
  setEditingComment: (editingComment: boolean) => void;
  orders: OrdersForTrackingBoardRow;
  vitals?: GetVitalsResponseData;
  table?: 'waiting-room' | 'in-exam';
  /** Intake-staff options for the editable "Intake & Provider" column (in-office tab). */
  intakeOptions?: ProviderDetails[];
  /** Provider options for the editable "Intake & Provider" column (in-office tab). */
  providerOptions?: ProviderDetails[];
  /** Whether the intake/provider option lists are still loading. */
  employeesLoading?: boolean;
}

const linkStyle = {
  display: 'contents',
  color: otherColors.tableRow,
};

const TimeBox = ({
  time,
  isHighlighted,
  theme,
}: {
  time: string;
  isHighlighted: boolean;
  theme: any;
}): ReactElement => {
  return (
    <Box
      component="span"
      sx={{
        fontWeight: isHighlighted ? '700' : 'normal',
        ...(isHighlighted && {
          color: theme.palette.primary.contrastText,
          backgroundColor: darken(theme.palette.warning.main, 0.08),
          padding: '2px 4px',
          borderRadius: '4px',
        }),
      }}
    >
      {time}
    </Box>
  );
};

const inRoomStatuses = ['intake', 'ready for provider', 'provider'];

const getInRoomExamTime = (visitStatusHistory: VisitStatusHistoryEntry[], now: DateTime): number => {
  let totalInRoomTime = 0;

  for (let i = visitStatusHistory.length - 1; i >= 0; i--) {
    const status = visitStatusHistory[i];

    if (NON_LOS_STATUSES.includes(status.status)) {
      continue;
    }

    if (inRoomStatuses.includes(status.status)) {
      totalInRoomTime += getDurationOfStatus(status, now);
    }

    if (status.status === 'intake') {
      break;
    }
  }

  return totalInRoomTime;
};

const getIsLongWaitTime = (
  appointment: InPersonAppointmentInformation,
  recentStatus: VisitStatusHistoryEntry | undefined,
  now: DateTime
): boolean => {
  if (!recentStatus) return false;

  const currentStatusDuration = getDurationOfStatus(recentStatus, now);

  if (appointment.status === 'arrived' && currentStatusDuration > 10) {
    return true;
  }

  if (appointment.status === 'ready' && appointment.appointmentType !== 'walk-in' && currentStatusDuration > 15) {
    return true;
  }

  if (inRoomStatuses.includes(recentStatus?.status) && getInRoomExamTime(appointment.visitStatusHistory, now) > 40) {
    return true;
  }

  return false;
};

export default function AppointmentTableRow({
  appointment,
  now,
  tab,
  updateAppointments,
  setEditingComment,
  orders,
  vitals,
  table,
  intakeOptions,
  providerOptions,
  employeesLoading,
}: AppointmentTableRowProps): ReactElement | null {
  const { oystehr, oystehrZambda } = useApiClients();
  const apiClient = useOystehrAPIClient();
  const { phonesByLocationName } = useSupportPhonesMap();
  const resolveServiceCategoryAbbr = useServiceCategoryAbbreviationResolver();
  const theme = useTheme();
  const navigate = useNavigate();
  const { encounter } = appointment;
  const [statusTime, setStatusTime] = useState<string>('');
  const [arrivedStatusSaving, setArrivedStatusSaving] = useState<boolean>(false);
  const [room, setRoom] = useState<string>(appointment.room || '');
  const [roomSaving, setRoomSaving] = useState<boolean>(false);
  const [chatModalOpen, setChatModalOpen] = useState<boolean>(false);
  const [hasUnread, setHasUnread] = useState<boolean>(appointment.smsModel?.hasUnreadMessages || false);
  const user = useEvolveUser();

  const [primaryActionButtonLoading, setPrimaryActionButtonLoading] = useState(false);
  const [progressNoteButtonLoading, setProgressNoteButtonLoading] = useState(false);
  const [approveButtonLoading, setApproveButtonLoading] = useState(false);
  const [reviewAndSignButtonLoading, setReviewAndSignButtonLoading] = useState(false);

  const { mutateAsync: signAppointment, isPending: isSignLoading } = useSignAppointmentMutation();
  const { handleUpdatePractitioner } = usePractitionerActions(encounter, 'end', PRACTITIONER_CODINGS.Admitter);

  const rooms = useMemo(() => {
    return appointment.location?.extension
      ?.filter((ext) => ext.url === ROOM_EXTENSION_URL)
      .map((ext) => ext.valueString);
  }, [appointment]);

  const officePhoneNumber = getOfficePhoneNumber(appointment.location);

  const patientName =
    (appointment.patient.lastName &&
      appointment.patient.firstName &&
      formatPatientName({
        firstName: appointment.patient.firstName,
        lastName: appointment.patient.lastName,
        middleName: appointment.patient.middleName,
      })) ||
    'Unknown';

  const appointmentStart = appointment.start ? DateTime.fromISO(appointment.start) : undefined;
  const start = appointmentStart?.isValid ? appointmentStart.toFormat('h:mm a') : undefined;
  const appointmentDate = appointmentStart?.isValid ? appointmentStart.toFormat('MM/dd/yyyy') : undefined;

  const showChatIcon = appointment.smsModel !== undefined;
  // console.log('sms model', appointment.smsModel);

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    setHasUnread(appointment.smsModel?.hasUnreadMessages || false);
  }, [appointment.smsModel?.hasUnreadMessages]);

  const handleArrivedClick = async (_event: React.MouseEvent<HTMLElement>): Promise<void> => {
    if (!oystehr) {
      throw new Error('error getting fhir client');
    }
    if (!appointment.id) {
      throw new Error('error getting appointment id');
    }
    setArrivedStatusSaving(true);
    await checkInPatient(oystehr, appointment.id, appointment.encounterId, user);
    setArrivedStatusSaving(false);
    await updateAppointments();
  };

  const changeRoom = async (room?: string): Promise<void> => {
    if (!oystehr) {
      throw new Error('error getting fhir client');
    }
    if (!appointment.id) {
      throw new Error('error getting appointment id');
    }
    setRoomSaving(true);

    const appointmentToUpdate = await oystehr.fhir.get<Appointment>({
      resourceType: 'Appointment',
      id: appointment.id,
    });

    let patchOp: Operation;

    if (!room) {
      const extension = (appointmentToUpdate.extension || []).filter((ext) => ext.url !== ROOM_EXTENSION_URL);

      if (extension?.length === 0) {
        patchOp = {
          op: 'remove',
          path: '/extension',
        };
      } else {
        patchOp = {
          op: 'replace',
          path: '/extension',
          value: extension,
        };
      }
    } else {
      if (appointmentToUpdate.extension?.find((ext) => ext.url === ROOM_EXTENSION_URL)) {
        patchOp = {
          op: 'replace',
          path: '/extension',
          value: appointmentToUpdate.extension.map((ext) => {
            if (ext.url === ROOM_EXTENSION_URL) {
              return { url: ROOM_EXTENSION_URL, valueString: room };
            }
            return ext;
          }),
        };
      } else {
        if ((appointmentToUpdate.extension || []).length === 0) {
          patchOp = {
            op: 'add',
            path: '/extension',
            value: [{ url: ROOM_EXTENSION_URL, valueString: room }],
          };
        } else {
          patchOp = {
            op: 'replace',
            path: '/extension',
            value: [...(appointmentToUpdate.extension || []), { url: ROOM_EXTENSION_URL, valueString: room }],
          };
        }
      }
    }

    await oystehr.fhir.batch({
      requests: [
        getPatchBinary({ resourceId: appointment.id, resourceType: 'Appointment', patchOperations: [patchOp] }),
      ],
    });

    setRoomSaving(false);
  };

  const recentStatus = appointment?.visitStatusHistory[appointment.visitStatusHistory.length - 1];
  const showStatusTimer = appointment.status !== 'pending';

  const { totalMinutes, waitingMinutesEstimate } = useMemo(() => {
    const totalMinutes = getVisitTotalTime(appointment, appointment.visitStatusHistory, now);
    const waitingMinutesEstimate = appointment?.waitingMinutes;
    return { totalMinutes, waitingMinutesEstimate };
  }, [appointment, now]);

  if (recentStatus && recentStatus.period) {
    const currentStatusTime = getDurationOfStatus(recentStatus, now);

    let statusTimeTemp =
      tab === ApptTab.cancelled || tab === ApptTab.completed || recentStatus.status === 'discharged'
        ? `${formatMinutes(totalMinutes)}m`
        : `${formatMinutes(currentStatusTime)}m`;

    if (
      tab !== ApptTab.cancelled &&
      tab !== ApptTab.completed &&
      statusTimeTemp !== `${formatMinutes(totalMinutes)}m` &&
      recentStatus.status !== 'discharged' &&
      appointment.visitStatusHistory &&
      appointment?.visitStatusHistory.length > 1
    ) {
      statusTimeTemp += ` / ${formatMinutes(totalMinutes)}m`;
    }

    if (statusTimeTemp !== statusTime) {
      setStatusTime(statusTimeTemp);
    }
  }

  const patientDateOfBirth = appointment.patient?.dateOfBirth;

  const isLongWaitingTime = getIsLongWaitTime(appointment, recentStatus, now);

  const formattedPriorityHighIcon = (
    <PriorityHighRoundedIcon
      style={{
        height: '14px',
        width: '14px',
        padding: '2px',
        color: theme.palette.primary.contrastText,
        backgroundColor: otherColors.priorityHighIcon,
        borderRadius: '4px',
        marginRight: '4px',
      }}
    />
  );

  const longWaitFlag = (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        alignItems: 'center',
      }}
    >
      <PriorityIconWithBorder fill={theme.palette.warning.main} />
      <Typography
        variant="body2"
        color={theme.palette.getContrastText(theme.palette.background.default)}
        style={{ display: 'inline', fontWeight: 500 }}
      >
        Long wait: Please check on patient
      </Typography>
    </Box>
  );

  const tooltipScrollRef = React.useRef<HTMLDivElement>(null);

  const scrollTooltipToBottom = useCallback(() => {
    // Use setTimeout to ensure the tooltip is fully rendered before scrolling
    setTimeout(() => {
      if (tooltipScrollRef.current) {
        tooltipScrollRef.current.scrollTop = tooltipScrollRef.current.scrollHeight;
      }
    }, 0);
  }, []);

  const timeToolTip = (
    <Box
      ref={tooltipScrollRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        maxHeight: 'calc(100vh - 200px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        width: '100%',
      }}
    >
      {isLongWaitingTime && longWaitFlag}
      {/* LOS-participating statuses */}
      {appointment?.visitStatusHistory
        ?.filter((status) => !NON_LOS_STATUSES.includes(status.status))
        .map((statusTemp, index) => {
          const statusDuration = getDurationOfStatus(statusTemp, now);

          return (
            <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography
                variant="body2"
                color={theme.palette.getContrastText(theme.palette.background.default)}
                style={{ display: 'inline', marginTop: 1 }}
              >
                {`${formatMinutes(statusDuration)} mins`}
              </Typography>
              <InPersonAppointmentStatusChip status={statusTemp.status} />
            </Box>
          );
        })}

      <Typography
        variant="body2"
        color={theme.palette.getContrastText(theme.palette.background.default)}
        style={{ display: 'inline', fontWeight: 500 }}
      >
        Total LOS: {formatMinutes(totalMinutes)} mins
      </Typography>
      <Typography
        variant="body2"
        color={theme.palette.getContrastText(theme.palette.background.default)}
        style={{ display: 'inline', fontWeight: 500 }}
      >
        {waitingMinutesEstimate
          ? `Estimated wait time at check-in: ${formatMinutes(Math.floor(waitingMinutesEstimate / 5) * 5)} mins`
          : ''}
      </Typography>

      {/* Non-LOS statuses */}
      {appointment?.visitStatusHistory?.some((status) => NON_LOS_STATUSES.includes(status.status)) && (
        <>
          <Typography
            variant="body2"
            color={theme.palette.getContrastText(theme.palette.background.default)}
            style={{ display: 'inline', fontWeight: 500 }}
          >
            Other history:
          </Typography>
          {appointment?.visitStatusHistory
            ?.filter((status) => NON_LOS_STATUSES.includes(status.status))
            .map((statusTemp, index) => {
              const statusDuration = getDurationOfStatus(statusTemp, now);

              return (
                <Box
                  key={index}
                  sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Typography
                    variant="body2"
                    color={theme.palette.getContrastText(theme.palette.background.default)}
                    style={{ display: 'inline', marginTop: 1 }}
                  >
                    {`${formatMinutes(statusDuration)} mins`}
                  </Typography>
                  <InPersonAppointmentStatusChip status={statusTemp.status} />
                </Box>
              );
            })}
        </>
      )}
    </Box>
  );

  const statusTimeEl = showStatusTimer ? (
    <>
      <Grid item sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ display: 'inline' }}>
          {statusTime.includes('/') ? (
            <>
              <TimeBox time={statusTime.split('/')[0].trim()} isHighlighted={isLongWaitingTime} theme={theme} />
              <Box component="span" sx={{ ml: 0.5 }}>
                / {statusTime.split('/')[1].trim()}
              </Box>
            </>
          ) : (
            <TimeBox time={statusTime} isHighlighted={isLongWaitingTime} theme={theme} />
          )}
        </Typography>
        {appointment.visitStatusHistory && appointment.visitStatusHistory.length > 1 && (
          <span style={{ color: 'rgba(0, 0, 0, 0.6)', display: 'flex', alignItems: 'center' }}>
            <InfoOutlinedIcon
              style={{
                height: '20px',
                width: '20px',
                padding: '2px',
                borderRadius: '4px',
                marginLeft: '2px',
                marginTop: '1px',
              }}
            />
          </span>
        )}
      </Grid>
    </>
  ) : undefined;

  const quickTextsContext = {
    patientAppUrl: VITE_APP_PATIENT_APP_URL,
    patientFirstName: appointment.patient.firstName,
    patientLastName: appointment.patient.lastName,
    visitId: appointment.id,
    locationName: appointment.location?.name,
    locationReviewLink: appointment.location?.extension?.find((ext) => ext.url === LOCATION_REVIEW_LINK_EXTENSION_URL)
      ?.valueUrl,
    bookingTime: start,
    officePhone: officePhoneNumber,
    supportPhone: getSupportPhoneFor(appointment.location?.name, phonesByLocationName) || '',
  };

  const onCloseChat = useCallback(() => {
    setChatModalOpen(false);
  }, [setChatModalOpen]);

  const onMarkAllRead = useCallback(() => {
    setHasUnread(false);
  }, [setHasUnread]);

  if (isMobile) {
    return (
      <AppointmentTableRowMobile
        appointment={appointment}
        patientName={patientName}
        appointmentDate={appointmentDate}
        start={start}
        tab={tab}
        formattedPriorityHighIcon={formattedPriorityHighIcon}
        statusTime={statusTime}
        statusChip={<InPersonAppointmentStatusChip status={appointment.status} />}
        isLongWaitingTime={isLongWaitingTime}
        patientDateOfBirth={patientDateOfBirth}
        statusTimeEl={statusTimeEl}
        linkStyle={linkStyle}
        timeToolTip={timeToolTip}
      />
    );
  }

  if (!encounter?.id) {
    enqueueSnackbar('Encounter is missing.', { variant: 'error' });
    return null;
  }
  const encounterId: string = encounter.id;
  const primaryAction = getTrackingBoardPrimaryAction(appointment.status, { isVirtualVisit: isVirtual(appointment) });
  const assignedIntakePerformerId = getAdmitterPractitionerId(encounter);
  const assignedProviderId = getAttendingPractitionerId(encounter);
  // Read-only display (Discharged/Cancelled tabs) uses the names resolved on the appointment's
  // participants so we don't need to fetch the employee list on those tabs.
  const assignedIntakeName = appointment.participants?.admitter
    ? `${appointment.participants.admitter.firstName} ${appointment.participants.admitter.lastName}`.trim()
    : '';
  const assignedProviderName = appointment.participants?.attender
    ? `${appointment.participants.attender.firstName} ${appointment.participants.attender.lastName}`.trim()
    : '';

  const handleStatusAction = async (
    updatedStatus: VisitStatusWithoutUnknown,
    options?: {
      navigateTo?: string;
      successMessage?: string;
      missingUserMessage?: string;
    }
  ): Promise<void> => {
    setPrimaryActionButtonLoading(true);

    if (!user) {
      enqueueSnackbar(options?.missingUserMessage || 'User is not available. Cannot update visit status.', {
        variant: 'error',
      });
      setPrimaryActionButtonLoading(false);
      return;
    }

    let shouldResetLoadingState = true;

    try {
      await handleChangeInPersonVisitStatus(
        {
          encounterId,
          updatedStatus,
        },
        oystehrZambda
      );

      if (options?.successMessage) {
        enqueueSnackbar(options.successMessage, { variant: 'success' });
      }

      if (options?.navigateTo) {
        shouldResetLoadingState = false;
        navigate(options.navigateTo);
        return;
      }

      await updateAppointments();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    } finally {
      if (shouldResetLoadingState) {
        setPrimaryActionButtonLoading(false);
      }
    }
  };

  const renderActionButton = (
    text: string,
    onClick: () => Promise<void>,
    dataTestId: string,
    loading = primaryActionButtonLoading
  ): ReactElement => {
    return (
      <LoadingButton
        data-testid={dataTestId}
        onClick={() => void onClick()}
        loading={loading}
        variant="contained"
        sx={{
          borderRadius: 8,
          textTransform: 'none',
          fontSize: '15px',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          px: 2.5,
        }}
      >
        {text}
      </LoadingButton>
    );
  };

  const handlePrimaryActionButton = async (): Promise<void> => {
    if (!primaryAction) {
      return;
    }

    if (appointment.status === 'intake') {
      setPrimaryActionButtonLoading(true);

      try {
        const completedIntake = await completeIntakeWorkflow({
          assignedIntakePerformerId,
          encounterId,
          endIntakePractitioner: handleUpdatePractitioner,
          refetch: updateAppointments,
          zambdaClient: oystehrZambda,
        });

        if (completedIntake) {
          enqueueSnackbar('Intake completed', { variant: 'success' });
        }
      } finally {
        setPrimaryActionButtonLoading(false);
      }

      return;
    }

    if (appointment.status === 'ready for provider' && !assignedProviderId) {
      enqueueSnackbar('Please assign provider', { variant: 'error' });
      return;
    }

    if (primaryAction.skipStatusUpdate && primaryAction.navigateToChart) {
      navigate(getInPersonUrlByAppointmentType(appointment, 'patient-info'));
      return;
    }

    await handleStatusAction(primaryAction.updatedStatus, {
      missingUserMessage: primaryAction.missingUserMessage,
      navigateTo: primaryAction.navigateToChart
        ? getInPersonUrlByAppointmentType(appointment, 'patient-info')
        : undefined,
      successMessage: primaryAction.successMessage,
    });
  };

  const renderPrimaryActionButton = (): ReactElement | undefined => {
    if (!primaryAction) {
      return undefined;
    }

    return renderActionButton(primaryAction.label, handlePrimaryActionButton, primaryAction.dataTestId);
  };

  const navigateToReviewAndSign = async (setLoading: (loading: boolean) => void): Promise<void> => {
    setLoading(true);
    try {
      navigate(getInPersonUrlByAppointmentType(appointment, ROUTER_PATH.REVIEW_AND_SIGN));
    } catch (error) {
      console.error(error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleProgressNoteButton = async (): Promise<void> => {
    await navigateToReviewAndSign(setProgressNoteButtonLoading);
  };

  const renderProgressNoteButton = (): ReactElement | undefined => {
    if (
      appointment.status === 'intake' ||
      appointment.status === 'ready for provider' ||
      appointment.status === 'provider' ||
      appointment.status === 'awaiting supervisor approval' ||
      appointment.status === 'completed' ||
      appointment.status === 'discharged'
    ) {
      return (
        <GoToButton
          text="Progress Note"
          loading={progressNoteButtonLoading}
          onClick={handleProgressNoteButton}
          dataTestId={dataTestIds.dashboard.progressNoteButton}
        >
          <img src={progressNoteIcon} />
        </GoToButton>
      );
    }
    return undefined;
  };

  const handleReviewAndSignButton = async (): Promise<void> => {
    await navigateToReviewAndSign(setReviewAndSignButtonLoading);
  };

  const renderReviewAndSignButton = (): ReactElement | undefined => {
    if (appointment.status !== 'discharged') {
      return undefined;
    }

    return renderActionButton(
      'Review & Sign',
      handleReviewAndSignButton,
      dataTestIds.dashboard.reviewAndSignButton,
      reviewAndSignButtonLoading
    );
  };

  const handleApprove = async (): Promise<void> => {
    setApproveButtonLoading(true);
    if (!apiClient || !appointment?.id) {
      enqueueSnackbar('API client not defined or appointmentId not provided', { variant: 'error' });
      setApproveButtonLoading(false);
      return;
    }

    try {
      const tz = DateTime.now().zoneName;
      await signAppointment({
        apiClient,
        appointmentId: appointment.id,
        timezone: tz,
        supervisorApprovalEnabled: FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED,
        encounterId: encounterId,
      });
      await updateAppointments();
      navigate(`/visits?tab=${ApptTab.completed}`);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('An error occurred while approving. Please try again.', { variant: 'error' });
    }
    setApproveButtonLoading(false);
  };

  const renderSupervisorApproval = (): ReactElement | undefined => {
    if (
      appointment.status === 'awaiting supervisor approval' &&
      user?.profileResource &&
      isEligibleSupervisor(user.profileResource!, appointment.attenderProviderType)
    ) {
      return (
        <GoToButton
          text="Approve"
          loading={approveButtonLoading || isSignLoading}
          onClick={handleApprove}
          dataTestId={dataTestIds.dashboard.approveButton}
        >
          <CheckCircleOutlineIcon />
        </GoToButton>
      );
    } else if (appointment.status === 'completed' && appointment.approvalDate) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            color: theme.palette.text.secondary,
          }}
        >
          <Typography align="center">Approved</Typography>
          <Typography align="center">{mdyStringFromISOString(appointment.approvalDate)}</Typography>
        </Box>
      );
    }
    return undefined;
  };

  const renderArrivedButton = (): ReactElement | undefined => {
    if (tab === 'prebooked' && !isVirtual(appointment)) {
      return (
        <LoadingButton
          data-testid={dataTestIds.dashboard.arrivedButton}
          onClick={handleArrivedClick}
          loading={arrivedStatusSaving}
          variant="contained"
          sx={{
            borderRadius: 8,
            textTransform: 'none',
            fontSize: '15px',
            fontWeight: 500,
          }}
        >
          Arrived
        </LoadingButton>
      );
    }
    return undefined;
  };

  // there are two different tooltips that are show on the tracking board depending which tab/section you are on
  // 1. visit components on prebooked, in-office/waiting and cancelled
  // 2. orders on in-office/in-exam and discharged
  // this bool determines what style mouse should show on hover for the cells that hold these tooltips
  // if orders tooltip is displayed, we check if there are any orders - if no orders the cell will be empty and it doesn't make sense to have the pointer hand
  // if visit components, there is always something in this cell, hence the default to true
  const showPointerForInfoIcons = displayOrdersToolTip(appointment, tab) ? hasAtLeastOneOrder(orders) : true;

  const serviceCategoryAbbr = resolveServiceCategoryAbbr(appointment.serviceCategory);
  const serviceCategory = serviceCategoryAbbr ? ' | ' + serviceCategoryAbbr : '';

  return (
    <TableRow
      id="appointments-table-row"
      data-testid={dataTestIds.dashboard.tableRowWrapper(appointment.id)}
      sx={{
        '&:last-child td, &:last-child th': { border: 0 },
        '& .MuiTableCell-root': {
          px: 1.5,
          py: 1,
        },
        position: 'relative',
        ...(appointment.next && {
          // borderTop: '2px solid #43A047',
          boxShadow: `inset 0 0 0 1px ${IN_PERSON_CHIP_STATUS_MAP[appointment.status].background.secondary}`,
        }),
      }}
    >
      <TableCell sx={{ verticalAlign: 'center', position: 'relative', p: 0, width: '40px' }}>
        {appointment.next && (
          <Box
            sx={{
              backgroundColor: IN_PERSON_CHIP_STATUS_MAP[appointment.status].background.secondary,
              position: 'absolute',
              width: '28px',
              bottom: 0,
              left: '0',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              variant="body1"
              fontSize={12}
              sx={{
                writingMode: 'vertical-lr',
                transform: 'scale(-1)',
                color: theme.palette.background.paper,
                fontWeight: 700,
              }}
            >
              NEXT
            </Typography>
          </Box>
        )}
      </TableCell>
      <TableCell sx={{ verticalAlign: 'center' }} data-testid={dataTestIds.dashboard.tableRowStatus(appointment.id)}>
        <Typography variant="body2">
          {isVirtual(appointment) ? 'Virtual' : 'In Person'}
          {serviceCategory}
        </Typography>
        <Typography variant="body2">{appointment.location?.name ?? ''}</Typography>
        <Box mt={0.5}>
          <InPersonAppointmentStatusChip status={appointment.status} />
        </Box>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'center' }}>
        <Typography variant="body2">
          {capitalize?.(
            appointment.appointmentType === 'pre-booked'
              ? 'Scheduled'
              : appointment.appointmentType === 'walk-in'
                ? 'On Demand'
                : appointment.appointmentType === 'post-telemed'
                  ? 'Post Telemed'
                  : ''
          )}
        </Typography>
        {appointmentDate && <Typography variant="body2">{appointmentDate}</Typography>}
        {start && (
          <Typography variant="body2">
            <strong>{start}</strong>
          </Typography>
        )}
        {showStatusTimer && (
          <Tooltip
            componentsProps={{
              tooltip: {
                sx: {
                  width: 'auto',
                  maxWidth: 'none',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  padding: 2,
                  backgroundColor: theme.palette.background.default,
                  boxShadow:
                    '0px 1px 8px 0px rgba(0, 0, 0, 0.12), 0px 3px 4px 0px rgba(0, 0, 0, 0.14), 0px 3px 3px -2px rgba(0, 0, 0, 0.20)',
                  '& .MuiTooltip-arrow': { color: theme.palette.background.default },
                },
              },
            }}
            title={timeToolTip}
            placement="top"
            arrow
            onOpen={scrollTooltipToBottom}
          >
            <Grid sx={{ display: 'flex', alignItems: 'center', marginTop: '4px' }} gap={1}>
              {statusTimeEl}
            </Grid>
          </Tooltip>
        )}
      </TableCell>
      <TableCell sx={{ verticalAlign: 'center', wordWrap: 'break-word' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Link
              to={`/patient/${appointment.patient.id}`}
              style={{ textDecoration: 'none' }}
              data-testid={dataTestIds.dashboard.patientName}
            >
              <Typography variant="subtitle2" sx={{ fontSize: '16px', color: '#000' }}>
                {patientName}
              </Typography>
            </Link>
            {appointment.isFollowUp && (
              <Tooltip title="Follow-up visit">
                <CallSplitIcon sx={{ fontSize: 16, color: 'text.secondary', transform: 'rotate(180deg)' }} />
              </Tooltip>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'nowrap' }}>
            <Typography sx={{ color: theme.palette.text.secondary, whiteSpace: 'nowrap' }}>{`${
              appointment.patient?.sex && capitalize(appointment.patient?.sex)
            } |`}</Typography>
            <PatientDateOfBirth dateOfBirth={patientDateOfBirth} />
          </Box>
          <ReasonsForVisit
            reasonsForVisit={appointment.reasonForVisit}
            tab={tab}
            formattedPriorityHighIcon={formattedPriorityHighIcon}
            lineMax={2}
          ></ReasonsForVisit>
        </Box>
      </TableCell>
      {(tab === ApptTab['in-office'] || tab === ApptTab.completed) && (
        <TableCell
          sx={{
            verticalAlign: 'center',
          }}
        >
          {tab === ApptTab['in-office'] ? (
            rooms &&
            rooms.length > 0 && (
              <TextField
                select
                fullWidth
                variant="standard"
                disabled={roomSaving}
                value={room}
                onChange={(e) => {
                  setRoom(e.target.value);
                  void changeRoom(e.target.value);
                }}
              >
                <MenuItem value={''}>None</MenuItem>
                {rooms?.map((room) => (
                  <MenuItem key={room} value={room}>
                    {room}
                  </MenuItem>
                ))}
              </TextField>
            )
          ) : (
            <Typography sx={{ fontSize: 14, display: 'inline' }}>{room}</Typography>
          )}
        </TableCell>
      )}
      <TableCell sx={{ verticalAlign: 'center' }}>
        {tab === ApptTab.prebooked ? (
          <Typography sx={{ fontSize: 14, display: 'inline' }}>{appointment.provider}</Typography>
        ) : tab === ApptTab['in-office'] ? (
          <Stack spacing={0.5} sx={{ minWidth: 150 }}>
            <AppointmentTablePractitionerSelect
              label="In:"
              options={intakeOptions ?? []}
              selectedPractitionerId={assignedIntakePerformerId}
              encounter={encounter}
              practitionerType={PRACTITIONER_CODINGS.Admitter}
              isLoadingOptions={!!employeesLoading}
              onAssigned={updateAppointments}
              dataTestId={dataTestIds.dashboard.tableRowIntakeInput(appointment.id)}
            />
            <AppointmentTablePractitionerSelect
              label="Pr:"
              options={providerOptions ?? []}
              selectedPractitionerId={assignedProviderId}
              encounter={encounter}
              practitionerType={PRACTITIONER_CODINGS.Attender}
              isLoadingOptions={!!employeesLoading}
              onAssigned={updateAppointments}
              dataTestId={dataTestIds.dashboard.tableRowProviderInput(appointment.id)}
            />
          </Stack>
        ) : (
          <Stack spacing={0.5} sx={{ minWidth: 150 }}>
            <Typography sx={{ fontSize: 14 }}>In: {assignedIntakeName || '—'}</Typography>
            <Typography sx={{ fontSize: 14 }}>Pr: {assignedProviderName || '—'}</Typography>
          </Stack>
        )}
      </TableCell>
      {((tab === ApptTab['in-office'] && table === 'in-exam') || tab === ApptTab.completed) && (
        <TableCell sx={{ verticalAlign: 'center' }}>
          <Typography component="div" sx={{ fontSize: 14, display: 'inline' }}>
            <VitalsIconTooltip appointment={appointment} abnormalVitals={getAbnormalVitals(vitals)} />
          </Typography>
        </TableCell>
      )}
      <TableCell
        sx={{
          verticalAlign: 'center',
          cursor: `${showPointerForInfoIcons ? 'pointer' : 'auto'}`,
        }}
      >
        <InfoIconsToolTip appointment={appointment} tab={tab} orders={orders} />
      </TableCell>
      <TableCell sx={{ verticalAlign: 'center' }}>
        <AppointmentNote
          appointment={appointment}
          oystehr={oystehr}
          user={user}
          updateAppointments={updateAppointments}
          setEditingComment={setEditingComment}
        ></AppointmentNote>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'center' }}>
        {showChatIcon && (
          <IconButton
            sx={{
              backgroundColor: theme.palette.primary.main,
              width: '36px',
              height: '36px',
              borderRadius: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              '&:hover': {
                backgroundColor: theme.palette.primary.main,
              },
            }}
            onClick={(_event) => {
              setChatModalOpen(true);
            }}
            aria-label={hasUnread ? 'unread messages chat icon' : 'chat icon, no unread messages'}
          >
            {/* todo reduce code duplication */}
            {hasUnread ? (
              <Badge
                variant="dot"
                color="warning"
                sx={{
                  '& .MuiBadge-badge': {
                    width: '14px',
                    height: '14px',
                    borderRadius: '10px',
                    border: '2px solid white',
                    top: '-4px',
                    right: '-4px',
                  },
                }}
              >
                <ChatOutlineIcon
                  sx={{
                    color: theme.palette.primary.contrastText,
                    height: '20px',
                    width: '20px',
                  }}
                />
              </Badge>
            ) : (
              <ChatOutlineIcon
                sx={{
                  color: theme.palette.primary.contrastText,
                  height: '20px',
                  width: '20px',
                }}
              />
            )}
          </IconButton>
        )}
      </TableCell>
      <TableCell sx={{ verticalAlign: 'center' }}>
        <Stack direction={'row'} spacing={1} alignItems="center" justifyContent="center" sx={{ width: '100%' }}>
          <GoToButton
            text="Visit Details"
            onClick={() => navigate(getInPersonVisitDetailsUrl(appointment.id))}
            dataTestId={dataTestIds.dashboard.visitDetailsButton}
          >
            <MedicalInformationIcon />
          </GoToButton>
          {renderProgressNoteButton()}
        </Stack>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'center' }}>
        <Stack direction={'row'} spacing={1} alignItems="center" justifyContent="center" sx={{ width: '100%' }}>
          {renderArrivedButton()}
          {renderReviewAndSignButton()}
          {renderPrimaryActionButton()}
          {FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED && renderSupervisorApproval()}
        </Stack>
      </TableCell>
      {chatModalOpen && (
        <ChatModal
          appointment={appointment}
          currentLocation={appointment.location}
          onClose={onCloseChat}
          onMarkAllRead={onMarkAllRead}
          quickTextsContext={quickTextsContext}
        />
      )}
    </TableRow>
  );
}

function isVirtual(appointment: InPersonAppointmentInformation): boolean {
  return appointment.appointmentAttendanceType === 'virtual';
}
