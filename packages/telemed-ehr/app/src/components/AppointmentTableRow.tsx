import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import ChatOutlineIcon from '@mui/icons-material/ChatOutlined';
import EditNoteIcon from '@mui/icons-material/EditNote';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded';
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
  capitalize,
  useTheme,
} from '@mui/material';
import { Location } from 'fhir/r4';
import { DateTime } from 'luxon';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { otherColors } from '../CustomThemeProvider';
import { PriorityIconWithBorder } from '../components/PriorityIconWithBorder';
import { useChat, useHasUnreadMessage } from '../contexts/ChatContext';
import { checkinPatient } from '../helpers';
import { VisitStatusHistoryEntry, StatusLabel } from '../helpers/mappingUtils';
import { flagDateOfBirth } from '../helpers/flagDateOfBirth';
import { formatDateUsingSlashes, getTimezone } from '../helpers/formatDateTime';
import { useApiClients } from '../hooks/useAppClients';
import { AppointmentInformation } from '../types/types';
import { ApptTab } from './AppointmentTabs';
import CustomChip from './CustomChip';
import { GenericToolTip, PaperworkToolTipContent } from './GenericToolTip';
import { VisitStatus } from '../../../../ehr/zambdas/src/shared/fhirStatusMappingUtils';

interface AppointmentTableProps {
  appointment: AppointmentInformation;
  location: Location;
  actionButtons: boolean;
  showTime: boolean;
  now: DateTime;
  tab: ApptTab;
  updateAppointments: () => Promise<void>;
  setEditingComment: (editingComment: boolean) => void;
}

const FLAGGED_REASONS_FOR_VISIT: string[] = [
  'Breathing problem',
  'Injury to head or fall on head',
  'Choked or swallowed something',
  'Allergic reaction',
];

