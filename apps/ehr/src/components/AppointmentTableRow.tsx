import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import ChatOutlineIcon from '@mui/icons-material/ChatOutlined';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded';
import { LoadingButton } from '@mui/lab';
import {
  Badge,
  Box,
  Grid,
  IconButton,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
  capitalize,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Location } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  InPersonAppointmentInformation,
  VisitStatusLabel,
  formatMinutes,
  getDurationOfStatus,
  getVisitTotalTime,
} from 'utils';
import { LANGUAGES } from '../constants';
import { dataTestIds } from '../constants/data-test-ids';
import { otherColors } from '../CustomThemeProvider';
import ChatModal from '../features/chat/ChatModal';
import { CSSButton } from '../features/css-module/components/CSSButton';
import { usePractitionerActions } from '../features/css-module/hooks/usePractitioner';
import { checkinPatient } from '../helpers';
import { getTimezone } from '../helpers/formatDateTime';
import { formatPatientName } from '../helpers/formatPatientName';
import { getOfficePhoneNumber } from '../helpers/getOfficePhoneNumber';
import { handleChangeInPersonVisitStatus } from '../helpers/inPersonVisitStatusUtils';
import { practitionerType } from '../helpers/practitionerUtils';
import { useApiClients } from '../hooks/useAppClients';
import useEvolveUser from '../hooks/useEvolveUser';
import AppointmentNote from './AppointmentNote';
import AppointmentTableRowMobile from './AppointmentTableRowMobile';
import { ApptTab } from './AppointmentTabs';
import { GenericToolTip, PaperworkToolTipContent } from './GenericToolTip';
import { IntakeCheckmark } from './IntakeCheckmark';
import { PatientDateOfBirth } from './PatientDateOfBirth';
import { PriorityIconWithBorder } from './PriorityIconWithBorder';
import ReasonsForVisit from './ReasonForVisit';

interface AppointmentTableProps {
  appointment: InPersonAppointmentInformation;
  location?: Location;
  actionButtons: boolean;
  showTime: boolean;
  now: DateTime;
  tab: ApptTab;
  updateAppointments: () => void;
  setEditingComment: (editingComment: boolean) => void;
}

const VITE_APP_QRS_URL = import.meta.env.VITE_APP_QRS_URL;

export function getAppointmentStatusChip(status: VisitStatusLabel | undefined, count?: number): ReactElement {
  if (!status) {
    return <span>todo1</span>;
  }
  if (!CHIP_STATUS_MAP[status]) {
    return <span>todo2</span>;
  }

  return (
    <span
      style={{
        fontSize: '12px',
        borderRadius: '4px',
        border: `${['pending', 'checked out'].includes(status) ? '1px solid #BFC2C6' : 'none'}`,
        textTransform: 'uppercase',
        background: CHIP_STATUS_MAP[status].background.primary,
        color: CHIP_STATUS_MAP[status].color.primary,
        display: 'inline-block',
        padding: '2px 8px 0 8px',
        verticalAlign: 'middle',
      }}
    >
      {count ? `${status} - ${count}` : status}
    </span>
  );
}

export const CHIP_STATUS_MAP: {
  [status in VisitStatusLabel]: {
    background: {
      primary: string;
      secondary?: string;
    };
    color: {
      primary: string;
      secondary?: string;
    };
  };
} = {
  pending: {
    background: {
      primary: '#FFFFFF',
    },
    color: {
      primary: '#546E7A',
    },
  },
  arrived: {
    background: {
      primary: '#ECEFF1',
      secondary: '#9E9E9E',
    },
    color: {
      primary: '#37474F',
    },
  },
  ready: {
    background: {
      primary: '#C8E6C9',
      secondary: '#43A047',
    },
    color: {
      primary: '#1B5E20',
    },
  },
  intake: {
    background: {
      primary: '#e0b6fc',
    },
    color: {
      primary: '#412654',
    },
  },
  'ready for provider': {
    background: {
      primary: '#D1C4E9',
      secondary: '#673AB7',
    },
    color: {
      primary: '#311B92',
    },
  },
  provider: {
    background: {
      primary: '#B3E5FC',
    },
    color: {
      primary: '#01579B',
    },
  },
  'ready for discharge': {
    background: {
      primary: '#B2EBF2',
    },
    color: {
      primary: '#006064',
    },
  },
  completed: {
    background: {
      primary: '#FFFFFF',
    },
    color: {
      primary: '#546E7A',
    },
  },
  cancelled: {
    background: {
      primary: '#FECDD2',
    },
    color: {
      primary: '#B71C1C',
    },
  },
  'no show': {
    background: {
      primary: '#DFE5E9',
    },
    color: {
      primary: '#212121',
    },
  },
  unknown: {
    background: {
      primary: '#FFFFFF',
    },
    color: {
      primary: '#000000',
    },
  },
};

