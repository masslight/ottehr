import { Box, Button, Paper, Typography } from '@mui/material';
import { formatDateForLabs, UnsolicitedResultTaskRowDTO } from 'utils';

interface UnsolicitedResultsTaskCardProps {
  task: UnsolicitedResultTaskRowDTO;
}

export const UnsolicitedResultsTaskCard: React.FC<UnsolicitedResultsTaskCardProps> = ({ task }) => {
  return (
    <Paper
      key={task.diagnosticReportId}
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        p: '8px 16px',
        borderRadius: '4px',
      }}
    >
      <Box>
        <Typography variant="body1" sx={{ fontWeight: 500 }}>
          {task.taskRowDescription}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {`Unsolicited lab results received on ${formatDateForLabs(task.resultsReceivedDateTime, undefined)}`}
        </Typography>
      </Box>

      <Button
        variant="contained"
        sx={{ whiteSpace: 'nowrap', textTransform: 'none', borderRadius: '100px', minWidth: '100px' }}
      >
        {task.actionText}
      </Button>
    </Paper>
  );
};
