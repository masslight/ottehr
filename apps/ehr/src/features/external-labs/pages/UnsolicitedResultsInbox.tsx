import { Stack, Typography } from '@mui/material';
import PageContainer from 'src/layout/PageContainer';

// this page is temporary and should be replaced by tasks
// we needed a quick fix solution for unsolicited results hence this page was born
// hopefully a lot of this code can be reused for the tasks board as the ui is identical
export const UnsolicitedResultsInbox: React.FC = () => {
  return (
    <PageContainer>
      <Stack sx={{ p: '0px 16px 40px 16px' }}>
        <Typography variant="h4" color="primary.dark">
          Unsolicited Results
        </Typography>
      </Stack>
    </PageContainer>
  );
};
