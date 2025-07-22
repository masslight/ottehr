import { Box, Divider, Paper, Typography } from '@mui/material';
import { ButtonRounded } from 'src/features/css-module/components/RoundedButton';
import { NursingOrder, NursingOrdersStatus } from 'utils';
import { NursingOrdersStatusChip } from '../NursingOrdersStatusChip';

interface CollectSampleViewProps {
  orderDetails: NursingOrder;
  onSubmit: (data: any) => void;
}

export const OrderDetails: React.FC<CollectSampleViewProps> = ({ orderDetails, onSubmit }) => {
  const handleMarkAsCollected = (): void => {
    onSubmit({
      status: NursingOrdersStatus.completed,
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" color="primary.dark" sx={{ fontWeight: 'bold' }}>
          Nursing Order
        </Typography>
        <NursingOrdersStatusChip status={orderDetails.status} />
      </Box>
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', p: 3, gap: 3 }}>
          <Typography variant="h6" fontWeight="bold" color="primary.dark">
            Order Note
          </Typography>
          <Box>
            <Typography style={{ whiteSpace: 'pre-line' }}>{orderDetails.note}</Typography>
          </Box>
        </Box>
        {orderDetails.status === NursingOrdersStatus.pending && (
          <>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 3 }}>
              <ButtonRounded
                variant="contained"
                color="primary"
                onClick={handleMarkAsCollected}
                sx={{ borderRadius: '50px', px: 4 }}
              >
                Mark as Completed
              </ButtonRounded>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};
