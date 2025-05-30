import { Stack } from '@mui/material';
import { ReactElement } from 'react';

interface DetailPageContainerProps {
  children: ReactElement;
}
export default function DetailPageContainer({ children }: DetailPageContainerProps): ReactElement {
  return (
    <Stack id="detail-page-container" spacing={2} sx={{ p: 0, maxWidth: '680px !important', mx: 'auto' }}>
      {children}
    </Stack>
  );
}
