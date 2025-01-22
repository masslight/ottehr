import { ReactElement } from 'react';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import { Box } from '@mui/material';

interface PriorityIconWithBorderProps {
  fill: string;
}

export const PriorityIconWithBorder = ({ fill }: PriorityIconWithBorderProps): ReactElement => (
  <Box
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      border: `1.25px solid ${fill}`,
      height: '10px',
      width: '10px',
      transform: 'rotate(45deg)',
      marginLeft: '6px',
      borderRadius: '1px',
    }}
  >
    <PriorityHighIcon
      style={{
        position: 'absolute',
        height: '8px',
        color: fill,
        transform: 'rotate(315deg)',
      }}
    />
  </Box>
);
