import { Pause, PlayArrow, Stop } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Paper,
  Skeleton,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { useParams } from 'react-router-dom';
import { getCreateTimer, updateTimer } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { useBlocker } from './useBlocker';

export const TimerComponent: React.FC = () => {
  const [time, setTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const { oystehrZambda } = useApiClients();
  const [showStopConfirm, setShowStopConfirm] = useState<boolean>(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState<boolean>(false);
  const [nextLocation, setNextLocation] = useState<any>(null);
  const [_currentEncounter, setCurrentEncounter] = useState<any>(null);

  const { id: patientId } = useParams<{ id: string }>();

  const payload = {
    patientId: patientId ? patientId : undefined,
  };

  const updateTimerMutation = useMutation(
    (updateType: 'pause' | 'resume' | 'stop' | 'discard') => {
      if (!oystehrZambda) throw new Error('No zambda client');
      return updateTimer(
        {
          patientId,
          updateType,
        },
        oystehrZambda
      );
    },
    {
      onSuccess: (response) => {
        console.log('Timer updated successfully:', response);
      },
      onError: (error) => {
        console.error('Error updating timer:', error);
      },
    }
  );

  const isEncounterPaused = (encounter: any): boolean => {
    if (!encounter?.statusHistory || !Array.isArray(encounter.statusHistory)) {
      return false;
    }

    // Sort by start time to get chronological order
    const sortedHistory = [...encounter.statusHistory].sort(
      (a, b) => new Date(a.period.start).getTime() - new Date(b.period.start).getTime()
    );

    // Get the last status event
    const lastStatus = sortedHistory[sortedHistory.length - 1];

    // If the last status is 'onleave', the timer is paused
    return lastStatus?.status === 'onleave';
  };

  const { isLoading, refetch } = useQuery(
    ['get-create-timer', patientId, { oystehrZambda }],
    () => (oystehrZambda ? getCreateTimer(payload, oystehrZambda) : null),
    {
      onSuccess: (response: any) => {
        console.log('Timer data fetched:', response);
        if (response && response.encounterResults) {
          const encounter = Array.isArray(response.encounterResults)
            ? response.encounterResults[0]
            : response.encounterResults;

          if (encounter) {
            setCurrentEncounter(encounter);
            const totalTime = extractTotalTimeFromResponse(encounter);

            // Determine if timer is paused by checking the last statusHistory entry
            const isPausedFromHistory = isEncounterPaused(encounter);

            // Always prioritize the API state over localStorage for running encounters
            setTime(totalTime);
            if (encounter.status === 'in-progress') {
              setIsRunning(true);
              setIsPaused(isPausedFromHistory);
            } else {
              setIsRunning(false);
              setIsPaused(false);
            }

            // Clear localStorage when we have a valid encounter from API
            localStorage.removeItem('timerState');
          } else {
            setTime(0);
            setIsRunning(false);
            setIsPaused(false);
            setCurrentEncounter(null);
          }
        } else {
          setTime(0);
          setIsRunning(false);
          setIsPaused(false);
          setCurrentEncounter(null);
        }
      },
      onError: (error) => {
        console.error('Error fetching timer data:', error);
      },
      enabled: !!oystehrZambda && !!patientId,
    }
  );

  const cancelStop = (): void => setShowStopConfirm(false);

  const extractTotalTimeFromResponse = (data: any): number => {
    try {
      const totalTimeIdentifier = data?.identifier?.find((id: any) => id.system === 'total-time');

      if (totalTimeIdentifier) {
        return parseInt(totalTimeIdentifier.value, 10) || 0;
      }

      // If we have statusHistory, calculate time based on active periods
      if (data?.statusHistory && Array.isArray(data.statusHistory)) {
        let totalSeconds = 0;
        let lastStartTime: Date | null = null;

        // Sort statusHistory by period start time
        const sortedHistory = [...data.statusHistory].sort(
          (a, b) => new Date(a.period.start).getTime() - new Date(b.period.start).getTime()
        );

        for (const statusEvent of sortedHistory) {
          if (statusEvent.status === 'in-progress' && !lastStartTime) {
            // Start of an active period
            lastStartTime = new Date(statusEvent.period.start);
          } else if ((statusEvent.status === 'onleave' || statusEvent.status === 'finished') && lastStartTime) {
            // End of an active period - calculate the duration
            const endTime = new Date(statusEvent.period.start);
            totalSeconds += Math.floor((endTime.getTime() - lastStartTime.getTime()) / 1000);
            lastStartTime = null;
          }
        }

        // If there's an ongoing active period (no end time yet)
        if (lastStartTime && data.status === 'in-progress') {
          totalSeconds += Math.floor((Date.now() - lastStartTime.getTime()) / 1000);
        }

        return Math.max(0, totalSeconds);
      }

      // Fallback to simple period calculation if no statusHistory
      if (data?.period?.start) {
        const startTime = new Date(data.period.start).getTime();
        // If encounter is paused, don't count current time - use the start time only
        if (data.status === 'onhold' || data.status === 'finished') {
          const endTime = data.period.end ? new Date(data.period.end).getTime() : startTime;
          return Math.floor((endTime - startTime) / 1000);
        } else {
          // If still running, count up to current time
          const currentTime = Date.now();
          return Math.floor((currentTime - startTime) / 1000);
        }
      }

      return 0;
    } catch (error) {
      console.error('Error extracting time from response:', error);
      return 0;
    }
  };

  useEffect((): void => {
    void refetch();
  }, [refetch]);

  useEffect((): void => {
    const savedState = localStorage.getItem('timerState');
    if (savedState) {
      const { time: savedTime, isRunning: savedIsRunning, isPaused: savedIsPaused } = JSON.parse(savedState);
      if (!_currentEncounter) {
        setTime(savedTime);
        setIsRunning(savedIsRunning);
        setIsPaused(savedIsPaused);
      }
    }
  }, [_currentEncounter]);

  useEffect((): void => {
    if (time > 0 || isRunning || isPaused) {
      localStorage.setItem('timerState', JSON.stringify({ time, isRunning, isPaused }));
    }
  }, [time, isRunning, isPaused]);

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

  useEffect(() => {
    const handleBeforeUnload = (): void => {
      localStorage.setItem('timerState', JSON.stringify({ time, isRunning, isPaused }));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [time, isRunning, isPaused]);

  const formatTime = useCallback((totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds].map((v) => v.toString().padStart(2, '0')).join(':');
  }, []);

  useBlocker((tx: any): void => {
    if (isRunning || time > 0) {
      setShowLeaveConfirm(true);
      setNextLocation(tx);
    } else {
      tx.retry();
    }
  }, true);

  const handleLeaveConfirmClose = (shouldSave: boolean): void => {
    setShowLeaveConfirm(false);

    if (nextLocation) {
      if (shouldSave) {
        setIsRunning(false);
        setIsPaused(false);
        updateTimerMutation.mutate('stop');
        localStorage.removeItem('timerState');
        setCurrentEncounter(null);
        setTime(0);
      } else {
        setIsRunning(false);
        setIsPaused(false);
        updateTimerMutation.mutate('discard');
        localStorage.removeItem('timerState');
        setCurrentEncounter(null);
        setTime(0);
      }
      nextLocation.retry();
    }
  };

  const handlePauseResume = (): void => {
    if (isPaused) {
      setIsPaused(false);
      updateTimerMutation.mutate('resume');
    } else {
      setIsPaused(true);
      updateTimerMutation.mutate('pause');
    }
  };

  const handleStart = async (): Promise<any> => {
    console.log('Start clicked - current state:', { isRunning, isPaused, time });
    setIsRunning(true);
    setIsPaused(false);
    void refetch();
  };

  const handleStop = (): void => setShowStopConfirm(true);

  const confirmStop = (): void => {
    setIsRunning(false);
    setIsPaused(false);
    setTime(0);
    setShowStopConfirm(false);
    localStorage.removeItem('timerState');
    setCurrentEncounter(null);
    updateTimerMutation.mutate('stop');
  };

  const discardStop = (): void => {
    setIsRunning(false);
    setIsPaused(false);
    setTime(0);
    setShowStopConfirm(false);
    localStorage.removeItem('timerState');
    setCurrentEncounter(null);
    updateTimerMutation.mutate('discard');
  };

  if (isLoading) {
    return (
      <Paper sx={{ p: 2, boxShadow: 'none' }}>
        <Skeleton variant="text" width={120} height={40} />
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, mx: 2, boxShadow: 'none' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="h4"
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

          {!isRunning && !isPaused ? (
            <Tooltip title="Start timer">
              <IconButton color="primary" sx={{ border: '1px solid' }} size="large" onClick={handleStart}>
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
          <Typography sx={{ pl: 1 }}>
            Do you want to log the tracked time for this patient?
            <br />
            Click <b>Yes</b> to save the time, or <b>No</b> to discard it.
          </Typography>
        </DialogContent>

        <DialogActions
          sx={{
            display: 'flex',
            justifyContent: 'end',
            pr: 3,
          }}
        >
          <Button onClick={confirmStop} color="primary" variant="contained">
            Yes
          </Button>
          <Button onClick={discardStop}>No</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={showLeaveConfirm} onClose={() => setShowLeaveConfirm(false)} maxWidth="xs" fullWidth>
        <DialogContent>
          <Typography sx={{ pl: 1 }}>
            You have an active timer. Click <b>Yes</b> to save the time, or <b>No</b> to discard it.
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            display: 'flex',
            justifyContent: 'end',
            pr: 3,
          }}
        >
          <Button onClick={() => handleLeaveConfirmClose(true)} color="primary" variant="contained">
            Yes
          </Button>
          <Button onClick={() => handleLeaveConfirmClose(false)}>No</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TimerComponent;
