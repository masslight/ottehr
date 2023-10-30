import { Button, Grid, Typography, styled, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { DataContext, updateAppointmentSlot } from '../store';

const AppointmentSlotButton = styled(Button)({
  borderRadius: '8px',
});

interface SelectSlotProps {
  reschedule?: boolean;
  slots: string[];
  timezone: string;
}

export function SelectSlot({ slots, timezone }: SelectSlotProps): JSX.Element {
  const { state, dispatch } = useContext(DataContext);
  const theme = useTheme();
  const { t } = useTranslation();

  const selectedSlot = state.appointmentSlot;

  if (slots.length === 0) {
    return (
      <Typography sx={{ mt: 1, textAlign: 'center' }} variant="body2">
        {t('schedule.errors.noneToday')}
      </Typography>
    );
  }

  return (
    <Grid container justifyContent={'center'} mt={1} spacing={1}>
      {slots.map((slot, idx) => {
        const startDate = DateTime.fromISO(slot);
        const startDateTimezoneAdjusted = startDate.setZone(timezone);
        const isSelected = selectedSlot === slot;
        return (
          <Grid key={idx} item>
            <AppointmentSlotButton
              color="secondary"
              onClick={() => updateAppointmentSlot(slot, dispatch)}
              sx={{ borderColor: theme.palette.divider, fontWeight: isSelected ? 700 : 400, width: '110px' }}
              variant={isSelected ? 'contained' : 'outlined'}
            >
              {startDateTimezoneAdjusted.toFormat('h:mm a')}
            </AppointmentSlotButton>
          </Grid>
        );
      })}
    </Grid>
  );
}
