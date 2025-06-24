import { Box, Button, Paper, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';

interface PrelimCardViewProps {
  resultPdfUrl: string | null;
  receivedDate: string | null;
  reviewedDate: string | null;
  onPrelimView: () => void;
}

export const PrelimCardView: FC<PrelimCardViewProps> = ({ resultPdfUrl, receivedDate, reviewedDate, onPrelimView }) => {
  const formatDate = (date: string | null): string => {
    if (!date) return '';
    const dateTime = DateTime.fromJSDate(new Date(date));
    return dateTime.toFormat("M/d/yyyy 'at' h:mm a");
  };

  const getDateEvent = (): { event: 'received' | 'reviewed'; date: string } => {
    return receivedDate
      ? { event: 'received', date: formatDate(receivedDate) }
      : { event: 'reviewed', date: formatDate(reviewedDate) };
  };

  const openPdf = (): void => {
    if (resultPdfUrl) {
      // additional handling for prelim, prelim resources are marked as reviewed when pdf is viewed (resources are updated, but we didn't show it in the UI),
      // the final results resources are marked as reviewed by clicking on "mark as reviewed" and we show it in the UI
      onPrelimView();
      window.open(resultPdfUrl, '_blank');
    }
  };

  const { event, date } = getDateEvent();

  return (
    <Paper
      elevation={0}
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 2,
        borderRadius: 1,
        border: '1px solid #e0e0e0',
        backgroundColor: '#fff',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body1" color="text.primary">
          Preliminary results ({event} {date})
        </Typography>
      </Box>

      <Button
        disabled={!resultPdfUrl}
        onClick={openPdf}
        variant="text"
        color="primary"
        sx={{ fontWeight: 700, textTransform: 'none' }}
      >
        View
      </Button>
    </Paper>
  );
};
