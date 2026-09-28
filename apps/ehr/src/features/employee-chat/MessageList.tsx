import { Box, Button, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import { FC, Fragment, useEffect, useLayoutEffect, useRef } from 'react';
import { ChatMessage } from './employee-chat.store';
import { MessageBubble } from './MessageBubble';
import { isAttending, useSeenMessages } from './useSeenMessages';

const LOAD_OLDER_THRESHOLD_PX = 40;
const STICK_TO_BOTTOM_PX = 80;
const DIVIDER_TOP_GAP_PX = 8;
const NEW_DIVIDER_TEST_ID = 'employee-chat-new-divider';
const UNREAD_ABOVE_TEST_ID = 'employee-chat-unread-above';

interface MessageListProps {
  messages: ChatMessage[];
  otherName: string;
  loading: boolean;
  hasOlderMessages: boolean;
  loadingOlder: boolean;
  entryId: number | undefined;
  dividerIndex: number | undefined;
  unreadAbove: boolean;
  onLoadOlder: () => void;
  onSeen: (index: number) => void;
  onMissedMessage: (index: number) => void;
}

function initialScrollTop(element: HTMLElement): number {
  const anchor = element.querySelector<HTMLElement>(
    `[data-testid="${NEW_DIVIDER_TEST_ID}"], [data-testid="${UNREAD_ABOVE_TEST_ID}"]`
  );
  if (!anchor) return element.scrollHeight;
  const offset = anchor.getBoundingClientRect().top - element.getBoundingClientRect().top;
  return element.scrollTop + offset - DIVIDER_TOP_GAP_PX;
}

interface ScrollSnapshot {
  height: number;
  top: number;
  client: number;
  firstIndex?: number;
  lastIndex?: number;
  dividerIndex?: number;
}

export const MessageList: FC<MessageListProps> = ({
  messages,
  otherName,
  loading,
  hasOlderMessages,
  loadingOlder,
  entryId,
  dividerIndex,
  unreadAbove,
  onLoadOlder,
  onSeen,
  onMissedMessage,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const snapshot = useRef<ScrollSnapshot>({ height: 0, top: 0, client: 0 });
  const positionedEntry = useRef<number | undefined>(undefined);
  const positioned = useRef(false);
  const scheduleSeenCheck = useSeenMessages(containerRef, onSeen, positioned);

  useEffect(() => {
    scheduleSeenCheck();
  }, [messages, entryId, scheduleSeenCheck]);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const previous = snapshot.current;
    const first = messages[0];
    const last = messages[messages.length - 1];
    const wasNearBottom = previous.height - previous.top - previous.client < STICK_TO_BOTTOM_PX;

    if (entryId === undefined || positionedEntry.current !== entryId) {
      positioned.current = false;
      if (entryId === undefined) return;
      element.scrollTop = initialScrollTop(element);
      positionedEntry.current = entryId;
      positioned.current = true;
    } else {
      if (previous.firstIndex === undefined || first === undefined) {
        element.scrollTop = element.scrollHeight;
      } else if (first.index < previous.firstIndex) {
        element.scrollTop = element.scrollHeight - previous.height + previous.top;
      } else if (last && previous.lastIndex !== undefined && last.index > previous.lastIndex) {
        if (wasNearBottom || last.mine) element.scrollTop = element.scrollHeight;
      } else if (dividerIndex !== previous.dividerIndex && wasNearBottom) {
        element.scrollTop = element.scrollHeight;
      }
      if (dividerIndex === undefined && !unreadAbove) {
        const missed = messages.find((message) => !message.mine && message.index > (previous.lastIndex ?? -1));
        if (missed && (!wasNearBottom || !isAttending())) onMissedMessage(missed.index);
      }
    }

    snapshot.current = {
      height: element.scrollHeight,
      top: element.scrollTop,
      client: element.clientHeight,
      firstIndex: first?.index,
      lastIndex: last?.index,
      dividerIndex,
    };
  }, [messages, entryId, dividerIndex, unreadAbove, onMissedMessage]);

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
      {!loading && unreadAbove && (
        <Typography
          data-testid={UNREAD_ABOVE_TEST_ID}
          variant="caption"
          color="error.main"
          sx={{ textAlign: 'center', fontWeight: 600 }}
        >
          New messages start further up
        </Typography>
      )}
      {!loading && messages.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
          No messages yet
        </Typography>
      )}
      {messages.map((message) => (
        <Fragment key={message.sid}>
          {message.index === dividerIndex && (
            <Divider
              data-testid={NEW_DIVIDER_TEST_ID}
              textAlign="right"
              sx={{ color: 'error.main', '&::before, &::after': { borderColor: 'error.main' } }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                New
              </Typography>
            </Divider>
          )}
          <MessageBubble message={message} otherName={otherName} />
        </Fragment>
      ))}
    </Box>
  );
};
