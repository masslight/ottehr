import { Box, CircularProgress } from '@mui/material';
import { CSSProperties } from 'react';

export const Loader = (props: CSSProperties & { size?: number }): React.ReactElement => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        maxHeight: '100%',
        ...props,
      }}
    >
      {/* disableShrink is needed to correct display loader under heavy CPU load */}
      <CircularProgress disableShrink size={props.size || 40} />
    </Box>
  );
};
