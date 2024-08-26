import { Button, Grid, styled, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { useTranslation } from 'react-i18next';
import { useAppointmentStore } from '../../features/appointments';

const AppointmentSlotButton = styled(Button)({
  borderRadius: '8px',
});

interface SelectSlotProps {
  slots: string[];
  timezone: string;
  currentTab?: number;
}

export function SelectSlot({ slots, timezone }: SelectSlotProps): JSX.Element {
  const { selectedSlot, setAppointment } = useAppointmentStore((state) => state);
  const theme = useTheme();
  const { t } = useTranslation();

  if (slots.length === 0) {
    return (
      <Typography variant="body2" sx={{ marginTop: 1, textAlign: 'center' }}>
        {t('schedule.noSlotsAvailableForOption')}
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
              onClick={() => setAppointment({ selectedSlot: slot })}
              color="primary"
            >
              {startDateTimezoneAdjusted.toFormat('h:mm a')}
            </AppointmentSlotButton>
          </Grid>
        );
      })}
    </Grid>
  );
}
