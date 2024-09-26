import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import ChatOutlineIcon from '@mui/icons-material/ChatOutlined';
import EditNoteIcon from '@mui/icons-material/EditNote';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded';
import RememberMeOutlinedIcon from '@mui/icons-material/RememberMeOutlined';
import { LoadingButton } from '@mui/lab';
import {
  Badge,
  Box,
  Chip,
  Grid,
  IconButton,
  Input,
  InputAdornment,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { Location } from 'fhir/r4';
import { DateTime } from 'luxon';
import React, { ReactElement, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { UCAppointmentInformation } from 'ehr-utils';
import { otherColors } from '../CustomThemeProvider';
import { PriorityIconWithBorder } from '../components/PriorityIconWithBorder';
import ChatModal from '../features/chat/ChatModal';
import { checkinPatient, getUpdateTagOperation } from '../helpers';
import { flagDateOfBirth } from '../helpers/flagDateOfBirth';
import { formatDateUsingSlashes, getTimezone } from '../helpers/formatDateTime';
import {
  formatMinutes,
  getDurationOfStatus,
  getStatiForVisitTimeCalculation,
  getVisitTotalTime,
} from '../helpers/visitDurationUtils';
import { useApiClients } from '../hooks/useAppClients';
import useOttehrUser from '../hooks/useOttehrUser';
import { ApptTab } from './AppointmentTabs';
import CustomChip from './CustomChip';
import { GenericToolTip, PaperworkToolTipContent } from './GenericToolTip';
import { VisitStatus, StatusLabel } from '../helpers/mappingUtils';

interface AppointmentTableProps {
  appointment: UCAppointmentInformation;
  location?: Location;
  actionButtons: boolean;
  showTime: boolean;
  now: DateTime;
  tab: ApptTab;
  updateAppointments: () => void;
  setEditingComment: (editingComment: boolean) => void;
}

const FLAGGED_REASONS_FOR_VISIT: string[] = [
  'Breathing problem',
  'Injury to head or fall on head',
  'Choked or swallowed something',
  'Allergic reaction',
];

export function getAppointmentStatusChip(status: string, count?: number): ReactElement {
  if (!status) {
    return <span>todo1</span>;
  }
  if (!CHIP_STATUS_MAP[status as keyof typeof CHIP_STATUS_MAP]) {
    return <span>todo2</span>;
  }

  return (
    <Chip
      size="small"
      label={count ? `${status} - ${count}` : status}
      sx={{
        borderRadius: '4px',
        textTransform: 'uppercase',
        background: CHIP_STATUS_MAP[status as keyof typeof CHIP_STATUS_MAP].background.primary,
        color: CHIP_STATUS_MAP[status as keyof typeof CHIP_STATUS_MAP].color.primary,
      }}
      variant="outlined"
    />
  );
}

export const CHIP_STATUS_MAP: {
  [status in VisitStatus]: {
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
      primary: '#555555',
    },
  },
  arrived: {
    background: {
      primary: '#EEEEE',
      secondary: '#444444',
    },
    color: {
      primary: '#444444',
    },
  },
  ready: {
    background: {
      primary: '#CEF9BA',
      secondary: '#43A047',
    },
    color: {
      primary: '#446F30',
    },
  },
  intake: {
    background: {
      primary: '#fddef0',
    },
    color: {
      primary: '#684e5d',
    },
  },
  'provider-ready': {
    background: {
      primary: '#EEEEEE',
      secondary: '#444444',
    },
    color: {
      primary: '#444444',
    },
  },
  provider: {
    background: {
      primary: '#FDFCB7',
    },
    color: {
      primary: '#6F6D1A',
    },
  },
  discharge: {
    background: {
      primary: '#B2EBF2',
    },
    color: {
      primary: '#006064',
    },
  },
  'checked-out': {
    background: {
      primary: '#FFFFFF',
    },
    color: {
      primary: '#555555',
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
  'no-show': {
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

const longWaitTimeFlag = (appointment: UCAppointmentInformation, statusTime: number): boolean => {
  if (
    appointment.status === 'ready for provider' ||
    appointment.status === 'intake' ||
    (appointment.status === 'ready' && appointment.appointmentType !== 'now')
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
  const { fhirClient } = useApiClients();
  const theme = useTheme();
  const [editingRow, setEditingRow] = useState<boolean>(false);
  const [apptComment, setApptComment] = useState<string>(appointment.comment || '');
  const [statusTime, setStatusTime] = useState<string>('');
  const [noteSaving, setNoteSaving] = useState<boolean>(false);
  const [arrivedStatusSaving, setArrivedStatusSaving] = useState<boolean>(false);
  const [chatModalOpen, setChatModalOpen] = useState<boolean>(false);
  const [hasUnread, setHasUnread] = useState<boolean>(appointment.smsModel?.hasUnreadMessages || false);
  const user = useOttehrUser();

  const patientName = `${appointment.patient.lastName}, ${appointment.patient.firstName}` || 'Unknown';
  let start;
  if (appointment.start) {
    const locationTimeZone = getTimezone(location);
    const dateTime = DateTime.fromISO(appointment.start).setZone(locationTimeZone);
    start = dateTime.toFormat('h:mm a');
  }

  // ovrp indicator icon logic
  const ovrpResons = [
    'throat pain',
    'rash or skin issue',
    'urinary problem',
    'eye concern',
    'vomiting and/or diarrhea',
  ];
  const isOvrpReason = ovrpResons.some((reason) => appointment.reasonForVisit.toLocaleLowerCase().includes(reason));
  const ageIsGoodForOVRP =
    DateTime.now().diff(
      DateTime.fromISO(
        appointment.needsDOBConfirmation ? appointment.unconfirmedDOB : appointment.patient?.dateOfBirth,
      ),
      'years',
    ).years >= 3;

  const showChatIcon = appointment.smsModel !== undefined;

  const saveNote = async (_event: React.MouseEvent<HTMLElement>): Promise<void> => {
    if (!fhirClient) {
      throw new Error('error getting fhir client');
    }
    if (!appointment.id) {
      throw new Error('error getting appointment id');
    }
    try {
      setNoteSaving(true);
      let patchOp: 'replace' | 'add' | 'remove';
      const patchOperations = [];
      if (apptComment !== '') {
        patchOp = appointment.comment ? 'replace' : 'add';
        patchOperations.push({ op: patchOp, path: '/comment', value: apptComment });
      } else {
        patchOp = 'remove';
        patchOperations.push({ op: patchOp, path: '/comment' });
      }
      const fhirAppointment = await fhirClient.readResource({
        resourceType: 'Appointment',
        resourceId: appointment.id,
      });
      const staffUpdateTagOp = getUpdateTagOperation(fhirAppointment, 'comment', user);
      patchOperations.push(staffUpdateTagOp);
      await fhirClient.patchResource({
        resourceType: 'Appointment',
        resourceId: appointment.id,
        operations: patchOperations,
      });
    } catch (error: unknown) {
      // todo tell the user there was an error
      console.log('error adding comment: ', error);
      setApptComment(appointment.comment || '');
    }
    setNoteSaving(false);
    setEditingRow(false);
    setEditingComment(false);
    updateAppointments();
  };

  useEffect(() => {
    setApptComment(appointment.comment || '');
  }, [appointment]);

  useEffect(() => {
    setHasUnread(appointment.smsModel?.hasUnreadMessages || false);
  }, [appointment.smsModel?.hasUnreadMessages]);

  const handleArrivedClick = async (_event: React.MouseEvent<HTMLElement>): Promise<void> => {
    if (!fhirClient) {
      throw new Error('error getting fhir client');
    }
    if (!appointment.id) {
      throw new Error('error getting appointment id');
    }
    setArrivedStatusSaving(true);
    await checkinPatient(fhirClient, appointment.id);
    setArrivedStatusSaving(false);
    updateAppointments();
  };

  const recentStatus = appointment?.visitStatusHistory[appointment.visitStatusHistory.length - 1];
  const { totalMinutes } = useMemo(() => {
    const totalMinutes = getVisitTotalTime(appointment, appointment.visitStatusHistory, now);
    // will surface this waiting estimate to staff in the future
    // const waitingMinutesEstimate = appointment?.waitingMinutes;
    return { totalMinutes };
  }, [appointment, now]);

  if (recentStatus && recentStatus.period) {
    const currentStatusTime = getDurationOfStatus(recentStatus, appointment, appointment.visitStatusHistory, now);

    let statusTimeTemp =
      tab === ApptTab.cancelled || tab === ApptTab.completed || recentStatus.label === 'ready for discharge'
        ? `${formatMinutes(totalMinutes)}m`
        : `${formatMinutes(currentStatusTime)}m`;

    if (
      tab !== ApptTab.cancelled &&
      tab !== ApptTab.completed &&
      statusTimeTemp !== `${formatMinutes(totalMinutes)}m` &&
      recentStatus.label !== 'ready for discharge' &&
      appointment.visitStatusHistory &&
      appointment?.visitStatusHistory.length > 1
    ) {
      statusTimeTemp += ` / ${formatMinutes(totalMinutes)}m`;
    }

    if (statusTimeTemp !== statusTime) {
      setStatusTime(statusTimeTemp);
    }
  }

  const flagDOB = flagDateOfBirth(
    appointment.needsDOBConfirmation ? appointment.unconfirmedDOB : appointment.patient?.dateOfBirth,
  );
  const patientDateOfBirth = (warning: boolean): ReactElement => (
    <Typography variant="body2" sx={{ color: warning ? otherColors.priorityHighText : theme.palette.text.secondary }}>
      DOB:{' '}
      {formatDateUsingSlashes(
        appointment.needsDOBConfirmation ? appointment.unconfirmedDOB : appointment.patient?.dateOfBirth,
      )}
    </Typography>
  );

  const isLongWaitingTime = useMemo(() => {
    return longWaitTimeFlag(appointment, parseInt(statusTime) || 0);
  }, [appointment, statusTime]);

  function displayReasonsForVisit(reasonsForVisit: string[]): ReactElement {
    const flaggedReasons: string[] = [];
    const nonFlaggedReasons: string[] = [];
    reasonsForVisit.forEach((reason) => {
      (FLAGGED_REASONS_FOR_VISIT.includes(reason) ? flaggedReasons : nonFlaggedReasons).push(reason);
    });

    const reasonForVisitReactElement = (
      <span>
        {flaggedReasons.length > 0 && (
          <>
            {formattedPriorityHighIcon}
            <Typography
              sx={{ fontSize: '14px', color: otherColors.priorityHighText, paddingLeft: '5px', display: 'inline' }}
            >
              {nonFlaggedReasons.length > 0 ? flaggedReasons.join(', ') + ', ' : flaggedReasons.join(', ')}
            </Typography>
          </>
        )}
        {nonFlaggedReasons.length > 0 && (
          <Typography sx={{ fontSize: '14px', display: 'inline' }}>{nonFlaggedReasons.join(', ')}</Typography>
        )}
      </span>
    );

    // If a tooltip is used, wrap entire ReactElement in tooltip
    return flaggedReasons.length > 0 ? (
      <GenericToolTip title="Alert clinical team for immediate evaluation">{reasonForVisitReactElement}</GenericToolTip>
    ) : (
      reasonForVisitReactElement
    );
  }

  const formattedPriorityHighIcon = (
    <PriorityHighRoundedIcon
      style={{
        height: '14px',
        width: '14px',
        padding: '2px',
        color: theme.palette.primary.contrastText,
        backgroundColor: otherColors.priorityHighIcon,
        borderRadius: '4px',
        marginRight: '3px',
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
        {getStatiForVisitTimeCalculation(appointment.visitStatusHistory, appointment.start).map((statusTemp) => {
          return (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Typography
                variant="body2"
                color={theme.palette.getContrastText(theme.palette.background.default)}
                style={{ display: 'inline', fontWeight: 700, marginTop: 1 }}
              >
                {formatMinutes(getDurationOfStatus(statusTemp, appointment, appointment.visitStatusHistory, now))} mins
              </Typography>
              {getAppointmentStatusChip(statusTemp.label as keyof typeof CHIP_STATUS_MAP)}
            </Box>
          );
        })}

        <Typography
          variant="body2"
          color={theme.palette.getContrastText(theme.palette.background.default)}
          style={{ display: 'inline' }}
        >
          Total waiting: {formatMinutes(totalMinutes)} mins
        </Typography>
      </Box>
    </Grid>
  );

  return (
    <TableRow
      sx={{
        '&:last-child td, &:last-child th': { border: 0 },
        '&:hover': {
          backgroundColor: otherColors.apptHover,
        },
        position: 'relative',
        ...(appointment.next && {
          // borderTop: '2px solid #43A047',
          boxShadow: `inset 0 0 0 1px ${theme.palette.secondary.main}`,
        }),
      }}
    >
      <TableCell sx={{ verticalAlign: 'top' }}>
        {appointment.next && (
          <Box
            sx={{
              backgroundColor: theme.palette.secondary.main,
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
        <Box>
          <Link to={`/visit/${appointment.id}`} style={linkStyle}>
            <Box sx={{ display: 'flex' }}>
              <CustomChip
                type={'status bullet'}
                fill={
                  appointment.appointmentType === 'prebook' ? theme.palette.primary.main : theme.palette.secondary.main
                }
              ></CustomChip>
              {/* status will either be booked or walked in - pending finalization of how we track walk ins */}
              <Typography variant="body1">
                {appointment.appointmentType}
                &nbsp;&nbsp;<strong>{start}</strong>
              </Typography>
            </Box>
            <Box mt={1}>{getAppointmentStatusChip(appointment.status)}</Box>
          </Link>
        </Box>
      </TableCell>
      {/* placeholder until time stamps for waiting and in exam or something comparable are made */}
      {/* <TableCell sx={{ verticalAlign: 'top' }}><Typography variant="body1" aria-owns={hoverElement ? 'status-popover' : undefined} aria-haspopup='true' sx={{ verticalAlign: 'top' }} onMouseOver={(event) => setHoverElement(event.currentTarget)} onMouseLeave={() => setHoverElement(undefined)}>{statusTime}</Typography></TableCell>
          <Popover id='status-popover' open={hoverElement !== undefined} anchorEl={hoverElement} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} transformOrigin={{ vertical: 'bottom', horizontal: 'right' }} onClose={() => setHoverElement(undefined)}><Typography>test</Typography></Popover> */}
      {showTime && (
        <TableCell sx={{ verticalAlign: 'top' }}>
          <Link to={`/visit/${appointment.id}`} style={linkStyle}>
            <Tooltip
              componentsProps={{
                tooltip: {
                  sx: {
                    width: '100%',
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
              <Grid sx={{ display: 'flex', alignItems: 'center' }} gap={1}>
                <Grid item>{isLongWaitingTime && <PriorityIconWithBorder fill={theme.palette.warning.main} />}</Grid>
                <Grid item sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography
                    variant="body1"
                    sx={{ display: 'inline', fontWeight: `${isLongWaitingTime ? '700' : ''}` }}
                  >
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
              </Grid>
            </Tooltip>
          </Link>
        </TableCell>
      )}
      <TableCell sx={{ verticalAlign: 'top', wordWrap: 'break-word' }}>
        <Link to={`/visit/${appointment.id}`} style={linkStyle}>
          <Typography variant="subtitle2" sx={{ fontSize: '16px' }}>
            <>{patientName}</>
          </Typography>
          {flagDOB || appointment.needsDOBConfirmation ? (
            <GenericToolTip
              title={`${flagDOB ? 'Expedited intake indicated' : ''}
                ${flagDOB && appointment.needsDOBConfirmation ? '&' : ''}
                ${appointment.needsDOBConfirmation ? 'Date of birth for returning patient was not confirmed' : ''}`}
              customWidth={flagDOB ? '150px' : '170px'}
            >
              <span style={{ display: 'flex', maxWidth: '150px', alignItems: 'center' }}>
                {flagDOB && formattedPriorityHighIcon}
                {patientDateOfBirth(flagDOB)}
                {appointment.needsDOBConfirmation && <PriorityIconWithBorder fill={theme.palette.warning.main} />}
              </span>
            </GenericToolTip>
          ) : (
            <>{patientDateOfBirth(false)}</>
          )}
        </Link>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top', wordWrap: 'break-word' }}>
        <Link to={`/visit/${appointment.id}`} style={linkStyle}>
          {displayReasonsForVisit(appointment.reasonForVisit.split(','))}
        </Link>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <Link to={`/visit/${appointment.id}`} style={linkStyle}>
          <GenericToolTip
            title={
              <PaperworkToolTipContent
                appointment={appointment}
                isOvrpReason={isOvrpReason}
                ageIsGoodForOVRP={ageIsGoodForOVRP}
              />
            }
            customWidth="none"
          >
            <Box sx={{ display: 'flex', gap: 1 }}>
              <AccountCircleOutlinedIcon
                sx={{ ml: 0, color: appointment.paperwork.demographics ? '#43A047' : '#BFC2C6' }}
                fill={otherColors.cardChip}
              ></AccountCircleOutlinedIcon>

              <HealthAndSafetyOutlinedIcon
                sx={{ color: appointment.paperwork.insuranceCard ? '#43A047' : '#BFC2C6' }}
                fill={otherColors.cardChip}
              ></HealthAndSafetyOutlinedIcon>

              <BadgeOutlinedIcon
                sx={{ color: appointment.paperwork.photoID ? '#43A047' : '#BFC2C6' }}
                fill={otherColors.cardChip}
              ></BadgeOutlinedIcon>

              <AssignmentTurnedInOutlinedIcon
                sx={{ color: appointment.paperwork.consent ? '#43A047' : '#BFC2C6' }}
                fill={otherColors.cardChip}
              ></AssignmentTurnedInOutlinedIcon>

              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <RememberMeOutlinedIcon
                  sx={{
                    color:
                      ageIsGoodForOVRP && isOvrpReason && appointment.paperwork.ovrpInterest ? '#43A047' : '#BFC2C6',
                  }}
                  fill={otherColors.cardChip}
                ></RememberMeOutlinedIcon>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontSize: '16px',
                      color: appointment.paperwork.ovrpInterest ? '#43A047' : '#BFC2C6',
                    }}
                  >
                    +
                  </Typography>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontSize: '16px',
                      color: ageIsGoodForOVRP && isOvrpReason ? '#43A047' : '#BFC2C6',
                    }}
                  >
                    +
                  </Typography>
                </Box>
              </Box>
            </Box>
          </GenericToolTip>
        </Link>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <Link to={`/visit/${appointment.id}`} style={linkStyle}>
          <Typography sx={{ fontSize: 14, display: 'inline' }}>{appointment.provider}</Typography>
        </Link>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <Link to={`/visit/${appointment.id}`} style={linkStyle}>
          <Typography sx={{ fontSize: 14, display: 'inline' }}>{appointment.group}</Typography>
        </Link>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <Input
          placeholder={'Add internal note...'}
          value={apptComment}
          onChange={(e) => setApptComment(e.target.value)}
          multiline
          disableUnderline={!editingRow}
          inputProps={{ maxLength: 160 }}
          onClick={(_event) => {
            setEditingRow(true);
            setEditingComment(true);
          }}
          fullWidth
          sx={{ alignItems: 'baseline' }}
          startAdornment={
            <InputAdornment position="start">
              <EditNoteIcon sx={{ fill: theme.palette.text.disabled }}></EditNoteIcon>
            </InputAdornment>
          }
        />
        {editingRow && (
          <LoadingButton loading={noteSaving} sx={{ marginTop: '8px', padding: '5px' }} onClick={saveNote}>
            Save
          </LoadingButton>
        )}
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
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
        <TableCell sx={{ verticalAlign: 'top' }}>
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
          onClose={() => setChatModalOpen(false)}
          onMarkAllRead={() => setHasUnread(false)}
        />
      )}
    </TableRow>
  );
}