export function getAppointmentStatusChip(status: StatusLabel, count?: number): ReactElement {
  if (!status) {
    return <span>todo1</span>;
  }
  if (!CHIP_STATUS_MAP[status]) {
    return <span>todo2</span>;
  }

  return (
    <Chip
      size="small"
      label={count ? `${status} - ${count}` : status}
      sx={{
        borderRadius: '4px',
        textTransform: 'uppercase',
        background: CHIP_STATUS_MAP[status].background.primary,
        color: CHIP_STATUS_MAP[status].color.primary,
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
  PENDING: {
    background: {
      primary: '#FFFFFF',
    },
    color: {
      primary: '#555555',
    },
  },
  ARRIVED: {
    background: {
      primary: '#EEEEE',
      secondary: '#444444',
    },
    color: {
      primary: '#444444',
    },
  },
  READY: {
    background: {
      primary: '#CEF9BA',
      secondary: '#43A047',
    },
    color: {
      primary: '#446F30',
    },
  },
  INTAKE: {
    background: {
      primary: '#fddef0',
    },
    color: {
      primary: '#684e5d',
    },
  },
  'PROVIDER-READY': {
    background: {
      primary: '#EEEEEE',
      secondary: '#444444',
    },
    color: {
      primary: '#444444',
    },
  },
  PROVIDER: {
    background: {
      primary: '#FDFCB7',
    },
    color: {
      primary: '#6F6D1A',
    },
  },
  DISCHARGE: {
    background: {
      primary: '#B2EBF2',
    },
    color: {
      primary: '#006064',
    },
  },
  'CHECKED-OUT': {
    background: {
      primary: '#FFFFFF',
    },
    color: {
      primary: '#555555',
    },
  },
  CANCELLED: {
    background: {
      primary: '#FECDD2',
    },
    color: {
      primary: '#B71C1C',
    },
  },
  'NO-SHOW': {
    background: {
      primary: '#DFE5E9',
    },
    color: {
      primary: '#212121',
    },
  },
  UNKNOWN: {
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

const filterVisitStatusHistory = (
  statuses: VisitStatusHistoryEntry[],
  appointmentStart: string,
): VisitStatusHistoryEntry[] => {
  return statuses?.filter(
    (statusEvent: VisitStatusHistoryEntry) =>
      (statusEvent.label !== 'PENDING' && statusEvent.label !== 'DISCHARGE') ||
      (statusEvent.period.end &&
        DateTime.fromISO(statusEvent.period.end).diff(DateTime.fromISO(appointmentStart), 'minutes').minutes >= 0),
  );
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

  const patientName = `${appointment.patient.lastName}, ${appointment.patient.firstName}` || 'Unknown';
  let start;
  if (appointment.start) {
    const locationTimeZone = getTimezone(location);
    const dateTime = DateTime.fromISO(appointment.start).setZone(locationTimeZone);
    start = dateTime.toFormat('h:mm a');
  }
  const { openChat, getConversation } = useChat();
  const hasUnread = useHasUnreadMessage(appointment.conversationModel?.conversationSID ?? '');
  const showChatIcon: boolean = useMemo(() => {
    const convoId = appointment.conversationModel?.conversationSID;
    if (convoId) {
      return getConversation(convoId) !== undefined;
    }
    return false;
  }, [getConversation, appointment.conversationModel]);

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
    await updateAppointments();
  };

  useEffect(() => {
    setApptComment(appointment.comment || '');
  }, [appointment]);

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
    await updateAppointments();
  };

  const getDurationOfStatus = useCallback(
    (statusEntry: VisitStatusHistoryEntry): number => {
      if (statusEntry.label === 'PENDING') {
        if (statusEntry.period.end) {
          // if the appointment status is not currently pending, the duration is the difference
          // between the end of the status period and the start of the appointment time
          return DateTime.fromISO(statusEntry.period.end).diff(DateTime.fromISO(appointment.start), 'minutes').minutes;
        } else if (statusEntry.period.start) {
          // otherwise, the pending time is the difference between the start of the
          // appointment time and the current time.
          return now.diff(DateTime.fromISO(appointment.start), 'minutes').minutes;
        }
      }

      if (statusEntry.period.start && statusEntry.period.end) {
        return DateTime.fromISO(statusEntry.period.end).diff(DateTime.fromISO(statusEntry.period.start), 'minutes')
          .minutes;
      } else if (statusEntry.period.start) {
        const stopCountingForStatus = ['canceled', 'no show', 'checked out'];
        // stop counting once appointments move to the 'completed' tab.
        if (stopCountingForStatus.includes(statusEntry.label)) {
          // if the appointment status is one of `stopCountingForStatus`, the
          // duration is the difference between start of the current status and
          // the end of the previous status
          const prevStatusHistoryIdx = appointment.visitStatusHistory.length - 2;
          const prevEntry = appointment.visitStatusHistory[prevStatusHistoryIdx];
          if (prevEntry === undefined) {
            return 0;
          }
          return DateTime.fromISO(statusEntry.period.start).diff(
            DateTime.fromISO(prevEntry.period.end ?? ''),
            'minutes',
          ).minutes;
        } else {
          // otherwise, the duration is the difference betweeen now and the start of the status entry
          return now.diff(DateTime.fromISO(statusEntry.period.start), 'minutes').minutes;
        }
      } else {
        return 0;
      }
    },
    [appointment.start, appointment.visitStatusHistory, now],
  );

  const recentStatus = appointment?.visitStatusHistory[appointment.visitStatusHistory.length - 1];
  const totalMinutes = useMemo(() => {
    if (appointment) {
      // console.log('appointment', appointment.id);
      return filterVisitStatusHistory(appointment.visitStatusHistory, appointment.start).reduce(
        (accumulator, statusTemp) => accumulator + getDurationOfStatus(statusTemp),
        0,
      );
    }
    return 0;
  }, [appointment, getDurationOfStatus]);

  if (recentStatus && recentStatus.period) {
    const currentStatusTime = getDurationOfStatus(recentStatus);

    let statusTimeTemp =
      tab === ApptTab.cancelled || tab === ApptTab.completed || recentStatus.label === 'DISCHARGE'
        ? `${formatMinutes(totalMinutes)}m`
        : `${formatMinutes(currentStatusTime)}m`;

    if (
      tab !== ApptTab.cancelled &&
      tab !== ApptTab.completed &&
      statusTimeTemp !== `${formatMinutes(totalMinutes)}m` &&
      recentStatus.label !== 'DISCHARGE' &&
      appointment.visitStatusHistory &&
      appointment?.visitStatusHistory.length > 1
    ) {
      statusTimeTemp += ` / ${formatMinutes(totalMinutes)}m`;
    }

    if (statusTimeTemp !== statusTime) {
      setStatusTime(statusTimeTemp);
    }
  }

  function formatMinutes(minutes: number): string {
    return minutes.toLocaleString('en', { maximumFractionDigits: 0 });
  }

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
            <PriorityHighRoundedIcon
              style={{
                height: '14px',
                width: '14px',
                padding: '2px',
                color: theme.palette.primary.contrastText,
                backgroundColor: otherColors.priorityHighIcon,
                borderRadius: '4px',
                marginTop: '2px',
              }}
            />
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
          boxShadow: `inset 0 0 0 1px ${CHIP_STATUS_MAP[appointment.status].background.secondary}`,
        }),
      }}
    >
      <TableCell sx={{ verticalAlign: 'top' }}>
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
        <Box>
          {/* <Link to={`/visit/${appointment.id}`} style={linkStyle}> */}
          <Box sx={{ display: 'flex' }}>
            <CustomChip
              type={'status bullet'}
              fill={
                appointment.appointmentType === 'pre-booked' ? theme.palette.primary.main : theme.palette.secondary.main
              }
            ></CustomChip>
            {/* status will either be booked or walked in - pending finalization of how we track walk ins */}
            <Typography variant="body1">
              {capitalize(appointment.appointmentType)}
              &nbsp;&nbsp;<strong>{start}</strong>
            </Typography>
          </Box>
          <Box mt={1}>{getAppointmentStatusChip(appointment.status)}</Box>
          {/* </Link> */}
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
                    width: '70%',
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
              title={
                <Grid container>
                  {filterVisitStatusHistory(appointment.visitStatusHistory, appointment.start).map((statusTemp) => (
                    <span
                      // todo this is a potential point for bugs, can we get a more unique key to set
                      key={`${appointment.id}-${statusTemp.status}-${statusTemp.period.start}-${statusTemp.period.end}`}
                      style={{ display: 'contents' }}
                    >
                      <Grid
                        item
                        xs={6}
                        textAlign="center"
                        marginTop={0.5}
                        marginBottom={0.5}
                        sx={{ display: 'inline' }}
                      >
                        <Typography
                          variant="body1"
                          color={theme.palette.getContrastText(theme.palette.background.default)}
                          style={{ display: 'inline' }}
                        >
                          {`${formatMinutes(getDurationOfStatus(statusTemp))} ${
                            getDurationOfStatus(statusTemp) === 1 ? 'min' : 'mins'
                          }`}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} textAlign="center" marginTop={0.5} marginBottom={0.5}>
                        {getAppointmentStatusChip(statusTemp.label)}
                      </Grid>
                    </span>
                  ))}
                  <Grid item xs={12}>
                    <Typography
                      variant="body1"
                      textAlign="center"
                      color={theme.palette.getContrastText(theme.palette.background.default)}
                      marginTop={2}
                      sx={{ fontWeight: 'bold' }}
                    >
                      Total: {formatMinutes(totalMinutes)} {totalMinutes === 1 ? 'min' : 'mins'}
                    </Typography>
                  </Grid>
                </Grid>
              }
              placement="top"
              arrow
            >
              <Box sx={{ display: 'flex' }}>
                <Typography variant="body1" sx={{ display: 'inline' }}>
                  {statusTime}
                </Typography>
                {appointment.visitStatusHistory && appointment.visitStatusHistory.length > 1 && (
                  <span style={{ color: 'rgba(0, 0, 0, 0.6)', alignItems: 'center' }}>
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
              </Box>
            </Tooltip>
          </Link>
        </TableCell>
      )}
      <TableCell sx={{ verticalAlign: 'top', wordWrap: 'break-word' }}>
        <Link to={`/visit/${appointment.id}`} style={linkStyle}>
          <Typography variant="subtitle2" sx={{ fontSize: '16px' }}>
            <>{patientName}</>
          </Typography>
          <Typography variant="subtitle2" sx={{ fontSize: '16px' }}>
            {formatDateUsingSlashes(appointment.patient?.dateOfBirth)}
          </Typography>
        </Link>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top', wordWrap: 'break-word' }}>
        <Link to={`/visit/${appointment.id}`} style={linkStyle}>
          {displayReasonsForVisit(appointment.reasonForVisit.split(','))}
        </Link>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <Link to={`/visit/${appointment.id}`} style={linkStyle}>
          <GenericToolTip title={<PaperworkToolTipContent appointment={appointment} />} customWidth="none">
            <Box sx={{ display: 'flex', gap: 1 }}>
              <AccountCircleOutlinedIcon
                sx={{ ml: 0, mr: 0.75, color: appointment.paperwork.demographics ? '#43A047' : '#BFC2C6' }}
                fill={otherColors.cardChip}
              ></AccountCircleOutlinedIcon>

              <HealthAndSafetyOutlinedIcon
                sx={{ mx: 0.75, color: appointment.paperwork.insuranceCard ? '#43A047' : '#BFC2C6' }}
                fill={otherColors.cardChip}
              ></HealthAndSafetyOutlinedIcon>

              <BadgeOutlinedIcon
                sx={{ mx: 0.75, color: appointment.paperwork.photoID ? '#43A047' : '#BFC2C6' }}
                fill={otherColors.cardChip}
              ></BadgeOutlinedIcon>

              <AssignmentTurnedInOutlinedIcon
                sx={{ mx: 0.75, color: appointment.paperwork.consent ? '#43A047' : '#BFC2C6' }}
                fill={otherColors.cardChip}
              ></AssignmentTurnedInOutlinedIcon>
            </Box>
          </GenericToolTip>
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
              openChat(appointment.id);
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
    </TableRow>
  );
}
