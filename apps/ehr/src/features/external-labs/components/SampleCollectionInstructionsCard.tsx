import { Box, Button, Grid, Paper, TextField, Stack, Typography, InputAdornment } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import { BoldedTitleText } from './BoldedTitleText';
import React, { useState } from 'react';
import { OrderableSampleDTO } from 'utils';
import { CalendarIcon } from '@mui/x-date-pickers/icons';

interface InstructionProps {
  sample: OrderableSampleDTO;
}

export const SampleCollectionInstructionsCard: React.FC<InstructionProps> = ({ sample }) => {
  const { specimen, definition } = sample;
  const [collapsed, setCollapsed] = useState(false);
  const [isoDateTime, setIsoDateTime] = useState(specimen.collectionDate);

  const dateValue = isoDateTime.split('T')[0];
  const timeValue = isoDateTime.split('T')[1].substring(0, 5);

  const handleDateTimeChange = (field: string, value: string): void => {
    if (field === 'collectionDate') {
      setIsoDateTime(`${value}T${timeValue}`);
    } else if (field === 'collectionTime') {
      setIsoDateTime(`${dateValue}T${value}`);
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
                fullWidth
                variant="outlined"
                type="date"
                value={dateValue}
                onChange={(e) => handleDateTimeChange('collectionDate', e.target.value)}
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
                fullWidth
                variant="outlined"
                type="time"
                value={timeValue}
                onChange={(e) => handleDateTimeChange('collectionTime', e.target.value)}
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
