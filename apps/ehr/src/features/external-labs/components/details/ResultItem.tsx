import { Box, Typography, useTheme } from '@mui/material';
import { ReactElement } from 'react';
import {
  LabOrderDetailedPageDTO,
  LabOrderResultDetails,
  PdfAttachmentDTO,
  PSC_LOCALE,
  ReflexLabDTO,
  UnsolicitedLabDTO,
} from 'utils';
import { LabsOrderStatusChip } from '../ExternalLabsStatusChip';
import { FinalCardView } from './FinalCardView';
import { PrelimCardView } from './PrelimCardView';

interface ResultItemProps {
  labOrder: LabOrderDetailedPageDTO | UnsolicitedLabDTO | ReflexLabDTO | PdfAttachmentDTO;
  onMarkAsReviewed: () => void;
  resultDetails: LabOrderResultDetails;
  loading: boolean;
}

export const ResultItem = ({ onMarkAsReviewed, labOrder, resultDetails, loading }: ResultItemProps): ReactElement => {
  const theme = useTheme();

  const isUnsolicitedPage = 'isUnsolicited' in labOrder;
  const isDrCentricResult = 'drCentricResultType' in labOrder || isUnsolicitedPage;

  let timezone: string | undefined;
  if (!isDrCentricResult) {
    timezone = labOrder.encounterTimezone;
  }

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
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
          taskId={resultDetails.taskId}
          labGeneratedResultUrl={resultDetails.labGeneratedResultUrl}
        />
      )}

      {/* todo will configure this for unsolicited results post mvp */}
      {!isUnsolicitedPage && resultDetails.resultType === 'preliminary' && (
        <PrelimCardView
          resultPdfUrl={resultDetails.resultPdfUrl}
          receivedDate={resultDetails.receivedDate}
          reviewedDate={resultDetails.reviewedDate}
          onPrelimView={() => onMarkAsReviewed()} // todo: add open PDF when task will be ready
          timezone={timezone}
        />
      )}

      {resultDetails.alternatePlacerId && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body1">
            <span style={{ fontWeight: 500 }}>Requisition Number: </span> {resultDetails.alternatePlacerId}
          </Typography>
        </Box>
      )}
    </>
  );
};
