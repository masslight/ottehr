import { ReactElement } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { LabOrderDetailedPageDTO, LabOrderResultDetails } from 'utils';
import { LabTableStatusChip } from '../labs-orders/LabTableStatusChip';
import { FinalCardView } from './FinalCardView';
import { PrelimCardView } from './PrelimCardView';

interface ResultItemProps {
  labOrder: LabOrderDetailedPageDTO;
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

      {resultDetails.resultType === 'final' && (
        <FinalCardView labStatus={resultDetails.labStatus} onMarkAsReviewed={onMarkAsReviewed} />
      )}

      {resultDetails.resultType === 'preliminary' && (
        <PrelimCardView
          receivedDate={resultDetails.receivedDate}
          reviewedDate={resultDetails.reviewedDate}
          onPrelimView={() => null}
        />
      )}
    </div>
  );
};
