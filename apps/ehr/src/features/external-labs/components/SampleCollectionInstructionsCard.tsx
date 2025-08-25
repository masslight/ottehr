import { Grid, Paper, Stack, TextField, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import React, { useEffect, useState } from 'react';
import { sampleDTO } from 'utils';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import { BoldedTitleText } from './BoldedTitleText';

interface SampleCollectionInstructionsCardProps {
  sample: sampleDTO;
  timezone?: string;
  setSpecimenData: (specimenId: string, date: string) => void;
  isDateEditable: boolean;
}

export const SampleCollectionInstructionsCard: React.FC<SampleCollectionInstructionsCardProps> = ({
  sample,
  timezone,
  setSpecimenData,
  isDateEditable,
}) => {
  const { specimen, definition } = sample;
  const [collapsed, setCollapsed] = useState(false);

  const [date, setDate] = useState(() =>
    specimen.collectionDate
      ? DateTime.fromISO(specimen.collectionDate, { zone: timezone })
      : DateTime.now().setZone(timezone)
  );

  useEffect(() => {
    if (date.isValid) {
      setSpecimenData(specimen.id, date.toISO());
    }
  }, [date, setSpecimenData, specimen.id]);

  const handleDateChange = (field: 'collectionDate' | 'collectionTime', value: string): void => {
    setDate((prev) => {
      const parts = value.split(field === 'collectionDate' ? '-' : ':').map(Number);
      const updated =
        field === 'collectionDate'
          ? prev.set({ year: parts[0] || prev.year, month: parts[1] || prev.month, day: parts[2] || prev.day })
          : prev.set({ hour: parts[0] || prev.hour, minute: parts[1] || prev.minute });

      return updated.isValid ? updated : prev;
    });
  };

  return (
    <AccordionCard
      label="Sample Collection Instructions"
      collapsed={collapsed}
      withBorder={false}
      onSwitch={() => setCollapsed((prev) => !prev)}
    >
      <Paper sx={{ p: 3 }}>
        <Stack spacing={1}>
          <BoldedTitleText title="Container" description={definition.container} />
          <BoldedTitleText title="Volume" description={definition.volume} />
          <BoldedTitleText title="Minimum Volume" description={definition.minimumVolume} />
          <BoldedTitleText title="Storage Requirements" description={definition.storageRequirements} />
          <BoldedTitleText title="Collection Instructions" description={definition.collectionInstructions} />
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
              value={date.toFormat('yyyy-MM-dd')}
              onChange={(e) => handleDateChange('collectionDate', e.target.value)}
              disabled={!isDateEditable}
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
              value={date.toFormat('HH:mm')}
              onChange={(e) => handleDateChange('collectionTime', e.target.value)}
              disabled={!isDateEditable}
            />
          </Grid>
        </Grid>
      </Paper>
    </AccordionCard>
  );
};
