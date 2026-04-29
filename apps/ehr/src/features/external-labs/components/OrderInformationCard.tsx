import { Button, Grid } from '@mui/material';
import React from 'react';
import { usePrintLabel } from 'src/features/visits/shared/hooks/usePrintLabel';
import { openPdf } from 'utils';
interface OrderInfoProps {
  labelPdfUrl: string | undefined;
  labelXmlUrl: string | undefined;
  orderPdfUrl: string | undefined;
}

export const OrderInformationCard: React.FC<OrderInfoProps> = ({ labelPdfUrl, labelXmlUrl, orderPdfUrl }) => {
  const { printLabel } = usePrintLabel();

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
              await printLabel({
                pdfPresignedUrl: labelPdfUrl ?? '',
                xmlPresignedUrl: labelXmlUrl ?? '',
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
