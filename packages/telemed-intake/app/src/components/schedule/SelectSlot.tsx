import { Button, Grid, styled, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { useContext } from 'react';
import { useSlotsStore } from '../../features/appointments';
import React from 'react';

const AppointmentSlotButton = styled(Button)({
  borderRadius: '8px',
});

interface SelectSlotProps {
  slots: string[];
  timezone: string;
  currentTab?: number;
}

export function SelectSlot({ slots, timezone }: SelectSlotProps): JSX.Element {
  const { selectedSlot, setSlotAndVisitType } = useSlotsStore((state) => state);
  const theme = useTheme();

  if (slots.length === 0) {
    return (
      <Typography variant="body2" sx={{ marginTop: 1, textAlign: 'center' }}>
        There are no slots available
      </Typography>
    );
  }

  return (
    <Grid container spacing={1} justifyContent={'center'} mt={1}>
      {slots.map((slot, idx) => {
        const startDate = DateTime.fromISO(slot);
        const startDateTimezoneAdjusted = startDate.setZone(timezone);
        const isSelected = selectedSlot === slot;
        return (
          <Grid key={idx} item>
            <AppointmentSlotButton
              sx={{ width: '110px', borderColor: theme.palette.divider, fontWeight: isSelected ? 700 : 400 }}
              variant={isSelected ? 'contained' : 'outlined'}
              color="primary"
              onClick={() => setSlotAndVisitType({ selectedSlot: slot })}
            >
              {startDateTimezoneAdjusted.toFormat('h:mm a')}
            </AppointmentSlotButton>
          </Grid>
        );
      })}
    </Grid>
  );
}
