import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Checkbox, darken, FormControlLabel, Typography } from '@mui/material';
import { DateTime, Duration } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, useEffect, useState } from 'react';
import { getSelectors } from '../../../shared/store/getSelectors';
import { InnerStatePopover } from '../../components';
import { useAppointmentStore, useSaveChartData } from '../../state';
import { formatVideoTimerTime } from '../../utils';

export const VideoTimer: FC = () => {
  const { encounter } = getSelectors(useAppointmentStore, ['encounter']);
  const [difference, setDifference] = useState<Duration>();
  const { chartData, setPartialChartData } = getSelectors(useAppointmentStore, ['chartData', 'setPartialChartData']);
  const { mutate, isPending: isLoading } = useSaveChartData();

  const addToVisitNote = chartData?.addToVisitNote?.value || false;

  const onChange = (value: boolean): void => {
    setPartialChartData({ addToVisitNote: { value } });
    mutate(
      { addToVisitNote: { value } },
      {
        onSuccess: (data) => {
          const addToVisitNoteUpdated = data.chartData.addToVisitNote;
          if (addToVisitNoteUpdated) {
            setPartialChartData({ addToVisitNote: addToVisitNoteUpdated });
          }
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while adding to visit note. Please try again.', {
            variant: 'error',
          });
          setPartialChartData({ addToVisitNote: chartData?.addToVisitNote });
        },
      }
    );
  };

  useEffect(() => {
    const startTime = encounter.statusHistory?.find((item) => item.status === 'in-progress')?.period.start;
    if (!startTime) {
      return;
    }

    const interval = setInterval(() => setDifference(DateTime.fromISO(startTime).diffNow(['minute', 'second'])), 100);

    return () => {
      clearInterval(interval);
    };
  }, [encounter.statusHistory]);

  if (!difference) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography fontWeight={500} sx={{ width: '45px' }}>
        {formatVideoTimerTime(difference)}
      </Typography>

      <FormControlLabel
        sx={{
          mr: 0,
        }}
        control={
          <Checkbox
            sx={{
              color: '#C79DFF',
              '&.Mui-checked': {
                color: '#C79DFF',
              },
              '&.Mui-disabled': {
                color: darken('#C79DFF', 0.4),
              },
            }}
            disabled={isLoading}
            checked={addToVisitNote}
            onChange={(e) => onChange(e.target.checked)}
          />
        }
        label={<Typography sx={{ color: isLoading ? darken('#FFF', 0.4) : '#FFF' }}>Add to visit note</Typography>}
      />

      <InnerStatePopover
        popoverChildren={
          <Typography sx={{ p: 2, maxWidth: '320px' }}>
            By checking this box you add time spent in visit statement to the progress note.
          </Typography>
        }
      >
        {({ handlePopoverOpen, handlePopoverClose }) => (
          <InfoOutlinedIcon fontSize="small" onMouseEnter={handlePopoverOpen} onMouseLeave={handlePopoverClose} />
        )}
      </InnerStatePopover>
    </Box>
  );
};
