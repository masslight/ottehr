import { Box } from '@mui/material';
import { ReactElement } from 'react';

interface ListViewContainerProps {
  children: ReactElement;
}
export default function ListViewContainer({ children }: ListViewContainerProps): ReactElement {
  return (
    <Box id="list-view-container" sx={{ p: 0, maxWidth: '1536px !important', mx: 'auto', width: '100%' }}>
      {children}
    </Box>
  );
}
