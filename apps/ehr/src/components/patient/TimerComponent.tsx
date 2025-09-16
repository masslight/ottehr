import { Pause, PlayArrow, Stop } from '@mui/icons-material';
import { Alert, AlertColor, Box, IconButton, Paper, Skeleton, Snackbar, Tooltip, Typography } from '@mui/material';
import moment from 'moment';
import React, { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { useParams } from 'react-router-dom';
import { getCreateTimer, updateTimer } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { LogTimerModal } from './LogTimerModal';
import { useBlocker } from './useBlocker';

export const TimerComponent: React.FC = () => {
  const [time, setTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const { oystehrZambda } = useApiClients();
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastSeverity, setToastSeverity] = useState<AlertColor>('error');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [_currentEncounter, setCurrentEncounter] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const nextLocationRef = useRef<any>(null);
  const [modalConfig, setModalConfig] = useState<{
    type: 'stop' | 'leave';
    message: ReactElement;
    onConfirm: (data: any) => void;
    onCancel: () => void;
  } | null>(null);
  const { id: patientId } = useParams<{ id: string }>();

  const payload = {
    patientId: patientId ? patientId : undefined,
  };

  const updateTimerMutation = useMutation(
    (params: {
      updateType: 'pause' | 'resume' | 'stop' | 'discard';
      serviceType?: string;
      interactiveCommunication?: boolean;
      notes?: string;
      currentTime?: string | null;
      secondsElapsed?: string | null;
    }) => {
      if (!oystehrZambda) throw new Error('No zambda client');
      return updateTimer(
        {
          patientId,
          updateType: params.updateType,
          serviceType: params.serviceType,
          interactiveCommunication: params.interactiveCommunication,
          notes: params.notes,
          currentTime: params.currentTime,
          secondsElapsed: time,
        },
        oystehrZambda
      );
    },
    {
      onSuccess: (response) => {
        showToast(`${response.message}`, 'success');
      },
      onError: (error: any) => {
        const message = error?.output?.error || 'Failed to update timer';
        showToast(message, 'error');
      },
    }
  );

  const isEncounterPaused = (encounter: any): boolean => {
    if (!encounter?.statusHistory || !Array.isArray(encounter.statusHistory)) {
      return false;
    }

    const sortedHistory = [...encounter.statusHistory].sort(
      (a, b) => new Date(a.period.start).getTime() - new Date(b.period.start).getTime()
    );

    const lastStatus = sortedHistory[sortedHistory.length - 1];

    return lastStatus?.status === 'onleave';
  };

  const { isLoading, refetch } = useQuery(
    ['get-create-timer', patientId, { oystehrZambda }],
    () => (oystehrZambda ? getCreateTimer(payload, oystehrZambda) : null),
    {
      onSuccess: (response: any) => {
        if (response && response.encounterResults) {
          const encounter = Array.isArray(response.encounterResults)
            ? response.encounterResults[0]
            : response.encounterResults;

          if (encounter) {
            setCurrentEncounter(encounter);
            const totalTime = extractTotalTimeFromResponse(encounter);
            const isPausedFromHistory = isEncounterPaused(encounter);

            setTime(totalTime);
            if (encounter.status === 'in-progress') {
              setIsPaused(isPausedFromHistory);
            }

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

  const extractTotalTimeFromResponse = (data: any): number => {
    try {
      const totalTimeIdentifier = data?.identifier?.find((id: any) => id.system === 'total-time');

      if (totalTimeIdentifier) {
        return parseInt(totalTimeIdentifier.value, 10) || 0;
      }

      if (data?.statusHistory && Array.isArray(data.statusHistory)) {
        let totalSeconds = 0;
        let lastStartTime: Date | null = null;

        const sortedHistory = [...data.statusHistory].sort(
          (a, b) => new Date(a.period.start).getTime() - new Date(b.period.start).getTime()
        );

        for (const statusEvent of sortedHistory) {
          if (statusEvent.status === 'in-progress' && !lastStartTime) {
            lastStartTime = new Date(statusEvent.period.start);
          } else if ((statusEvent.status === 'onleave' || statusEvent.status === 'finished') && lastStartTime) {
            const endTime = new Date(statusEvent.period.start);
            totalSeconds += Math.floor((endTime.getTime() - lastStartTime.getTime()) / 1000);
            lastStartTime = null;
          }
        }

        if (lastStartTime && data.status === 'in-progress') {
          totalSeconds += Math.floor((Date.now() - lastStartTime.getTime()) / 1000);
        }

        return Math.max(0, totalSeconds);
      }

      if (data?.period?.start) {
        const startTime = new Date(data.period.start).getTime();
        if (data.status === 'onhold' || data.status === 'finished') {
          const endTime = data.period.end ? new Date(data.period.end).getTime() : startTime;
          return Math.floor((endTime - startTime) / 1000);
        } else {
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

  const handleCloseToast = useCallback(() => {
    setToastOpen(false);
  }, []);

  const showToast = useCallback((message: string, severity: AlertColor = 'info') => {
    setToastMessage(message);
    setToastSeverity(severity);
    setToastOpen(true);
  }, []);

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

  const formatTime = useCallback((totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds].map((v) => v.toString().padStart(2, '0')).join(':');
  }, []);

  useBlocker((tx: any): void => {
    if (isRunning || time > 0) {
      showLeaveConfirmModal(tx);
    } else {
      tx.retry();
    }
  }, true);

  const handleLeaveClose = (): void => {
    const currentNextLocation = nextLocationRef.current;
    if (!currentNextLocation) return;
    setIsSubmitting(true);
    setIsRunning(false);
    setIsPaused(false);
    localStorage.removeItem('timerState');
    setCurrentEncounter(null);
    setTime(0);
    setShowConfirmModal(false);
    updateTimerMutation.mutate(
      {
        updateType: 'discard',
        serviceType: '-',
        interactiveCommunication: false,
        notes: '-',
        currentTime: moment().toISOString(),
      },
      {
        onSuccess: () => {
          setIsSubmitting(false);
          setShowConfirmModal(false);
          setTimeout(() => {
            currentNextLocation.retry();
          }, 2000);
        },
        onError: () => {
          setIsSubmitting(false);
        },
      }
    );
  };

  const handleConfirmLeave = (formData?: {
    serviceType: string;
    interactiveCommunication: boolean;
    notes: string;
  }): void => {
    const currentNextLocation = nextLocationRef.current;
    if (!currentNextLocation) return;
    setIsSubmitting(true);
    setIsRunning(false);
    setIsPaused(false);
    localStorage.removeItem('timerState');
    setCurrentEncounter(null);
    setTime(0);
    setShowConfirmModal(false);
    updateTimerMutation.mutate(
      {
        updateType: 'stop',
        serviceType: formData?.serviceType,
        interactiveCommunication: formData?.interactiveCommunication,
        notes: formData?.notes,
        currentTime: moment().toISOString(),
      },
      {
        onSuccess: () => {
          setIsSubmitting(false);
          setShowConfirmModal(false);
          setTimeout(() => {
            currentNextLocation.retry();
          }, 2000);
        },
        onError: () => {
          setIsSubmitting(false);
        },
      }
    );
  };

  const handlePauseResume = (): void => {
    if (isPaused) {
      setIsPaused(false);
      updateTimerMutation.mutate({
        updateType: 'resume',
        serviceType: '-',
        interactiveCommunication: false,
        notes: '-',
        currentTime: moment().toISOString(),
      });
    } else {
      setIsPaused(true);
      updateTimerMutation.mutate({
        updateType: 'pause',
        serviceType: '-',
        interactiveCommunication: false,
        notes: '-',
        currentTime: moment().toISOString(),
      });
    }
  };

  const handleStart = async (): Promise<any> => {
    setIsPaused(false);
    setTime(0);
    setCurrentEncounter(null);
    await refetch();
    setIsRunning(true);
  };

  const handleStop = (): void => {
    setModalConfig({
      type: 'stop',
      message: (
        <>
          Do you want to log the tracked time for this patient?
          <br />
          Click <b>Yes</b> to save the time, or <b>No</b> to discard it.
        </>
      ),
      onConfirm: (data) => confirmStop(data),
      onCancel: cancelStop,
    });
    setShowConfirmModal(true);
  };

  const confirmStop = (formData: { serviceType: string; interactiveCommunication: boolean; notes: string }): void => {
    setIsRunning(false);
    setIsPaused(false);
    setTime(0);
    setShowConfirmModal(false);
    localStorage.removeItem('timerState');
    setCurrentEncounter(null);
    updateTimerMutation.mutate({
      updateType: 'stop',
      serviceType: formData.serviceType,
      interactiveCommunication: formData.interactiveCommunication,
      notes: formData.notes,
      currentTime: moment().toISOString(),
    });
  };

  const showLeaveConfirmModal = (tx: any): void => {
    nextLocationRef.current = tx;
    setModalConfig({
      type: 'leave',
      message: (
        <>
          You have an active timer. Click <b>Yes</b> to save the time, or <b>No</b> to discard it.
        </>
      ),
      onConfirm: (data) => handleConfirmLeave(data),
      onCancel: handleLeaveClose,
    });
    setShowConfirmModal(true);
  };

  const cancelStop = (): void => {
    setIsRunning(false);
    setIsPaused(false);
    setTime(0);
    setShowConfirmModal(false);
    localStorage.removeItem('timerState');
    setCurrentEncounter(null);
    updateTimerMutation.mutate({
      updateType: 'discard',
      serviceType: '-',
      interactiveCommunication: false,
      notes: '-',
      currentTime: moment().toISOString(),
    });
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
                <IconButton
                  color="primary"
                  size="large"
                  sx={{ border: '1px solid', padding: '6px' }}
                  onClick={handlePauseResume}
                >
                  {isPaused ? <PlayArrow /> : <Pause />}
                </IconButton>
              </Tooltip>

              <Tooltip title="Stop timer">
                <IconButton
                  sx={{ border: '1px solid', padding: '6px' }}
                  color="error"
                  size="large"
                  onClick={handleStop}
                >
                  <Stop />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>
      {modalConfig && (
        <LogTimerModal
          open={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={modalConfig.onConfirm}
          onCancel={modalConfig.onCancel}
          message={modalConfig.message}
          confirmColor={'primary'}
          isSubmitting={isSubmitting}
        />
      )}
      <Snackbar
        open={toastOpen}
        autoHideDuration={6000}
        sx={{ mt: 5 }}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseToast} severity={toastSeverity} sx={{ width: '100%' }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default TimerComponent;
