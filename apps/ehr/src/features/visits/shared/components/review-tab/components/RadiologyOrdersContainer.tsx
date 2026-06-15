import { Box, Divider, Typography } from '@mui/material';
import { FC } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { RadiologyViewImageBtn } from 'src/features/radiology/components/RadiologyViewImageBtn';
import { RadiologyDTO } from 'utils';
import { useChartFields } from '../../../hooks/useChartFields';

export const RadiologyOrdersContainer: FC = () => {
  const { data: chartFields } = useChartFields({
    requestedFields: { radiologyOrders: { _tag: 'radiology', _revinclude: 'DiagnosticReport:based-on' } },
  });
  const radiologyOrders = chartFields?.radiologyOrders ?? [];

  const { ordersWithReads, pendingPerformedOrders } = radiologyOrders.reduce(
    (acc: { ordersWithReads: RadiologyDTO[]; pendingPerformedOrders: RadiologyDTO[] }, order) => {
      if (order.preliminaryReport || order.finalReport) {
        acc.ordersWithReads.push(order);
      } else {
        acc.pendingPerformedOrders.push(order);
      }
      return acc;
    },
    { ordersWithReads: [], pendingPerformedOrders: [] }
  );

  const renderReport = (order: RadiologyDTO): JSX.Element => {
    const { preliminaryReport, finalReport } = order;

    let reportType = 'Preliminary Read';
    let report: string | undefined;

    if (finalReport) {
      reportType = 'Final Read';
      report = atob(finalReport);
    } else if (preliminaryReport) {
      report = atob(preliminaryReport);
    }

    return (
      <Typography display="flex">
        <span style={{ fontWeight: 'bold' }}>{reportType}:&nbsp;</span>
        {report}
      </Typography>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Radiology
      </Typography>
      {ordersWithReads.map((order, idx) => (
        <Box key={`radiology-order-${order.serviceRequestId}`}>
          <Box display="flex" flexDirection="column" gap={0.5}>
            <AssessmentTitle>{order.cptCodeDisplay}</AssessmentTitle>
            <Typography>{order.diagnosis}</Typography>
            <Typography>
              <span style={{ fontWeight: 'bold' }}>Clinical History: </span>
              {order.clinicalHistory}
            </Typography>
            {renderReport(order)}
          </Box>
          <Box width="30%">
            <RadiologyViewImageBtn serviceRequestId={order.serviceRequestId} disabled={false} displaySmall={true} />
          </Box>
          {idx + 1 < ordersWithReads.length && <Divider />}
        </Box>
      ))}
      {pendingPerformedOrders.length > 0 && (
        <Typography variant="subtitle2" style={{ fontSize: '14px' }} sx={{ mt: 1 }}>
          Radiology Results Pending
        </Typography>
      )}
    </Box>
  );
};
