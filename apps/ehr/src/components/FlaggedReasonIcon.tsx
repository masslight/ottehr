import { otherColors } from '@ehrTheme/colors';
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded';
import { useTheme } from '@mui/material';
import { CSSProperties, ReactElement } from 'react';

export const FlaggedReasonIcon = ({ style }: { style?: CSSProperties }): ReactElement => {
  const theme = useTheme();
  return (
    <PriorityHighRoundedIcon
      style={{
        height: '14px',
        width: '14px',
        padding: '2px',
        color: theme.palette.primary.contrastText,
        backgroundColor: otherColors.priorityHighIcon,
        borderRadius: '4px',
        marginRight: '4px',
        ...style,
      }}
    />
  );
};
