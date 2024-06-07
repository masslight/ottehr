import { CustomTooltip } from './CustomTooltip';
import { Box, ClickAwayListener, Typography, useTheme } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { AppointmentStatusChip } from './AppointmentStatusChip';
import { diffInMinutes, getAppointmentWaitingTime } from '../utils';
import React, { FC, useState } from 'react';
import { DateTime } from 'luxon';
import { TelemedStatusHistoryElement, ApptStatus } from 'ehr-utils';

type StatusHistoryTooltipProps = {
  history: TelemedStatusHistoryElement[];
  currentStatus: keyof typeof ApptStatus;
};

export const StatusHistory: FC<StatusHistoryTooltipProps> = (props) => {
  const { history, currentStatus } = props;
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const handleTooltipClose = (): void => {
    setOpen(false);
  };

  const handleTooltipOpen = (): void => {
    setOpen(true);
  };

  const currentTimeISO = new Date().toISOString();
  const currentTime = DateTime.fromISO(currentTimeISO);
  const startTime = DateTime.fromISO(history[0].start!);

  const total =
    currentStatus === ApptStatus.complete
      ? diffInMinutes(DateTime.fromISO(history.at(-1)!.end!), DateTime.fromISO(history[0].start!))
      : diffInMinutes(currentTime, startTime);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography>
        {[ApptStatus.ready, ApptStatus.complete].includes(ApptStatus[currentStatus]) ? (
          <>{getAppointmentWaitingTime(history)}m</>
        ) : (
          <>
            {diffInMinutes(
              DateTime.fromISO(history.at(-1)!.end || currentTimeISO),
              DateTime.fromISO(history.at(-1)!.start!)
            )}
            m / {total}m
          </>
        )}
      </Typography>
      <ClickAwayListener onClickAway={handleTooltipClose}>
        <div>
          <CustomTooltip
            PopperProps={{
              disablePortal: true,
            }}
            onClose={handleTooltipClose}
            open={open}
            disableFocusListener
            disableHoverListener
            disableTouchListener
            title={
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {history.map((element, index) => (
                  <Box sx={{ display: 'flex', gap: 1 }} key={`${element.status}-${index}`}>
                    <Typography sx={{ minWidth: '60px' }}>
                      {diffInMinutes(DateTime.fromISO(element.end || currentTimeISO), DateTime.fromISO(element.start!))}{' '}
                      mins
                    </Typography>
                    <AppointmentStatusChip status={element.status} />
                  </Box>
                ))}
                <Typography sx={{ fontWeight: 700, mt: 1 }}>Total: {total} mins</Typography>
              </Box>
            }
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <InfoOutlinedIcon
                onClick={handleTooltipOpen}
                fontSize="small"
                sx={{ color: theme.palette.text.secondary, cursor: 'pointer' }}
              />
            </Box>
          </CustomTooltip>
        </div>
      </ClickAwayListener>
    </Box>
  );
};
