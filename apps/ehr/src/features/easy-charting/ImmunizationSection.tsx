// Immunizations administered this encounter, mirroring Review & Sign's ImmunizationContainer:
// vaccine - dose units / route - location, with the administered date/time underneath. The orders
// come from a separate get-immunization-orders query (wired in EasyChartPage — NOT part of the
// chart-data fetch), already filtered to administered/administered-partly like Review & Sign.
// Deliberate deviation from R&S's 'HH:mm a' (24-hour clock plus a meridiem, e.g. "14:30 PM"):
// we render 'h:mm a'. Times format in the browser's local timezone (DateTime.fromISO default).
import { Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { searchRouteByCode } from 'utils/lib/fhir/medication-administration';
import { ImmunizationOrder } from 'utils/lib/types/data/immunization/types';
import { Section } from './note-ui';

export function ImmunizationSection({ orders }: { orders: ImmunizationOrder[] }): JSX.Element {
  return (
    <Section title="Immunization">
      <Stack spacing={0.5}>
        {orders.map((order) => {
          const administered = order.administrationDetails?.administeredDateTime
            ? DateTime.fromISO(order.administrationDetails.administeredDateTime).toFormat('MM/dd/yyyy h:mm a')
            : undefined;
          return (
            <Stack key={order.id}>
              <Typography variant="body2" fontWeight={500}>
                {`${order.details.medication.name} - ${order.details.dose} ${order.details.units} / ${
                  searchRouteByCode(order.details.route)?.display ?? ''
                } - ${order.details.location?.name ?? ''}`}
              </Typography>
              {administered && (
                <Typography variant="caption" color="text.secondary">
                  {administered}
                </Typography>
              )}
            </Stack>
          );
        })}
      </Stack>
    </Section>
  );
}
