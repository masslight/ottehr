import { Stack } from '@mui/material';
import { ReactNode } from 'react';

interface DetailPageContainerProps {
  children: ReactNode;
}
export default function DetailPageContainer({ children }: DetailPageContainerProps): ReactNode {
  return (
    <Stack id="detail-page-container" spacing={2} sx={{ p: 0, maxWidth: '680px !important', mx: 'auto' }}>
      {children}
    </Stack>
  );
}
