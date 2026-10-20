import { Box, CircularProgress, IconButton, useTheme } from '@mui/material';
import { ReactElement, ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

interface BaseProps {
  text: string;
  loading?: boolean;
  children: ReactNode | ReactNode[];
  dataTestId?: string;
  backgroundColor?: string;
}

/**
 * Buttons that only navigate pass `to`, which renders them as an anchor so the browser's native
 * link behavior (context menu, middle-click, cmd/ctrl-click) keeps working. Buttons that do
 * anything else pass `onClick`.
 */
type Props = BaseProps &
  ({ to: string; onClick?: never } | { to?: never; onClick: (event: React.MouseEvent<HTMLElement>) => void });

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
      {...(props.to ? { component: RouterLink, to: props.to } : {})}
    >
      {props.children}
      {props.text}
    </IconButton>
  );
}
