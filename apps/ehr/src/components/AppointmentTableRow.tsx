import { progressNoteIcon, startIntakeIcon } from '@ehrTheme/icons';
import ChatOutlineIcon from '@mui/icons-material/ChatOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import MedicalInformationIcon from '@mui/icons-material/MedicalInformationOutlined';
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded';
import { LoadingButton } from '@mui/lab';
import {
  Badge,
  Box,
  capitalize,
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
import { LocationWithWalkinSchedule } from 'src/pages/AddPatient';
import { otherColors } from 'src/themes/ottehr/colors';
import {
  formatMinutes,
  getDurationOfStatus,
  getPatchBinary,
  getVisitTotalTime,
  InPersonAppointmentInformation,
  OrdersForTrackingBoardRow,
  PROJECT_NAME,
  ROOM_EXTENSION_URL,
  VisitStatusLabel,
} from 'utils';
import { LANGUAGES } from '../constants';
import { dataTestIds } from '../constants/data-test-ids';
import ChatModal from '../features/chat/ChatModal';
import { checkInPatient, displayOrdersToolTip, hasAtLeastOneOrder } from '../helpers';
import { getTimezone } from '../helpers/formatDateTime';
import { formatPatientName } from '../helpers/formatPatientName';
import { getOfficePhoneNumber } from '../helpers/getOfficePhoneNumber';
import { handleChangeInPersonVisitStatus } from '../helpers/inPersonVisitStatusUtils';
import { useApiClients } from '../hooks/useAppClients';
import useEvolveUser from '../hooks/useEvolveUser';
import AppointmentNote from './AppointmentNote';
import AppointmentTableRowMobile from './AppointmentTableRowMobile';
import { ApptTab } from './AppointmentTabs';
import { GenericToolTip } from './GenericToolTip';
import GoToButton from './GoToButton';
import { InfoIconsToolTip } from './InfoIconsToolTip';
import { PatientDateOfBirth } from './PatientDateOfBirth';
import { PriorityIconWithBorder } from './PriorityIconWithBorder';
import ReasonsForVisit from './ReasonForVisit';

interface AppointmentTableRowProps {
  appointment: InPersonAppointmentInformation;
  location?: LocationWithWalkinSchedule;
  actionButtons: boolean;
  showTime: boolean;
  now: DateTime;
  tab: ApptTab;
  updateAppointments: () => void;
  setEditingComment: (editingComment: boolean) => void;
  orders: OrdersForTrackingBoardRow;
}

const VITE_APP_PATIENT_APP_URL = import.meta.env.VITE_APP_PATIENT_APP_URL;

export function getAppointmentStatusChip(status: VisitStatusLabel | undefined, count?: number): ReactElement {
  if (!status) {
    return <span>todo1</span>;
  }
  if (!CHIP_STATUS_MAP[status]) {
    return <span>todo2</span>;
  }

  return (
    <span
      data-testid={dataTestIds.dashboard.appointmentStatus}
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
  discharged: {
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
  orders,
}: AppointmentTableRowProps): ReactElement {
  const { oystehr, oystehrZambda } = useApiClients();
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

  if (!user) {
    throw new Error('User is not defined');
  }

  if (!encounter || !encounter.id) {
    throw new Error('Encounter is not defined');
  }

  const encounterId: string = encounter.id;

  const [startIntakeButtonLoading, setStartIntakeButtonLoading] = useState(false);
  const [progressNoteButtonLoading, setProgressNoteButtonLoading] = useState(false);
  const [dischargeButtonLoading, setDischargeButtonLoading] = useState(false);

  const rooms = useMemo(() => {
    return location?.extension?.filter((ext) => ext.url === ROOM_EXTENSION_URL).map((ext) => ext.valueString);
  }, [location]);

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
        style={{ display: 'inline', fontWeight: 500 }}
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
          style={{ display: 'inline', fontWeight: 500 }}
        >
          Total LOS: {formatMinutes(totalMinutes)} mins
        </Typography>
        <Typography
          variant="body2"
          color={theme.palette.getContrastText(theme.palette.background.default)}
          style={{ display: 'inline', fontWeight: 500 }}
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
        english: `Please complete the paperwork and sign consent forms to avoid a delay in check-in. For ${appointment.patient.firstName}, click here: ${VITE_APP_PATIENT_APP_URL}/visit/${appointment.id}`,
        // cSpell:disable-next Spanish
        spanish: `Complete la documentación y firme los formularios de consentimiento para evitar demoras en el registro. Para ${appointment.patient.firstName}, haga clic aquí: ${VITE_APP_PATIENT_APP_URL}/visit/${appointment.id}`,
      },
      {
        english:
          'To prevent any delays with your pre-booked visit, please complete the digital paperwork fully in our new system.',
        spanish:
          // cSpell:disable-next Spanish
          'Para evitar demoras en su visita preprogramada, complete toda la documentación digital en nuestro nuevo sistema.',
      },
      {
        english: 'We are now ready to check you in. Please head to the front desk to complete the process.',
        // cSpell:disable-next Spanish
        spanish: 'Ahora estamos listos para registrarlo. Diríjase a la recepción para completar el proceso.',
      },
      {
        english: 'We are ready for the patient to be seen, please enter the facility.',
        // cSpell:disable-next Spanish
        spanish: 'Estamos listos para atender al paciente; ingrese al centro.',
      },
      {
        english: `${PROJECT_NAME} is trying to get ahold of you. Please call us at ${officePhoneNumber} or respond to this text message.`,
        // cSpell:disable-next Spanish
        spanish: `${PROJECT_NAME} está intentando comunicarse con usted. Llámenos al ${officePhoneNumber} o responda a este mensaje de texto.`,
      },
      {
        english: `${PROJECT_NAME} hopes you are feeling better. Please call us with any questions at ${officePhoneNumber}.`,
        // cSpell:disable-next Spanish
        spanish: `${PROJECT_NAME} espera que se sienta mejor. Llámenos si tiene alguna pregunta al ${officePhoneNumber}.`,
      },
    ];
  }, [appointment.id, appointment.patient.firstName, officePhoneNumber]);

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
      />
    );
  }

  const handleStartIntakeButton = async (): Promise<void> => {
    setStartIntakeButtonLoading(true);
    try {
      await handleChangeInPersonVisitStatus(
        {
          encounterId: encounterId,
          user,
          updatedStatus: 'intake',
        },
        oystehrZambda
      );
      navigate(`/in-person/${appointment.id}/patient-info`);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    }
    setStartIntakeButtonLoading(false);
  };

  const renderStartIntakeButton = (): ReactElement | undefined => {
    if (appointment.status === 'arrived' || appointment.status === 'ready' || appointment.status === 'intake') {
      return (
        <GoToButton
          text="Start Intake"
          loading={startIntakeButtonLoading}
          onClick={handleStartIntakeButton}
          dataTestId={dataTestIds.dashboard.intakeButton}
        >
          <img src={startIntakeIcon} />
        </GoToButton>
      );
    }
    return undefined;
  };

  const handleProgressNoteButton = async (): Promise<void> => {
    setProgressNoteButtonLoading(true);
    try {
      navigate(`/in-person/${appointment.id}`);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    }
    setProgressNoteButtonLoading(false);
  };

  const renderProgressNoteButton = (): ReactElement | undefined => {
    if (
      appointment.status === 'ready for provider' ||
      appointment.status === 'provider' ||
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

  const handleDischargeButton = async (): Promise<void> => {
    setDischargeButtonLoading(true);
    try {
      await handleChangeInPersonVisitStatus(
        {
          encounterId: encounterId,
          user,
          updatedStatus: 'discharged',
        },
        oystehrZambda
      );
      await updateAppointments();
      enqueueSnackbar('Patient discharged successfully', { variant: 'success' });
    } catch (error) {
      console.error(error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    }
    setDischargeButtonLoading(false);
  };

  const renderDischargeButton = (): ReactElement | undefined => {
    if (appointment.status === 'provider') {
      return (
        <GoToButton
          loading={dischargeButtonLoading}
          text="Discharge"
          onClick={handleDischargeButton}
          dataTestId={dataTestIds.dashboard.dischargeButton}
        >
          <LogoutIcon />
        </GoToButton>
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

  return (
    <TableRow
      id="appointments-table-row"
      data-testid={dataTestIds.dashboard.tableRowWrapper(appointment.id)}
      sx={{
        '&:last-child td, &:last-child th': { border: 0 },
        '& .MuiTableCell-root': { p: '8px' },
        position: 'relative',
        ...(appointment.next && {
          // borderTop: '2px solid #43A047',
          boxShadow: `inset 0 0 0 1px ${CHIP_STATUS_MAP[appointment.status].background.secondary}`,
        }),
      }}
    >
      <TableCell sx={{ verticalAlign: 'center', position: 'relative' }}>
        {appointment.next && (
          <Box
            sx={{
              backgroundColor: CHIP_STATUS_MAP[appointment.status].background.secondary,
              position: 'absolute',
              width: '22px',
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
              fontSize={14}
              sx={{
                writingMode: 'vertical-lr',
                transform: 'scale(-1)',
                color: theme.palette.background.paper,
              }}
            >
              NEXT
            </Typography>
          </Box>
        )}
      </TableCell>
      <TableCell
        sx={{ padding: '8px 8px 8px 23px !important' }}
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
          <strong>{start}</strong>
        </Typography>
        {tab !== ApptTab.prebooked && <Box mt={1}>{getAppointmentStatusChip(appointment.status)}</Box>}
      </TableCell>
      {/* placeholder until time stamps for waiting and in exam or something comparable are made */}
      {/* <TableCell sx={{ verticalAlign: 'top' }}><Typography variant="body1" aria-owns={hoverElement ? 'status-popover' : undefined} aria-haspopup='true' sx={{ verticalAlign: 'top' }} onMouseOver={(event) => setHoverElement(event.currentTarget)} onMouseLeave={() => setHoverElement(undefined)}>{statusTime}</Typography></TableCell>
          <Popover id='status-popover' open={hoverElement !== undefined} anchorEl={hoverElement} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} transformOrigin={{ vertical: 'bottom', horizontal: 'right' }} onClose={() => setHoverElement(undefined)}><Typography>test</Typography></Popover> */}
      {showTime && (
        <TableCell sx={{ verticalAlign: 'center' }}>
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
      <TableCell sx={{ verticalAlign: 'center', wordWrap: 'break-word' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Link
            to={`/patient/${appointment.patient.id}`}
            style={{ textDecoration: 'none' }}
            data-testid={dataTestIds.dashboard.patientName}
          >
            <Typography variant="subtitle2" sx={{ fontSize: '16px', color: '#000' }}>
              {patientName}
            </Typography>
          </Link>
          {appointment.needsDOBConfirmation ? (
            <GenericToolTip title="Date of birth for returning patient was not confirmed" customWidth="170px">
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'nowrap' }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, whiteSpace: 'nowrap' }}>{`${
                  appointment.patient?.sex && capitalize(appointment.patient?.sex)
                } | `}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap' }}>
                  <PatientDateOfBirth dateOfBirth={patientDateOfBirth} />
                  {appointment.needsDOBConfirmation && <PriorityIconWithBorder fill={theme.palette.warning.main} />}
                </Box>
              </Box>
            </GenericToolTip>
          ) : (
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'nowrap' }}>
              <Typography sx={{ color: theme.palette.text.secondary, whiteSpace: 'nowrap' }}>{`${
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
        <Typography sx={{ fontSize: 14, display: 'inline' }}>{appointment.provider}</Typography>
      </TableCell>
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
      <TableCell sx={{ verticalAlign: 'center' }}>
        <Stack direction={'row'} spacing={1}>
          <GoToButton
            text="Visit Details"
            onClick={() => navigate(`/visit/${appointment.id}`)}
            dataTestId={dataTestIds.dashboard.visitDetailsButton}
          >
            <MedicalInformationIcon />
          </GoToButton>
          {renderStartIntakeButton()}
          {renderProgressNoteButton()}
          {renderDischargeButton()}
        </Stack>
      </TableCell>
      {actionButtons && (
        <TableCell sx={{ verticalAlign: 'center' }}>
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
