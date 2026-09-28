import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { FC, useEffect, useLayoutEffect, useRef } from 'react';
import { ChatMessage } from './employee-chat.store';
import { MessageBubble } from './MessageBubble';
import { useSeenMessages } from './useSeenMessages';

const LOAD_OLDER_THRESHOLD_PX = 40;
const STICK_TO_BOTTOM_PX = 80;

interface MessageListProps {
  messages: ChatMessage[];
  otherName: string;
  loading: boolean;
  hasOlderMessages: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onSeen: (index: number) => void;
}

interface ScrollSnapshot {
  height: number;
  top: number;
  client: number;
  firstIndex?: number;
  lastIndex?: number;
}

export const MessageList: FC<MessageListProps> = ({
  messages,
  otherName,
  loading,
  hasOlderMessages,
  loadingOlder,
  onLoadOlder,
  onSeen,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const snapshot = useRef<ScrollSnapshot>({ height: 0, top: 0, client: 0 });
  const scheduleSeenCheck = useSeenMessages(containerRef, onSeen);

  useEffect(() => {
    scheduleSeenCheck();
  }, [messages, scheduleSeenCheck]);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const previous = snapshot.current;
    const first = messages[0];
    const last = messages[messages.length - 1];

    if (previous.firstIndex === undefined || first === undefined) {
      element.scrollTop = element.scrollHeight;
    } else if (first.index < previous.firstIndex) {
      element.scrollTop = element.scrollHeight - previous.height + previous.top;
    } else if (last && previous.lastIndex !== undefined && last.index > previous.lastIndex) {
      const wasNearBottom = previous.height - previous.top - previous.client < STICK_TO_BOTTOM_PX;
      if (wasNearBottom || last.mine) element.scrollTop = element.scrollHeight;
    }

    snapshot.current = {
      height: element.scrollHeight,
      top: element.scrollTop,
      client: element.clientHeight,
      firstIndex: first?.index,
      lastIndex: last?.index,
    };
  }, [messages]);

  const handleScroll = (): void => {
    const element = containerRef.current;
    if (!element) return;
    snapshot.current = {
      ...snapshot.current,
      height: element.scrollHeight,
      top: element.scrollTop,
      client: element.clientHeight,
    };
    scheduleSeenCheck();
    if (element.scrollTop < LOAD_OLDER_THRESHOLD_PX && hasOlderMessages && !loadingOlder) {
      onLoadOlder();
    }
  };

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      data-testid="employee-chat-messages"
      sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      {loading && (
        <Stack alignItems="center" sx={{ mt: 4 }}>
          <CircularProgress size={24} />
        </Stack>
      )}
      {!loading && hasOlderMessages && (
        <Button size="small" disabled={loadingOlder} onClick={onLoadOlder}>
          {loadingOlder ? 'Loading…' : 'Load earlier messages'}
        </Button>
      )}
      {!loading && messages.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
          No messages yet
        </Typography>
      )}
      {messages.map((message) => (
        <MessageBubble key={message.sid} message={message} otherName={otherName} />
      ))}
    </Box>
  );
};
