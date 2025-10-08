import { Box, CircularProgress, IconButton, useTheme } from '@mui/material';
import { ReactElement, ReactNode } from 'react';

interface Props {
  text: string;
  onClick: () => void;
  loading?: boolean;
  children: ReactNode | ReactNode[];
  dataTestId?: string;
  backgroundColor?: string;
}

export default function GoToButton(props: Props): ReactElement {
  const theme = useTheme();
  if (props.loading) {
    return (
      <Box
        sx={{ width: '80px', height: '70px' }}
        display={'flex'}
        alignItems={'center'}
        justifyContent={'space-evenly'}
      >
        <CircularProgress sx={{ color: theme.palette.primary.main }} size={24} />
      </Box>
    );
  }
  return (
    <IconButton
      data-testid={props.dataTestId}
      sx={{
        backgroundColor: props.backgroundColor || '#FFF',
        width: '80px',
        height: '70px',
        borderRadius: '8px',
        padding: '4px',
        display: 'flex',
        justifyContent: 'space-evenly',
        flexDirection: 'column',
        alignItems: 'center',
        '&:hover': {
          backgroundColor: '#EEF3FF',
        },
        fontSize: '14px',
        color: '#5F6166',
        '& .MuiSvgIcon-root': {
          '&:first-of-type': {
            color: theme.palette.primary.main,
            height: '16px',
            width: '16px',
          },
        },
      }}
      onClick={props.onClick}
    >
      {props.children}
      {props.text}
    </IconButton>
  );
}
