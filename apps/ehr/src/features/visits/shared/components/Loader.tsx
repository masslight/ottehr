import { Box, CircularProgress } from '@mui/material';
import { CSSProperties } from 'react';

export const Loader = (props: CSSProperties & { size?: number; 'data-testid'?: string }): React.ReactElement => {
  const { 'data-testid': dataTestId, size, ...styleProps } = props;
  return (
    <Box
      data-testid={dataTestId}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        maxHeight: '100%',
        ...styleProps,
      }}
    >
      {/* disableShrink is needed to correct display loader under heavy CPU load */}
      <CircularProgress disableShrink size={size || 40} />
    </Box>
  );
};
