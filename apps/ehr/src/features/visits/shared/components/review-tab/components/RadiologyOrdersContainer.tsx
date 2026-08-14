import { Box, Divider, Typography } from '@mui/material';
import { FC } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { RadiologyViewImageBtn } from 'src/features/radiology/components/RadiologyViewImageBtn';
import { decodeRadiologyReport } from 'utils/lib/fhir/radiology';
import { RadiologyDTO } from 'utils/lib/types/api/radiology';

interface RadiologyOrdersContainerProps {
  radiologyOrders: RadiologyDTO[];
}

export const RadiologyOrdersContainer: FC<RadiologyOrdersContainerProps> = (props) => {
  const { radiologyOrders } = props;
  const { ordersWithReads, pendingPerformedOrders } = radiologyOrders.reduce(
    (acc: { ordersWithReads: RadiologyDTO[]; pendingPerformedOrders: RadiologyDTO[] }, order) => {
      // External orders never produce reads; they're resulted once their upload sets externalResultReviewed.
      const hasReads = Boolean(order.preliminaryReport || order.finalReport);
      const externalResulted = Boolean(order.external && order.externalResultReviewed);
      if (hasReads || externalResulted) {
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
      report = decodeRadiologyReport(finalReport);
    } else if (preliminaryReport) {
      report = decodeRadiologyReport(preliminaryReport);
    }

    return (
      <Box>
        <span style={{ fontWeight: 'bold' }}>{reportType}: </span>
        <span style={{ whiteSpace: 'pre-wrap' }}>{report}</span>
      </Box>
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
            <AssessmentTitle>{order.studyType}</AssessmentTitle>
            <Typography>{order.diagnosis}</Typography>
            <Typography>
              <span style={{ fontWeight: 'bold' }}>Clinical History: </span>
              {order.clinicalHistory}
            </Typography>
            {order.performedBy && (
              <Typography>
                <span style={{ fontWeight: 'bold' }}>Performed by: </span>
                {order.performedBy.name}
              </Typography>
            )}
            {/* External orders have no read to render — the study heading above is the result. */}
            {!order.external && renderReport(order)}
          </Box>
          {/* AdvaPACS viewer doesn't apply to external orders. */}
          {!order.external && (
            <Box width="30%">
              <RadiologyViewImageBtn serviceRequestId={order.serviceRequestId} disabled={false} displaySmall={true} />
            </Box>
          )}
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
