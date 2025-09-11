import { Box, Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { ImmunizationOrder, searchMedicationLocation, searchRouteByCode } from 'utils';

export const ImmunizationContainer: FC<{
  orders: ImmunizationOrder[];
}> = ({ orders }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Immunization
      </Typography>
      {orders.map((order) => (
        <Stack key={order.id}>
          <Typography sx={{ fontWeight: '500' }}>{`${order.details.medication.name} - ${order.details.dose} ${
            order.details.units
          } / ${searchRouteByCode(order.details.route)?.display ?? ''} - ${
            searchMedicationLocation(order.details.location)?.display ?? ''
          }`}</Typography>
          <Typography>{formatDateTime(order.administrationDetails?.administeredDateTime)}</Typography>
        </Stack>
      ))}
    </Box>
  );
};

function formatDateTime(dateTime: string | undefined): string {
  if (!dateTime) {
    return '';
  }
  return DateTime.fromISO(dateTime)?.toFormat('MM/dd/yyyy HH:mm a');
}
