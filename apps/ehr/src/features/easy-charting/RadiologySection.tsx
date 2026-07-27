// Radiology in the easy-chart note. Mirrors Review & Sign's RadiologyOrdersContainer in the
// easy-chart's compact visual language: CPT display + diagnosis + clinical history per order,
// the base64-decoded preliminary/final read HTML, the View Image launcher, and a
// "Radiology Results Pending" line for orders with no read yet. Data comes from
// chartData.radiologyOrders (fetched via progressNoteChartDataRequestedFields).
import { Box, Stack, Typography } from '@mui/material';
import { RadiologyViewImageBtn } from 'src/features/radiology/components/RadiologyViewImageBtn';
import { RadiologyDTO } from 'utils';
import { Section } from './note-ui';

// Reads arrive base64-encoded HTML — decode like Review & Sign, falling back to the raw string.
const decode = (value: string): string => {
  try {
    return atob(value);
  } catch {
    return value;
  }
};

export function RadiologySection({ radiologyOrders }: { radiologyOrders: RadiologyDTO[] }): JSX.Element {
  const ordersWithReads = radiologyOrders.filter((o) => o.preliminaryReport || o.finalReport);
  const pendingOrders = radiologyOrders.filter((o) => !o.preliminaryReport && !o.finalReport);
  return (
    <Section title="Radiology">
      <Stack spacing={1}>
        {ordersWithReads.map((order) => {
          // Final read wins over preliminary, like Review & Sign.
          const report = order.finalReport ?? order.preliminaryReport;
          const reportType = order.finalReport ? 'Final Read' : 'Preliminary Read';
          return (
            <Box key={order.serviceRequestId}>
              <Typography variant="body2" fontWeight={600}>
                {order.cptCodeDisplay}
              </Typography>
              <Typography variant="body2">{order.diagnosis}</Typography>
              {order.clinicalHistory && (
                <Typography variant="body2">
                  <strong>Clinical History:</strong> {order.clinicalHistory}
                </Typography>
              )}
              {report && (
                <Typography variant="body2" component="div">
                  <strong>{reportType}:</strong>{' '}
                  {/* Read reports are provider-authored HTML from the radiology service — rendered
                      inline exactly like Review & Sign's RadiologyOrdersContainer. */}
                  <Box component="span" dangerouslySetInnerHTML={{ __html: decode(report) }} />
                </Typography>
              )}
              <RadiologyViewImageBtn serviceRequestId={order.serviceRequestId} disabled={false} displaySmall={true} />
            </Box>
          );
        })}
        {pendingOrders.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            Radiology Results Pending
          </Typography>
        )}
      </Stack>
    </Section>
  );
}
