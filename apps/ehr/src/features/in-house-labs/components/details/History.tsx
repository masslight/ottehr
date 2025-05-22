import { FC } from 'react';
import { Box, Button, Divider, Grid, TextField, Typography } from '@mui/material';
import { LabTest } from 'utils';
import { DateTime } from 'luxon';

type HistoryProps = {
  setNotes: (notes: string) => void;
  notes: string;
  testDetails: LabTest;
  handleReprintLabel: () => void;
};

const formatDateTime = (dateString: string): string => {
  try {
    return DateTime.fromISO(dateString).toFormat("MM/dd/yyyy 'at' h:mm a");
  } catch (error) {
    return dateString;
  }
};

export const History: FC<HistoryProps> = ({ testDetails, setNotes, notes, handleReprintLabel }) => {
  return (
    <Box mb={3}>
      <Box sx={{ mt: 3, mb: 1 }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Provider notes
        </Typography>
        <TextField fullWidth multiline rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Box>
      {testDetails.orderDetails && (
        <Box mt={3}>
          <Button variant="outlined" onClick={handleReprintLabel} sx={{ mb: 3 }}>
            Re-Print Label
          </Button>

          <Grid container sx={{ backgroundColor: '#F8F9FA', p: 2 }}>
            <Grid item xs={3}>
              <Box
                sx={{
                  bgcolor: '#F1F3F4',
                  color: '#5F6368',
                  fontWeight: 'bold',
                  px: 2,
                  py: 0.5,
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  display: 'inline-block',
                }}
              >
                ORDERED
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="body2">{testDetails.orderDetails.orderedBy}</Typography>
            </Grid>
            <Grid item xs={5}>
              <Typography variant="body2">{formatDateTime(testDetails.orderDetails.orderedDate)}</Typography>
            </Grid>

            <Grid item xs={12} sx={{ mt: 1 }}>
              <Divider />
            </Grid>

            <Grid item xs={3} sx={{ mt: 1 }}>
              <Box
                sx={{
                  bgcolor: '#E8DEFF',
                  color: '#5E35B1',
                  fontWeight: 'bold',
                  px: 2,
                  py: 0.5,
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  display: 'inline-block',
                }}
              >
                COLLECTED
              </Box>
            </Grid>
            <Grid item xs={4} sx={{ mt: 1 }}>
              <Typography variant="body2">{testDetails.orderDetails.collectedBy || ''}</Typography>
            </Grid>
            <Grid item xs={5} sx={{ mt: 1 }}>
              <Typography variant="body2">
                {testDetails.orderDetails.collectedDate ? formatDateTime(testDetails.orderDetails.collectedDate) : ''}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
};
