import { Stack } from '@mui/material';
import { ReactElement, ReactNode } from 'react';
import { useIsInlineFlow } from 'src/components/InlineFlow';

interface DetailPageContainerProps {
  children: ReactNode;
}
export default function DetailPageContainer({ children }: DetailPageContainerProps): ReactElement {
  // Inline the page is already inside the note section card, which supplies its own width
  // and padding — the page frame would only nest a second one.
  if (useIsInlineFlow()) return <>{children}</>;

  return (
    <Stack
      id="detail-page-container"
      spacing={2}
      sx={{ p: 0, maxWidth: '680px !important', mx: 'auto', width: '100%' }}
    >
      {children}
    </Stack>
  );
}
