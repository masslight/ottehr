import ChatOutlineIcon from '@mui/icons-material/ChatOutlined';
import { Badge, IconButton, useTheme } from '@mui/material';
import { ReactElement } from 'react';

interface ChatIconButtonProps {
  hasUnread: boolean;
  onClick: () => void;
}

export function ChatIconButton({ hasUnread, onClick }: ChatIconButtonProps): ReactElement {
  const theme = useTheme();

  const icon = (
    <ChatOutlineIcon
      sx={{
        color: theme.palette.primary.contrastText,
        height: '20px',
        width: '20px',
      }}
    />
  );

  return (
    <IconButton
      sx={{
        backgroundColor: theme.palette.primary.main,
        width: '36px',
        height: '36px',
        borderRadius: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        '&:hover': {
          backgroundColor: theme.palette.primary.main,
        },
      }}
      onClick={onClick}
      aria-label={hasUnread ? 'unread messages chat icon' : 'chat icon, no unread messages'}
    >
      {hasUnread ? (
        <Badge
          variant="dot"
          color="warning"
          sx={{
            '& .MuiBadge-badge': {
              width: '14px',
              height: '14px',
              borderRadius: '10px',
              border: '2px solid white',
              top: '-4px',
              right: '-4px',
            },
          }}
        >
          {icon}
        </Badge>
      ) : (
        icon
      )}
    </IconButton>
  );
}
