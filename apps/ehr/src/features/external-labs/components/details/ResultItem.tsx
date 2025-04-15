import { ReactElement } from 'react';
import { Box, Button, Typography, Divider, useTheme } from '@mui/material';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import { LabOrderDTO, LabOrderResultDetails } from 'utils';
import { LabTableStatusChip } from '../labs-orders/LabTableStatusChip';
import { FinalCardView } from './FinalCardView';

interface ResultItemProps {
  labOrder: LabOrderDTO;
  onMarkAsReviewed: () => void;
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
          <span>{resultDetails.testItem}</span>
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

        <FinalCardView labStatus={resultDetails.labStatus} onMarkAsReviewed={onMarkAsReviewed} />
        {/* todo: use PrelimCardView for prelim case (apps/ehr/src/features/external-labs/components/details/PrelimCardView.tsx)*/}
      </Box>
    </div>
  );
};
