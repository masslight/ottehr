import CloseIcon from '@mui/icons-material/Close';
import { Alert, Box, Button, CircularProgress, Divider, Drawer, IconButton, Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, Fragment, useEffect, useMemo, useRef } from 'react';
import useEvolveUser from '../../hooks/useEvolveUser';
import { MentionInput } from './MentionInput';
import { MessageBubble } from './MessageBubble';
import { closeTeamChatDrawer, loadOlderTeamChatMessages, sendTeamChatMessage } from './team-chat.connection';
import { TeamChatMention, TeamChatMessage, useTeamChatStore } from './team-chat.store';
import { useTeamChatEmployees } from './useTeamChatEmployees';

const dayLabel = (message: TeamChatMessage): string => {
  if (!message.dateCreated) return '';
  const day = DateTime.fromISO(message.dateCreated);
  if (day.hasSame(DateTime.now(), 'day')) return 'Today';
  if (day.hasSame(DateTime.now().minus({ days: 1 }), 'day')) return 'Yesterday';
  return day.toFormat('cccc, MMM d');
};

export const TeamChatDrawer: FC = () => {
  const user = useEvolveUser();
  const drawerOpen = useTeamChatStore((state) => state.drawerOpen);
  const status = useTeamChatStore((state) => state.status);
  const error = useTeamChatStore((state) => state.error);
  const messages = useTeamChatStore((state) => state.messages);
  const identity = useTeamChatStore((state) => state.identity);
  const myProfile = useTeamChatStore((state) => state.myProfile);
  const sending = useTeamChatStore((state) => state.sending);
  const hasOlderMessages = useTeamChatStore((state) => state.hasOlderMessages);
  const loadingOlderMessages = useTeamChatStore((state) => state.loadingOlderMessages);
  const { data: employees } = useTeamChatEmployees({ enabled: drawerOpen });
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastSid = messages.length > 0 ? messages[messages.length - 1].sid : undefined;

  // Colleagues can't mention the sender into noticing their own message, so drop
  // the current user from the suggestion list.
  const candidates = useMemo(
    () => (employees ?? []).filter((employee) => employee.profile !== myProfile),
    [employees, myProfile]
  );

  useEffect(() => {
    if (drawerOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [drawerOpen, lastSid]);

  const handleSend = (body: string, mentions: TeamChatMention[]): void => {
    const senderName = user?.userName ?? 'Unknown';
    void sendTeamChatMessage(body, mentions, senderName).catch((sendError) => {
      console.error('team chat send failed', sendError);
    });
  };

  return (
    <Drawer
      anchor="right"
      open={drawerOpen}
      onClose={closeTeamChatDrawer}
      PaperProps={{ sx: { width: { xs: '100%', sm: 420 }, display: 'flex', flexDirection: 'column' } }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
        <Typography variant="h5" color="primary.dark" sx={{ fontWeight: 'bold' }}>
          Team Chat
        </Typography>
        <IconButton onClick={closeTeamChatDrawer} aria-label="Close team chat">
          <CloseIcon />
        </IconButton>
      </Stack>
      <Divider />

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {status === 'connecting' && (
          <Stack alignItems="center" sx={{ mt: 4 }}>
            <CircularProgress size={24} />
          </Stack>
        )}
        {status === 'error' && <Alert severity="error">{error ?? 'Team chat failed to connect'}</Alert>}
        {status === 'connected' && hasOlderMessages && (
          <Button size="small" disabled={loadingOlderMessages} onClick={() => void loadOlderTeamChatMessages()}>
            {loadingOlderMessages ? 'Loading…' : 'Load earlier messages'}
          </Button>
        )}
        {status === 'connected' && messages.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
            No messages yet — say hi!
          </Typography>
        )}
        {messages.map((message, index) => {
          const label = dayLabel(message);
          const previousLabel = index > 0 ? dayLabel(messages[index - 1]) : undefined;
          return (
            <Fragment key={message.sid}>
              {label !== previousLabel && (
                <Divider sx={{ my: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                </Divider>
              )}
              <MessageBubble message={message} isMine={message.author === identity} myProfile={myProfile} />
            </Fragment>
          );
        })}
        <div ref={bottomRef} />
      </Box>

      <Divider />
      <Box sx={{ p: 2 }}>
        <MentionInput candidates={candidates} disabled={status !== 'connected' || sending} onSend={handleSend} />
      </Box>
    </Drawer>
  );
};
