import { Box, Typography, useTheme } from '@mui/material';
import { ReactElement } from 'react';
import { LabOrderDetailedPageDTO, LabOrderResultDetails, PSC_LOCALE, UnsolicitedLabDetailedPageDTO } from 'utils';
import { LabsOrderStatusChip } from '../ExternalLabsStatusChip';
import { FinalCardView } from './FinalCardView';
import { PrelimCardView } from './PrelimCardView';

interface ResultItemProps {
  labOrder: LabOrderDetailedPageDTO | UnsolicitedLabDetailedPageDTO;
  onMarkAsReviewed: () => void;
  resultDetails: LabOrderResultDetails;
  loading: boolean;
}

export const ResultItem = ({ onMarkAsReviewed, labOrder, resultDetails, loading }: ResultItemProps): ReactElement => {
  const theme = useTheme();

  const isUnsolicitedPage = 'isUnsolicited' in labOrder;

  let timezone: string | undefined;
  if (!isUnsolicitedPage) {
    timezone = labOrder.encounterTimezone;
  }

  return (
    <>
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
          {labOrder.isPSC && (
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mr: 1 }}>
              {PSC_LOCALE}
            </Typography>
          )}
          <LabsOrderStatusChip status={resultDetails.labStatus} />
        </Box>
      </Box>

      {(resultDetails.resultType === 'final' || resultDetails.resultType === 'cancelled') && (
        <FinalCardView
          isUnsolicited={isUnsolicitedPage}
          resultPdfUrl={resultDetails.resultPdfUrl}
          labStatus={resultDetails.labStatus}
          onMarkAsReviewed={onMarkAsReviewed}
          loading={loading}
        />
      )}

      {resultDetails.resultType === 'preliminary' && (
        <PrelimCardView
          resultPdfUrl={resultDetails.resultPdfUrl}
          receivedDate={resultDetails.receivedDate}
          reviewedDate={resultDetails.reviewedDate}
          onPrelimView={() => onMarkAsReviewed()} // todo: add open PDF when task will be ready
          timezone={timezone}
        />
      )}
    </>
  );
};
