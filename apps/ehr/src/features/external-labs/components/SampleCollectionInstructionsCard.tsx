import React, { useState } from 'react';
import { DateTime } from 'luxon';
import { Box, Button, Grid, Paper, TextField, Stack, Typography } from '@mui/material';
import { sampleDTO, SpecimenDateChangedParameters } from 'utils';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import { BoldedTitleText } from './BoldedTitleText';
import { useDebounce } from 'src/telemed/hooks/useDebounce';
import { enqueueSnackbar } from 'notistack';

interface SampleCollectionInstructionsCardProps {
  sample: sampleDTO;
  serviceRequestId: string;
  timezone?: string;
  saveSpecimenDate: (parameters: SpecimenDateChangedParameters) => Promise<void>;
  updateSpecimenLoadingState?: (specimenId: string, state: 'saving' | 'saved') => void;
}

export const SampleCollectionInstructionsCard: React.FC<SampleCollectionInstructionsCardProps> = ({
  sample,
  serviceRequestId,
  timezone,
  saveSpecimenDate,
  updateSpecimenLoadingState,
}) => {
  const { specimen, definition } = sample;
  const [collapsed, setCollapsed] = useState(false);
  const { debounce } = useDebounce(1000);

  const initialDateTime = specimen.collectionDate
    ? DateTime.fromISO(specimen.collectionDate, { zone: timezone })
    : DateTime.now().setZone(timezone);

  const [date, setDate] = useState(initialDateTime);
  const dateValue = date.toFormat('yyyy-MM-dd');
  const timeValue = date.toFormat('HH:mm');

  const saveDateHandler = ({ field, value }: { field: 'collectionDate' | 'collectionTime'; value: string }): void => {
    setDate((prevDate) => {
      let newDate;

      if (field === 'collectionDate') {
        const [year, month, day] = value.split('-').map((v) => parseInt(v, 10));
        newDate = prevDate.set({ year, month, day });
      } else if (field === 'collectionTime') {
        const [hour, minute] = value.split(':').map((v) => parseInt(v, 10));
        newDate = prevDate.set({ hour, minute });
      }

      if (!newDate?.isValid) {
        console.error('Invalid new date');
        return prevDate;
      }

      if (newDate.toISO() === prevDate.toISO()) {
        return prevDate;
      }

      updateSpecimenLoadingState?.(specimen.id, 'saving');

      debounce(async () => {
        try {
          await saveSpecimenDate({
            specimenId: specimen.id,
            serviceRequestId,
            date: newDate,
          });
        } catch (error) {
          setDate(prevDate);
          enqueueSnackbar('Date was not saved. Please try again.', {
            variant: 'error',
          });
          console.error('Error updating specimen date', error);
        } finally {
          updateSpecimenLoadingState?.(specimen.id, 'saved');
        }
      });

      return newDate;
    });
  };

  return (
    <Box sx={{ marginTop: 2 }}>
      <AccordionCard
        label={'Sample Collection Instructions'}
        collapsed={collapsed}
        withBorder={false}
        onSwitch={() => {
          setCollapsed((prevState) => !prevState);
        }}
      >
        <Paper sx={{ p: 3 }}>
          <Stack spacing={1}>
            <BoldedTitleText title={'Container'} description={definition.container} />
            <BoldedTitleText title={'Volume'} description={definition.volume} />
            <BoldedTitleText title={'Minimum Volume'} description={definition.minimumVolume} />
            <BoldedTitleText title={'Storage Requirements'} description={definition.storageRequirements} />
            <BoldedTitleText title={'Collection Instructions'} description={definition.collectionInstructions} />
          </Stack>

          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                Collection date
              </Typography>
              <TextField
                fullWidth
                variant="outlined"
                type="date"
                value={dateValue}
                onChange={(e) => saveDateHandler({ field: 'collectionDate', value: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                Collection time
              </Typography>
              <TextField
                fullWidth
                variant="outlined"
                type="time"
                value={timeValue}
                onChange={(e) => saveDateHandler({ field: 'collectionTime', value: e.target.value })}
              />
            </Grid>
          </Grid>

          <Button
            variant="outlined"
            type="button"
            sx={{ width: 170, borderRadius: '50px', textTransform: 'none', mt: 3 }}
            onClick={() => {
              return;
            }}
          >
            Print label
          </Button>
        </Paper>
      </AccordionCard>
    </Box>
  );
};
