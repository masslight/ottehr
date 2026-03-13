import { Button, Grid, styled, Typography, useTheme } from '@mui/material';
import { Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';

const AppointmentSlotButton = styled(Button)({
  borderRadius: '8px',
});

interface SelectSlotProps {
  slots: Slot[];
  timezone: string;
  reschedule?: boolean;
  currentTab?: number;
  currentSelectedSlot: Slot | undefined;
  handleSlotSelected: (slot: Slot) => void;
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
        const startDate = DateTime.fromISO(slot.start);
        const startDateTimezoneAdjusted = startDate.setZone(timezone);
        // todo: extract this into a function that can be customized. the 1-slot-per-time rule
        // might not hold for every use case
        const isSelected = currentSelectedSlot?.start === slot.start;
        return (
          <Grid key={idx} item>
            <AppointmentSlotButton
              sx={{
                width: '110px',
                borderColor: theme.palette.divider,
                fontWeight: isSelected ? 700 : 400,
                bgcolor: isSelected ? theme.palette.primary.main : undefined,
                color: isSelected ? theme.palette.primary.contrastText : theme.palette.text.primary,
              }}
              variant={isSelected ? 'contained' : 'outlined'}
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
