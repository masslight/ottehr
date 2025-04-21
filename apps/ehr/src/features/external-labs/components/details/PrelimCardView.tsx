import { Box, Typography, Button, Paper } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';

interface PrelimCardViewProps {
  receivedDate: string | null;
  reviewedDate: string | null;
  onPrelimView: () => void;
}

export const PrelimCardView: FC<PrelimCardViewProps> = ({ receivedDate, reviewedDate, onPrelimView }) => {
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

      <Button disabled variant="text" color="primary" onClick={onPrelimView} sx={{ fontWeight: 500 }}>
        View
      </Button>
    </Paper>
  );
};
