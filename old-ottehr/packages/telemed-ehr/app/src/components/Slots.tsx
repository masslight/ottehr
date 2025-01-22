import { Button, Grid, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';

interface SlotsProps {
  slots: string[];
  timezone: string;
  selectedSlot: string | undefined;
  setSelectedSlot: (slot: string | undefined) => void;
}

export function Slots({ slots, timezone, selectedSlot, setSelectedSlot }: SlotsProps): JSX.Element {
  const theme = useTheme();

  if (slots.length === 0) {
    return (
      <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
        There are no slots available, please walk-in.
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
          <Grid key={idx} item sx={{ textAlign: 'center' }}>
            <Button
              sx={{
                width: '110px',
                borderColor: theme.palette.divider,
                fontWeight: isSelected ? 700 : 400,
                '&:hover': {
                  backgroundColor: isSelected ? theme.palette.primary.main : undefined,
                  borderColor: theme.palette.divider,
                },
                color: isSelected ? theme.palette.primary.contrastText : theme.palette.primary.dark,
              }}
              variant={isSelected ? 'contained' : 'outlined'}
              onClick={() => setSelectedSlot(slot)}
            >
              {startDateTimezoneAdjusted.toFormat('h:mm a')}
            </Button>
          </Grid>
        );
      })}
    </Grid>
  );
}
