import { Pause, PlayArrow, Stop } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useBlocker } from './useBlocker';

export const TimerComponent: React.FC = () => {
  const [time, setTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showStopConfirm, setShowStopConfirm] = useState<boolean>(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState<boolean>(false);
  const [nextLocation, setNextLocation] = useState<any>(null);

  useEffect((): void => {
    const saved = localStorage.getItem('timerState');
    if (saved) {
      const { time } = JSON.parse(saved);
      setTime(time || 0);
    }
    setIsRunning(true);
    setIsPaused(false);
  }, []);

  useEffect((): void => {
    localStorage.setItem('timerState', JSON.stringify({ time, isRunning, isPaused }));
  }, [time, isRunning, isPaused]);

  const formatTime = useCallback((totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds].map((v) => v.toString().padStart(2, '0')).join(':');
  }, []);

  useEffect((): (() => void) => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime + 1);
      }, 1000);
    }
    return (): void => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPaused]);

  useBlocker((tx: any): void => {
    if (isRunning || time > 0) {
      setShowLeaveConfirm(true);
      setNextLocation(tx);
    } else {
      tx.retry();
    }
  }, true);

  const handleLeaveConfirmClose = (shouldLeave: boolean): void => {
    setShowLeaveConfirm(false);
    if (shouldLeave && nextLocation) {
      nextLocation.retry();
    }
  };

  const handlePauseResume = (): void => setIsPaused((prev) => !prev);

  const handleStop = (): void => setShowStopConfirm(true);

  const confirmStop = (): void => {
    setIsRunning(false);
    setIsPaused(false);
    setTime(0);
    setShowStopConfirm(false);
    localStorage.removeItem('timerState');
  };

  const cancelStop = (): void => setShowStopConfirm(false);

  return (
    <Paper sx={{ p: 2, backgroundColor: '#E3F2FD' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="h1"
            sx={{
              minWidth: '100px',
              color: '#0F347C',
              textAlign: 'center',
              fontFamily: 'monospace',
              fontWeight: 'bold',
            }}
          >
            {formatTime(time)}
          </Typography>

          {!isRunning ? (
            <Tooltip title="Start timer">
              <IconButton color="primary" sx={{ border: '1px solid' }} size="large" onClick={() => setIsRunning(true)}>
                <PlayArrow />
              </IconButton>
            </Tooltip>
          ) : (
            <>
              <Tooltip title={isPaused ? 'Resume timer' : 'Pause timer'}>
                <IconButton color="primary" size="large" sx={{ border: '1px solid' }} onClick={handlePauseResume}>
                  {isPaused ? <PlayArrow /> : <Pause />}
                </IconButton>
              </Tooltip>

              <Tooltip title="Stop timer">
                <IconButton sx={{ border: '1px solid' }} color="error" size="large" onClick={handleStop}>
                  <Stop />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>
      <Dialog open={showStopConfirm} onClose={cancelStop} maxWidth="xs" fullWidth>
        <DialogContent>
          <Typography sx={{ pl: 1 }}>Do you want to log the time for this patient before leaving this page?</Typography>
        </DialogContent>
        <DialogActions
          sx={{
            display: 'flex',
            justifyContent: 'end',
            pr: 3,
          }}
        >
          <Button onClick={cancelStop}>No</Button>
          <Button onClick={confirmStop} color="primary" variant="contained">
            Yes
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={showLeaveConfirm} onClose={() => handleLeaveConfirmClose(false)} maxWidth="xs" fullWidth>
        <DialogContent>
          <Typography sx={{ pl: 1 }}>You have an active timer. Are you sure you want to leave this page?</Typography>
        </DialogContent>
        <DialogActions
          sx={{
            display: 'flex',
            justifyContent: 'end',
            pr: 3,
          }}
        >
          <Button onClick={() => handleLeaveConfirmClose(false)}>Stay</Button>
          <Button onClick={() => handleLeaveConfirmClose(true)} color="primary" variant="contained">
            Leave
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TimerComponent;
