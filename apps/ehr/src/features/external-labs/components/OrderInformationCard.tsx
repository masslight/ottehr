import { Box, Button, Paper, Stack } from '@mui/material';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import React, { useState } from 'react';
import { openPdf } from './OrderCollection';
interface OrderInfoProps {
  orderPdfUrl: string | undefined;
}

export const OrderInformationCard: React.FC<OrderInfoProps> = ({ orderPdfUrl }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Box sx={{ mt: 2, mb: 2 }}>
      <AccordionCard
        label={'Order information'}
        collapsed={collapsed}
        withBorder={false}
        onSwitch={() => {
          setCollapsed((prevState) => !prevState);
        }}
      >
        <Paper sx={{ p: 3 }}>
          <Stack spacing={1} sx={{ justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              type="button"
              sx={{ width: 170, borderRadius: '50px', textTransform: 'none' }}
              disabled={!orderPdfUrl}
              onClick={() => orderPdfUrl && openPdf(orderPdfUrl)}
            >
              Print order
            </Button>
          </Stack>
        </Paper>
      </AccordionCard>
    </Box>
  );
};
