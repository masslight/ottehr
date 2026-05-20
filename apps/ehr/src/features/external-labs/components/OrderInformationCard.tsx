import { Button, Grid } from '@mui/material';
import { DateTime } from 'luxon';
import React from 'react';
import { usePrintExternalLabLabel } from 'src/features/visits/shared/hooks/usePrintExternalLabLabel';
import { openPdf } from 'utils';
interface OrderInfoProps {
  serviceRequestId: string;
  labelPdfUrl: string | undefined;
  orderPdfUrl: string | undefined;
}

export const OrderInformationCard: React.FC<OrderInfoProps> = ({ serviceRequestId, labelPdfUrl, orderPdfUrl }) => {
  const { printExternalLabLabel } = usePrintExternalLabLabel();

  return (
    <Grid container direction="row" spacing={1} sx={{ my: 2 }}>
      {labelPdfUrl && (
        <Grid item>
          <Button
            variant="outlined"
            type="button"
            sx={{ width: 170, borderRadius: '50px', textTransform: 'none' }}
            onClick={async () => {
              // this falls back to manual printing if there is an error
              await printExternalLabLabel({
                serviceRequestId,
                pdfPresignedUrl: labelPdfUrl,
                userTimezone: DateTime.local().zoneName,
              });
            }}
          >
            Re-print Label
          </Button>
        </Grid>
      )}
      {orderPdfUrl && (
        <Grid item>
          <Button
            variant="outlined"
            type="button"
            sx={{ width: 170, borderRadius: '50px', textTransform: 'none' }}
            onClick={() => openPdf(orderPdfUrl)}
          >
            Re-print Order
          </Button>
        </Grid>
      )}
    </Grid>
  );
};
