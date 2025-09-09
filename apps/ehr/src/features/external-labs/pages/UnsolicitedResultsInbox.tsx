import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import PageContainer from 'src/layout/PageContainer';
import { useGetUnsolicitedResultsTasks } from 'src/telemed';
import { UnsolicitedResultsRequestType } from 'utils';
import { UnsolicitedResultsTaskCard } from '../components/unsolicited-results/UnsolicitedResultsTaskCard';

// this page is temporary and should be replaced/ absorbed by tasks dashboard
// we needed a quick fix solution for unsolicited results hence this page was born
// hopefully a lot of this code can be reused for the tasks board as the ui is identical
export const UnsolicitedResultsInbox: React.FC = () => {
  const { data, isLoading } = useGetUnsolicitedResultsTasks({
    requestType: UnsolicitedResultsRequestType.GET_UNSOLICITED_RESULTS_TASKS,
  });
  const unsolicitedTaskRows = data?.unsolicitedResultsTasks || [];

  return (
    <PageContainer>
      <Stack sx={{ p: '0px 16px 40px 16px' }} gap={'16px'}>
        <Typography variant="h4" color="primary.dark">
          Unsolicited Results
        </Typography>

        {isLoading ? (
          <CircularProgress />
        ) : (
          <Stack spacing={'8px'}>
            <Box sx={{ p: '8px', borderRadius: '4px', backgroundColor: '#4294F314' }}>
              <Typography
                color="primary.dark"
                variant="body2"
                sx={{ fontWeight: 500 }}
              >{`Tasks - ${unsolicitedTaskRows.length}`}</Typography>
            </Box>
            {unsolicitedTaskRows.map((task, idx) => (
              <UnsolicitedResultsTaskCard key={`task-card-${idx}-${task.diagnosticReportId}`} task={task} />
            ))}
          </Stack>
        )}
      </Stack>
    </PageContainer>
  );
};
