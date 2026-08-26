import { Box, Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  SectionHeading,
  useNoteSectionTitleInCardHeader,
} from 'src/features/visits/shared/components/NoteSectionHeading';
import { searchRouteByCode } from 'utils/lib/fhir/medication-administration';
import { ImmunizationOrder } from 'utils/lib/types/data/immunization/types';

export const ImmunizationContainer: FC<{
  orders: ImmunizationOrder[];
}> = ({ orders }) => {
  const titleInCardHeader = useNoteSectionTitleInCardHeader();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      {!titleInCardHeader && <SectionHeading>Immunization</SectionHeading>}
      {orders.map((order) => (
        <Stack key={order.id} data-testid={dataTestIds.progressNotePage.vaccineItem}>
          <Typography sx={{ fontWeight: '500' }}>{`${order.details.medication.name} - ${order.details.dose} ${
            order.details.units
          } / ${searchRouteByCode(order.details.route)?.display ?? ''} - ${
            order.details.location?.name ?? ''
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
