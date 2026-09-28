import { Box, List, ListItemAvatar, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { ChatListItem } from './employee-chat.store';
import { isUnread } from './employee-chat.utils';
import { EmployeeAvatar } from './EmployeeAvatar';

const formatListTime = (iso: string | undefined): string => {
  if (!iso) return '';
  const date = DateTime.fromISO(iso);
  return date.hasSame(DateTime.now(), 'day') ? date.toFormat('h:mm a') : date.toFormat('MMM d');
};

interface ChatListProps {
  chats: ChatListItem[];
  onOpen: (sid: string) => void;
}

export const ChatList: FC<ChatListProps> = ({ chats, onOpen }) => {
  if (chats.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
        No chats yet — search for a colleague
      </Typography>
    );
  }

  return (
    <List disablePadding data-testid="employee-chat-list">
      {chats.map((chat) => {
        const unread = isUnread(chat);
        const preview = chat.preview ? `${chat.preview.mine ? 'You: ' : ''}${chat.preview.body}` : ' ';
        return (
          <ListItemButton key={chat.sid} onClick={() => onOpen(chat.sid)} data-testid="employee-chat-list-item">
            <ListItemAvatar>
              <EmployeeAvatar employee={chat.otherEmployee} />
            </ListItemAvatar>
            <ListItemText
              primary={chat.otherEmployee.name}
              secondary={preview}
              primaryTypographyProps={{ fontWeight: unread ? 700 : 500, noWrap: true }}
              secondaryTypographyProps={{
                noWrap: true,
                fontWeight: unread ? 600 : 400,
                color: unread ? 'text.primary' : 'text.secondary',
              }}
            />
            <Stack alignItems="flex-end" spacing={0.5} sx={{ ml: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                {formatListTime(chat.lastMessageAt)}
              </Typography>
              {unread && (
                <Box
                  role="img"
                  aria-label="Unread"
                  data-testid="employee-chat-list-item-unread"
                  sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }}
                />
              )}
            </Stack>
          </ListItemButton>
        );
      })}
    </List>
  );
};
