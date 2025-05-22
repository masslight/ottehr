import React from 'react';
import { Box, Typography, Collapse, Stack } from '@mui/material';
import { InHouseLabDTO } from 'utils';
import { InHouseLabsStatusChip } from '../InHouseLabsStatusChip';
import { DateTime } from 'luxon';

interface InHouseLabOrderHistoryProps {
  showDetails: boolean;
  testDetails: InHouseLabDTO;
}

export const InHouseLabOrderHistory: React.FC<InHouseLabOrderHistoryProps> = ({ showDetails, testDetails }) => {
  return (
    <Collapse in={showDetails}>
      <Box
        sx={{
          mt: 2,
          p: 2,
          backgroundColor: '#F8F9FA',
          borderRadius: '8px',
        }}
      >
        {testDetails.orderHistory.map(({ date, providerName, status }) => (
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
              <InHouseLabsStatusChip status={status} />
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
              {providerName}
            </Typography>
            <Typography variant="body2">
              {DateTime.fromISO(date).setZone(testDetails.timezone).toFormat('MM/dd/yyyy HH:mm')}
            </Typography>
          </Stack>
        ))}
      </Box>
    </Collapse>
  );
};
