import { ForumOutlined } from '@mui/icons-material';
import { Badge, useTheme } from '@mui/material';
import { FC } from 'react';
import { IconButtonContained } from 'src/features/visits/shared/components/IconButtonContained';
import { closeEmployeeChatDrawer, openEmployeeChatDrawer } from './employee-chat.connection';
import { useEmployeeChatStore } from './employee-chat.store';
import { selectHasUnread } from './employee-chat.utils';

export const EmployeeChatButton: FC = () => {
  const theme = useTheme();
  const hasUnread = useEmployeeChatStore(selectHasUnread);
  const drawerOpen = useEmployeeChatStore((state) => state.drawerOpen);
  const status = useEmployeeChatStore((state) => state.status);

  if (status === 'idle') return null;

  return (
    <Badge
      variant="dot"
      color="error"
      invisible={!hasUnread}
      data-testid="employee-chat-unread-dot"
      sx={{ '& .MuiBadge-badge': { top: '8px', right: '24px' } }}
    >
      <IconButtonContained
        id="employee-chat-button"
        sx={{ marginRight: { sm: 0, md: 2 } }}
        variant="primary.lightest"
        aria-label={hasUnread ? 'Chats, you have new messages' : 'Chats'}
        onClick={() => (drawerOpen ? closeEmployeeChatDrawer() : openEmployeeChatDrawer())}
      >
        <ForumOutlined sx={{ color: theme.palette.primary.main }} />
      </IconButtonContained>
    </Badge>
  );
};
