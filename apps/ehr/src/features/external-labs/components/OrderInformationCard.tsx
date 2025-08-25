import { Button, Grid } from '@mui/material';
import React from 'react';
import { openPdf } from 'utils';
interface OrderInfoProps {
  labelPdfUrl: string | undefined;
  orderPdfUrl: string | undefined;
}

export const OrderInformationCard: React.FC<OrderInfoProps> = ({ labelPdfUrl, orderPdfUrl }) => {
  return (
    <Grid container direction="row" spacing={1} sx={{ my: 2 }}>
      {labelPdfUrl && (
        <Grid item>
          <Button
            variant="outlined"
            type="button"
            sx={{ width: 170, borderRadius: '50px', textTransform: 'none' }}
            onClick={() => openPdf(labelPdfUrl)}
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
