import { ReactElement } from 'react';
import { Box, Button, Switch, Typography, Divider, useTheme } from '@mui/material';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import { ExternalLabsStatus, LabOrderDTO, LabOrderResultDetails } from 'utils';
import { LabTableStatusChip } from '../labs-orders/LabTableStatusChip';

interface ResultItemProps {
  labOrder: LabOrderDTO;
  onMarkAsReviewed?: () => void;
  resultDetails: LabOrderResultDetails;
}

export const ResultItem = ({ onMarkAsReviewed, labOrder, resultDetails }: ResultItemProps): ReactElement => {
  const theme = useTheme();
  return (
    <div style={{ marginTop: '42px' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexDirection: 'row',
            fontWeight: 'bold',
            color: theme.palette.primary.dark,
          }}
        >
          <span>{resultDetails.testType}:</span>
          <span>{resultDetails.testName}</span>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexDirection: 'row' }}>
          <LabTableStatusChip status={resultDetails.labStatus} />
          {labOrder.isPSC && (
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>
              PSC
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fff' }}>
        <Box sx={{ padding: 2 }}>
          <Button
            variant="outlined"
            startIcon={<BiotechOutlinedIcon />}
            onClick={() => null} // todo: will be released in the future
            sx={{ borderRadius: '50px', textTransform: 'none' }}
            disabled={true}
          >
            View Results
          </Button>
        </Box>

        <Divider />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Switch
              disabled={true} // todo: will be released in the future
              checked={false} // todo: will be released in the future
              onChange={() => null} // todo: will be released in the future
              color="primary"
              sx={{ mr: 1 }}
            />
            <Typography variant="body2">Show Results on the Patient Portal</Typography>
          </Box>

          {resultDetails.labStatus === ExternalLabsStatus.received ? (
            <Button
              variant="contained"
              onClick={onMarkAsReviewed}
              sx={{
                borderRadius: '50px',
                textTransform: 'none',
              }}
              color="primary"
            >
              Mark as Reviewed
            </Button>
          ) : null}
        </Box>
      </Box>
    </div>
  );
};
