import { Box, Button, CircularProgress, Grid, Typography, useTheme } from '@mui/material';
import { Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { dataTestIds } from '../constants/data-test-ids';

interface SlotsProps {
  slots: Slot[];
  timezone: string;
  selectedSlot: Slot | undefined;
  setSelectedSlot: (slot: Slot | undefined) => void;
  loading?: boolean;
}

export function SlotsLoader(): JSX.Element {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mt: 1 }}>
      <CircularProgress size={20} />
      <Typography variant="body2">Loading slots...</Typography>
    </Box>
  );
}

export function Slots({ slots, timezone, selectedSlot, setSelectedSlot, loading }: SlotsProps): JSX.Element {
  const theme = useTheme();

  if (loading) {
    return <SlotsLoader />;
  }

  if (slots.length === 0) {
    return (
      <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
        There are no slots available, please walk-in.
      </Typography>
    );
  }

  return (
    <Grid container spacing={1} justifyContent={'center'} mt={1}>
      {slots.map((slot) => {
        const startDate = DateTime.fromISO(slot.start);
        const startDateTimezoneAdjusted = startDate.setZone(timezone);
        const isSelected = selectedSlot === slot;
        const isPast = startDate < DateTime.now();
        return (
          <Grid key={slot.start} item>
            <Button
              sx={{
                width: '110px',
                borderColor: theme.palette.divider,
                fontWeight: isSelected ? 700 : 400,
                ...(isPast && !isSelected && { color: theme.palette.text.secondary }),
              }}
              variant={isSelected ? 'contained' : 'outlined'}
              color="primary"
              onClick={() => setSelectedSlot(slot)}
              data-testid={dataTestIds.slots.slot}
              // Exposes the slot's local date so e2e tests can match the tracking-board
              // date filter to it (the filter defaults to "today in the location TZ",
              // but the first available slot may land on tomorrow when the day's
              // schedule is past closing time).
              data-slot-date={startDateTimezoneAdjusted.toFormat('MM/dd/yyyy')}
            >
              {startDateTimezoneAdjusted.toFormat('h:mm a')}
            </Button>
          </Grid>
        );
      })}
    </Grid>
  );
}
