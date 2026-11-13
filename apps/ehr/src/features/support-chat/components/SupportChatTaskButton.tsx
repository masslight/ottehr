import ChatOutlineIcon from '@mui/icons-material/ChatOutlined';
import { Badge, IconButton, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import { Task } from 'utils/lib/types/data/tasks/types';
import { SupportChatModal } from './SupportChatModal';

export const SupportChatTaskButton: FC<{ task: Task }> = ({ task }) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const hasUnread = Boolean(task.chat?.hasUnread);

  return (
    <>
      <IconButton
        aria-label={hasUnread ? 'unread messages chat icon' : 'chat icon, no unread messages'}
        onClick={() => setIsOpen(true)}
        sx={{
          backgroundColor: theme.palette.primary.main,
          width: '36px',
          height: '36px',
          '&:hover': { backgroundColor: theme.palette.primary.main },
        }}
      >
        <Badge
          variant="dot"
          color="warning"
          invisible={!hasUnread}
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
          <ChatOutlineIcon sx={{ color: theme.palette.primary.contrastText, height: '20px', width: '20px' }} />
        </Badge>
      </IconButton>
      {isOpen && <SupportChatModal task={task} onClose={() => setIsOpen(false)} />}
    </>
  );
};
