import { Box, Button, Grid, Paper, TextField, Stack, Typography, InputAdornment } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import { BoldedTitleText } from './BoldedTitleText';
import React, { useState } from 'react';
import { OrderableSampleDTO, SpecimenDateChangedParameters } from 'utils';
import { CalendarIcon } from '@mui/x-date-pickers/icons';
import { DateTime } from 'luxon';

interface SampleCollectionInstructionsCardProps {
  sample: OrderableSampleDTO;
  serviceRequestId: string;
  timezone?: string;
  onSpecimenDateChange: (parameters: SpecimenDateChangedParameters) => Promise<void>;
  setIsDataSaving: (isDataSaving: boolean) => void;

  // The date is edited from several fields; effectively it's a single ISO date, but the editing is presented as
  // multiple fields of date:hours:minutes. To avoid race conditions when saving the modified part of the date,
  // the fields are locked until the saving process is complete.
  isDataSaving: boolean;
}

export const SampleCollectionInstructionsCard: React.FC<SampleCollectionInstructionsCardProps> = ({
  sample,
  serviceRequestId,
  timezone,
  onSpecimenDateChange,
  setIsDataSaving,

  isDataSaving,
}) => {
  const { specimen, definition } = sample;
  const [collapsed, setCollapsed] = useState(false);

  const initialDateTime = specimen.collectionDate
    ? DateTime.fromISO(specimen.collectionDate, { zone: timezone })
    : DateTime.now().setZone(timezone);

  const [dateTime, setDateTime] = useState(initialDateTime);

  const dateValue = dateTime.toFormat('yyyy-MM-dd');
  const timeValue = dateTime.toFormat('HH:mm');

  const handleDateTimeChange = async ({ field, value }: { field: string; value: string }): Promise<void> => {
    const oldDateTime = dateTime;
    let newDateTime;

    if (field === 'collectionDate') {
      const [year, month, day] = value.split('-').map(Number);
      newDateTime = dateTime.set({ year, month, day });
    } else if (field === 'collectionTime') {
      const [hours, minutes] = value.split(':').map((v) => Number(v));
      newDateTime = dateTime.set({ hour: hours, minute: minutes });
    }

    if (!newDateTime?.isValid) {
      console.error('Invalid date');
      return;
    }

    setDateTime(newDateTime);

    setIsDataSaving(true);
    try {
      await onSpecimenDateChange({
        specimenId: specimen.id,
        serviceRequestId,
        date: newDateTime.toISO(),
      });
    } catch (error) {
      setDateTime(oldDateTime);
      console.error('Error updating specimen date', error);
    } finally {
      setIsDataSaving(false);
    }
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
                // See the description of isDataSaving in the SampleCollectionInstructionsCard interface.
                disabled={isDataSaving}
                fullWidth
                variant="outlined"
                type="date"
                value={dateValue}
                onChange={(e) => handleDateTimeChange({ field: 'collectionDate', value: e.target.value })}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <CalendarIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& input::-webkit-calendar-picker-indicator': {
                    position: 'absolute',
                    right: 0,
                    opacity: 0,
                    width: '100%',
                    height: '100%',
                    cursor: 'pointer',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                Collection time
              </Typography>
              <TextField
                // See the description of isDataSaving in the SampleCollectionInstructionsCard interface.
                disabled={isDataSaving}
                fullWidth
                variant="outlined"
                type="time"
                value={timeValue}
                onChange={(e) => handleDateTimeChange({ field: 'collectionTime', value: e.target.value })}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <ArrowDropDownIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& input::-webkit-calendar-picker-indicator': {
                    position: 'absolute',
                    right: 0,
                    opacity: 0,
                    width: '100%',
                    height: '100%',
                    cursor: 'pointer',
                  },
                }}
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
