import { ForumOutlined } from '@mui/icons-material';
import { Badge, useTheme } from '@mui/material';
import { FC } from 'react';
import { IconButtonContained } from 'src/features/visits/shared/components/IconButtonContained';
import { closeTeamChatDrawer, openTeamChatDrawer } from './team-chat.connection';
import { useTeamChatStore } from './team-chat.store';

export const TeamChatButton: FC = () => {
  const theme = useTheme();
  const unreadCount = useTeamChatStore((state) => state.unreadCount);
  const hasUnseenMention = useTeamChatStore((state) => state.hasUnseenMention);
  const drawerOpen = useTeamChatStore((state) => state.drawerOpen);
  const status = useTeamChatStore((state) => state.status);

  if (status === 'idle') return null;

  return (
    <Badge
      badgeContent={unreadCount}
      max={99}
      color={hasUnseenMention ? 'warning' : 'primary'}
      invisible={unreadCount === 0}
      sx={{
        '& .MuiBadge-badge': {
          top: '6px',
          right: '21px',
        },
      }}
    >
      <IconButtonContained
        id="team-chat-button"
        sx={{ marginRight: { sm: 0, md: 2 } }}
        variant="primary.lightest"
        aria-label={hasUnseenMention ? 'Team chat, you were mentioned' : `Team chat, ${unreadCount} unread`}
        onClick={() => (drawerOpen ? closeTeamChatDrawer() : openTeamChatDrawer())}
      >
        <ForumOutlined sx={{ color: theme.palette.primary.main }} />
      </IconButtonContained>
    </Badge>
  );
};
