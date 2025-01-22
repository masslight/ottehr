import { Button, Grid, styled, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';

const AppointmentSlotButton = styled(Button)({
  borderRadius: '8px',
});

interface SelectSlotProps {
  slots: string[];
  timezone: string;
  reschedule?: boolean;
  currentTab?: number;
  currentSelectedSlot: string | undefined;
  handleSlotSelected: (slot: string) => void;
  noSlotsMessage?: string;
}

export function SelectSlot({
  slots,
  timezone,
  currentSelectedSlot,
  handleSlotSelected,
  noSlotsMessage,
}: SelectSlotProps): JSX.Element {
  const theme = useTheme();

  if (slots.length === 0) {
    return (
      <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
        {noSlotsMessage}
      </Typography>
    );
  }

  return (
    <Grid container spacing={1} justifyContent={'center'} mt={1}>
      {slots.map((slot, idx) => {
        const startDate = DateTime.fromISO(slot);
        const startDateTimezoneAdjusted = startDate.setZone(timezone);
        const isSelected = currentSelectedSlot === slot;
        return (
          <Grid key={idx} item>
            <AppointmentSlotButton
              sx={{ width: '110px', borderColor: theme.palette.divider, fontWeight: isSelected ? 700 : 400 }}
              variant={isSelected ? 'contained' : 'outlined'}
              color="secondary"
              onClick={() => handleSlotSelected(slot)}
              className="time-button"
            >
              {startDateTimezoneAdjusted.toFormat('h:mm a')}
            </AppointmentSlotButton>
          </Grid>
        );
      })}
    </Grid>
  );
}