const linkStyle = {
  display: 'contents',
  color: otherColors.tableRow,
};

const longWaitTimeFlag = (appointment: InPersonAppointmentInformation, statusTime: number): boolean => {
  if (
    appointment.status === 'ready for provider' ||
    appointment.status === 'intake' ||
    (appointment.status === 'ready' && appointment.appointmentType !== 'walk-in')
  ) {
    if (statusTime > 45) {
      return true;
    }
  }
  return false;
};

export default function AppointmentTableRow({
  appointment,
  location,
  actionButtons,
  showTime,
  now,
  tab,
  updateAppointments,
  setEditingComment,
}: AppointmentTableProps): ReactElement {
  const { oystehr, oystehrZambda } = useApiClients();
  const theme = useTheme();
  const navigate = useNavigate();
  const { encounter } = appointment;
  const [statusTime, setStatusTime] = useState<string>('');
  const [arrivedStatusSaving, setArrivedStatusSaving] = useState<boolean>(false);
  const [chatModalOpen, setChatModalOpen] = useState<boolean>(false);
  const [hasUnread, setHasUnread] = useState<boolean>(appointment.smsModel?.hasUnreadMessages || false);
  const user = useEvolveUser();
  const [isCSSButtonIsLoading, setCSSButtonIsLoading] = useState(false);
  const { handleUpdatePractitioner } = usePractitionerActions(encounter, 'start', practitionerType.Admitter);

  const handleCSSButton = async (): Promise<void> => {
    setCSSButtonIsLoading(true);
    try {
      await handleUpdatePractitioner();
      await handleChangeInPersonVisitStatus(encounter, user, oystehrZambda, 'intake');
      navigate(`/in-person/${appointment.id}/patient-info`);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    }
    setCSSButtonIsLoading(false);
  };

  const officePhoneNumber = getOfficePhoneNumber(location);

  const patientName =
    (appointment.patient.lastName &&
      appointment.patient.firstName &&
      formatPatientName({
        firstName: appointment.patient.firstName,
        lastName: appointment.patient.lastName,
        middleName: appointment.patient.middleName,
      })) ||
    'Unknown';

  const admitterName =
    (appointment.participants.admitter?.lastName &&
      appointment.participants.admitter?.firstName &&
      `${appointment.participants.admitter?.lastName}, ${appointment.participants.admitter?.firstName}`) ||
    'Unknown';

  let start;
  if (appointment.start) {
    const locationTimeZone = getTimezone(location);
    const dateTime = DateTime.fromISO(appointment.start).setZone(locationTimeZone);
    start = dateTime.toFormat('h:mm a');
  }

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
    await checkinPatient(oystehr, appointment.id, appointment.encounterId, user);
    setArrivedStatusSaving(false);
    await updateAppointments();
  };
  const recentStatus = appointment?.visitStatusHistory[appointment.visitStatusHistory.length - 1];
  const { totalMinutes, waitingMinutesEstimate } = useMemo(() => {
    const totalMinutes = getVisitTotalTime(appointment, appointment.visitStatusHistory, now);
    const waitingMinutesEstimate = appointment?.waitingMinutes;
    return { totalMinutes, waitingMinutesEstimate };
  }, [appointment, now]);
  if (recentStatus && recentStatus.period) {
    const currentStatusTime = getDurationOfStatus(recentStatus, now);

    let statusTimeTemp =
      tab === ApptTab.cancelled || tab === ApptTab.completed || recentStatus.status === 'ready for discharge'
        ? `${formatMinutes(totalMinutes)}m`
        : `${formatMinutes(currentStatusTime)}m`;

    if (
      tab !== ApptTab.cancelled &&
      tab !== ApptTab.completed &&
      statusTimeTemp !== `${formatMinutes(totalMinutes)}m` &&
      recentStatus.status !== 'ready for discharge' &&
      appointment.visitStatusHistory &&
      appointment?.visitStatusHistory.length > 1
    ) {
      statusTimeTemp += ` / ${formatMinutes(totalMinutes)}m`;
    }

    if (statusTimeTemp !== statusTime) {
      setStatusTime(statusTimeTemp);
    }
  }

  const patientDateOfBirth = appointment.needsDOBConfirmation
    ? appointment.unconfirmedDOB
    : appointment.patient?.dateOfBirth;

  const isLongWaitingTime = useMemo(() => {
    return longWaitTimeFlag(appointment, parseInt(statusTime) || 0);
  }, [appointment, statusTime]);

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
        style={{ display: 'inline', fontWeight: 700 }}
      >
        Long wait: Please check on patient
      </Typography>
    </Box>
  );

  const timeToolTip = (
    <Grid container sx={{ width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {isLongWaitingTime && longWaitFlag}
        {appointment?.visitStatusHistory?.map((statusTemp, index) => {
          return (
            <Box key={index} sx={{ display: 'flex', gap: 1 }}>
              <Typography
                variant="body2"
                color={theme.palette.getContrastText(theme.palette.background.default)}
                style={{ display: 'inline', marginTop: 1 }}
              >
                {formatMinutes(getDurationOfStatus(statusTemp, now))} mins
              </Typography>
              {getAppointmentStatusChip(statusTemp.status as VisitStatusLabel)}
            </Box>
          );
        })}

        <Typography
          variant="body2"
          color={theme.palette.getContrastText(theme.palette.background.default)}
          style={{ display: 'inline', fontWeight: 700 }}
        >
          Total LOS: {formatMinutes(totalMinutes)} mins
        </Typography>
        <Typography
          variant="body2"
          color={theme.palette.getContrastText(theme.palette.background.default)}
          style={{ display: 'inline', fontWeight: 700 }}
          sx={{ whiteSpace: { md: 'nowrap', sm: 'normal' } }}
        >
          Estimated wait time at check-in:
          {waitingMinutesEstimate !== undefined
            ? ` ${formatMinutes(Math.floor(waitingMinutesEstimate / 5) * 5)} mins`
            : ''}
          {/* previous waiting minutes logic
          {waitingMinutesEstimate
            ? ` ${formatMinutes(waitingMinutesEstimate)} - ${formatMinutes(waitingMinutesEstimate + 15)} mins`
            : ''} */}
        </Typography>
      </Box>
    </Grid>
  );

  const statusTimeEl = (
    <>
      <Grid item>{isLongWaitingTime && <PriorityIconWithBorder fill={theme.palette.warning.main} />}</Grid>
      <Grid item sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="body1" sx={{ display: 'inline', fontWeight: `${isLongWaitingTime ? '700' : ''}` }}>
          {statusTime}
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
  );

  const quickTexts: { [key in LANGUAGES]: string }[] = useMemo(() => {
    return [
      // todo need to make url dynamic or pull from location
      {
        english: `Please complete the paperwork and sign consent forms to avoid a delay in check-in. For ${appointment.patient.firstName}, click here: ${VITE_APP_QRS_URL}/visit/${appointment.id}`,
        spanish: `Complete la documentación y firme los formularios de consentimiento para evitar demoras en el registro. Para ${appointment.patient.firstName}, haga clic aquí: ${VITE_APP_QRS_URL}/visit/${appointment.id}`,
      },
      {
        english:
          'To prevent any delays with your pre-booked visit, please complete the digital paperwork fully in our new system.',
        spanish:
          'Para evitar demoras en su visita preprogramada, complete toda la documentación digital en nuestro nuevo sistema.',
      },
      {
        english: 'We are now ready to check you in. Please head to the front desk to complete the process.',
        spanish: 'Ahora estamos listos para registrarlo. Diríjase a la recepción para completar el proceso.',
      },
      {
        english: 'We are ready for the patient to be seen, please enter the facility.',
        spanish: 'Estamos listos para atender al paciente; ingrese al centro.',
      },
      {
        english: `Ottehr is trying to get ahold of you. Please call us at ${officePhoneNumber} or respond to this text message.`,
        spanish: `Ottehr está intentando comunicarse con usted. Llámenos al ${officePhoneNumber} o responda a este mensaje de texto.`,
      },
      {
        english: `Ottehr hopes you are feeling better. Please call us with any questions at ${officePhoneNumber}.`,
        spanish: `Ottehr espera que se sienta mejor. Llámenos si tiene alguna pregunta al ${officePhoneNumber}.`,
      },
    ];
  }, [appointment.id, appointment.patient.firstName, officePhoneNumber]);

  const onCloseChat = useCallback(() => {
    setChatModalOpen(false);
  }, [setChatModalOpen]);

  const onMarkAllRead = useCallback(() => {
    setHasUnread(false);
  }, [setHasUnread]);

  const goToVisitDetails = (): void => {
    navigate(`/visit/${appointment.id}`);
  };

  const goToCharts = (): void => {
    navigate(`/in-person/${appointment.id}`);
  };

  const isVisitPrebookedOrCancelledOrInWaitingRoom =
    tab === ApptTab['prebooked'] ||
    tab === ApptTab['cancelled'] ||
    (tab === ApptTab['in-office'] && (appointment.status === 'arrived' || appointment.status === 'ready'));

  const handleCellClick = isVisitPrebookedOrCancelledOrInWaitingRoom ? goToVisitDetails : goToCharts;

  if (isMobile) {
    return (
      <AppointmentTableRowMobile
        appointment={appointment}
        patientName={patientName}
        start={start}
        tab={tab}
        formattedPriorityHighIcon={formattedPriorityHighIcon}
        statusTime={statusTime}
        statusChip={getAppointmentStatusChip(appointment.status)}
        isLongWaitingTime={isLongWaitingTime}
        patientDateOfBirth={patientDateOfBirth}
        statusTimeEl={showTime ? statusTimeEl : undefined}
        linkStyle={linkStyle}
        timeToolTip={timeToolTip}
      ></AppointmentTableRowMobile>
    );
  }

  return (
    <TableRow
      id="appointments-table-row"
      data-testid={dataTestIds.dashboard.tableRowWrapper(appointment.id)}
      sx={{
        '&:last-child td, &:last-child th': { border: 0 },
        '&:hover': {
          backgroundColor: otherColors.apptHover,
        },
        '& .MuiTableCell-root': { p: '8px' },
        position: 'relative',
        ...(appointment.next && {
          // borderTop: '2px solid #43A047',
          boxShadow: `inset 0 0 0 1px ${CHIP_STATUS_MAP[appointment.status].background.secondary}`,
        }),
      }}
    >
      <TableCell sx={{ verticalAlign: 'center', cursor: 'pointer' }} onClick={handleCellClick}>
        {appointment.next && (
          <Box
            sx={{
              backgroundColor: CHIP_STATUS_MAP[appointment.status].background.secondary,
              position: 'absolute',
              width: '25px',
              bottom: 0,
              left: '-25px',
              height: '100%',
              borderTopLeftRadius: '10px',
              borderBottomLeftRadius: '10px',
            }}
          >
            <Typography
              variant="body1"
              fontSize={14}
              sx={{
                writingMode: 'vertical-lr',
                transform: 'scale(-1)',
                position: 'absolute',
                top: '28%',
                left: '10%',
                color: theme.palette.background.paper,
              }}
            >
              NEXT
            </Typography>
          </Box>
        )}
      </TableCell>
      <TableCell
        sx={{ cursor: 'pointer' }}
        onClick={handleCellClick}
        data-testid={dataTestIds.dashboard.tableRowStatus(appointment.id)}
      >
        <Typography variant="body1">
          {capitalize?.(
            appointment.appointmentType === 'post-telemed'
              ? 'Post Telemed'
              : (appointment.appointmentType || '').toString()
          )}
        </Typography>
        <Typography variant="body1">
          <strong data-testid={dataTestIds.dashboard.appointmentTime}>{start}</strong>
        </Typography>
        {tab !== ApptTab.prebooked && <Box mt={1}>{getAppointmentStatusChip(appointment.status)}</Box>}
      </TableCell>
      {/* placeholder until time stamps for waiting and in exam or something comparable are made */}
      {/* <TableCell sx={{ verticalAlign: 'top' }}><Typography variant="body1" aria-owns={hoverElement ? 'status-popover' : undefined} aria-haspopup='true' sx={{ verticalAlign: 'top' }} onMouseOver={(event) => setHoverElement(event.currentTarget)} onMouseLeave={() => setHoverElement(undefined)}>{statusTime}</Typography></TableCell>
          <Popover id='status-popover' open={hoverElement !== undefined} anchorEl={hoverElement} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} transformOrigin={{ vertical: 'bottom', horizontal: 'right' }} onClose={() => setHoverElement(undefined)}><Typography>test</Typography></Popover> */}
      {showTime && (
        <TableCell sx={{ verticalAlign: 'center', cursor: 'pointer' }} onClick={handleCellClick}>
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
          >
            <Grid sx={{ display: 'flex', alignItems: 'center', marginTop: '8px' }} gap={1}>
              {statusTimeEl}
            </Grid>
          </Tooltip>
        </TableCell>
      )}
      <TableCell sx={{ verticalAlign: 'center', wordWrap: 'break-word', cursor: 'pointer' }} onClick={handleCellClick}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontSize: '16px' }} data-testid={dataTestIds.dashboard.patientName}>
            {patientName}
          </Typography>
          {appointment.needsDOBConfirmation ? (
            <GenericToolTip title="Date of birth for returning patient was not confirmed" customWidth="170px">
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>{`${
                  appointment.patient?.sex && capitalize(appointment.patient?.sex)
                } | `}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap' }}>
                  <PatientDateOfBirth dateOfBirth={patientDateOfBirth} />
                  {appointment.needsDOBConfirmation && <PriorityIconWithBorder fill={theme.palette.warning.main} />}
                </Box>
              </Box>
            </GenericToolTip>
          ) : (
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography sx={{ color: theme.palette.text.secondary }}>{`${
                appointment.patient?.sex && capitalize(appointment.patient?.sex)
              } |`}</Typography>
              <PatientDateOfBirth dateOfBirth={patientDateOfBirth} />
            </Box>
          )}
          <ReasonsForVisit
            reasonsForVisit={appointment.reasonForVisit}
            tab={tab}
            formattedPriorityHighIcon={formattedPriorityHighIcon}
            lineMax={2}
          ></ReasonsForVisit>
        </Box>
      </TableCell>
      <TableCell
        align="center"
        sx={{
          verticalAlign: 'center',
          wordWrap: 'break-word',
        }}
      >
        {appointment.status === 'arrived' || appointment.status === 'pending' || appointment.status === 'ready' ? (
          <CSSButton
            isDisabled={!appointment.id}
            isLoading={isCSSButtonIsLoading}
            handleCSSButton={handleCSSButton}
            appointmentID={appointment.id}
          />
        ) : (
          <IntakeCheckmark providerName={admitterName} />
        )}
      </TableCell>
      <TableCell sx={{ verticalAlign: 'center', cursor: 'pointer' }} onClick={handleCellClick}>
        <Typography sx={{ fontSize: 14, display: 'inline' }}>{appointment.provider}</Typography>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'center', cursor: 'pointer' }} onClick={handleCellClick}>
        <Typography sx={{ fontSize: 14, display: 'inline' }}>{appointment.group}</Typography>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'center', cursor: 'pointer' }} onClick={handleCellClick}>
        <GenericToolTip title={<PaperworkToolTipContent appointment={appointment} />} customWidth="none">
          <Box sx={{ display: 'flex', gap: 0 }}>
            <AccountCircleOutlinedIcon
              sx={{ ml: 0, mr: 0.5, color: appointment.paperwork.demographics ? '#43A047' : '#BFC2C6' }}
              fill={otherColors.cardChip}
            ></AccountCircleOutlinedIcon>

            <HealthAndSafetyOutlinedIcon
              sx={{ mx: 0.5, color: appointment.paperwork.insuranceCard ? '#43A047' : '#BFC2C6' }}
              fill={otherColors.cardChip}
            ></HealthAndSafetyOutlinedIcon>

            <BadgeOutlinedIcon
              sx={{ mx: 0.5, color: appointment.paperwork.photoID ? '#43A047' : '#BFC2C6' }}
              fill={otherColors.cardChip}
            ></BadgeOutlinedIcon>

            <AssignmentTurnedInOutlinedIcon
              sx={{ mx: 0.5, color: appointment.paperwork.consent ? '#43A047' : '#BFC2C6' }}
              fill={otherColors.cardChip}
            ></AssignmentTurnedInOutlinedIcon>
          </Box>
        </GenericToolTip>
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
                ></ChatOutlineIcon>
              </Badge>
            ) : (
              <ChatOutlineIcon
                sx={{
                  color: theme.palette.primary.contrastText,
                  height: '20px',
                  width: '20px',
                }}
              ></ChatOutlineIcon>
            )}
          </IconButton>
        )}
      </TableCell>
      {actionButtons && (
        <TableCell sx={{ verticalAlign: 'center' }}>
          <LoadingButton
            onClick={handleArrivedClick}
            loading={arrivedStatusSaving}
            variant="contained"
            sx={{
              borderRadius: 8,
              textTransform: 'none',
              fontSize: '15px',
              fontWeight: '700',
            }}
          >
            Arrived
          </LoadingButton>
        </TableCell>
      )}
      {chatModalOpen && (
        <ChatModal
          appointment={appointment}
          currentLocation={location}
          onClose={onCloseChat}
          onMarkAllRead={onMarkAllRead}
          quickTexts={quickTexts}
        />
      )}
    </TableRow>
  );
}
