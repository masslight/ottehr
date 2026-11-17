import { Avatar, Box, Chip, CircularProgress, Divider, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import { deepPurple, pink } from '@mui/material/colors';
import { DateTime } from 'luxon';
import { FC, Fragment, useEffect, useRef } from 'react';
import { initialsFromName } from 'utils/lib/fhir/chat';
import { SupportChatMessageDto } from 'utils/lib/types/api/support-chat.types';

const formatDay = (isoDate: string): string => DateTime.fromISO(isoDate).toFormat('MMMM d');

export interface ChatMessageListProps {
  messages: SupportChatMessageDto[];
  firstUnreadId?: string;
  activePromptId?: string;
  newMessagesLabel: string;
  patientAuthorLabel?: string;
  isPending?: boolean;
  onOptionClick?: (messageId: string, optionId: string) => void;
}

export const ChatMessageList: FC<ChatMessageListProps> = ({
  messages,
  firstUnreadId,
  activePromptId,
  newMessagesLabel,
  patientAuthorLabel,
  isPending,
  onOptionClick,
}) => {
  const theme = useTheme();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, isPending]);

  return (
    <Stack spacing={3} sx={{ minHeight: '100%', justifyContent: 'flex-end', py: 2 }}>
      {messages.map((message, index) => {
        const day = formatDay(message.sentAt);
        const isNewDay = index === 0 || formatDay(messages[index - 1].sentAt) !== day;

        return (
          <Fragment key={message.id}>
            {message.id === firstUnreadId && (
              <Divider
                sx={{
                  color: theme.palette.warning.main,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  '&::before, &::after': { borderColor: theme.palette.warning.main },
                }}
              >
                {newMessagesLabel}
              </Divider>
            )}
            {isNewDay && (
              <Typography variant="body1" color="text.secondary" textAlign="right">
                {day}
              </Typography>
            )}
            <ChatMessage
              message={message}
              authorLabel={message.author === 'patient' ? patientAuthorLabel : undefined}
              isActivePrompt={message.id === activePromptId}
              onOptionClick={(optionId) => onOptionClick?.(message.id, optionId)}
            />
          </Fragment>
        );
      })}
      {isPending && <CircularProgress size={24} />}
      <div ref={bottomRef} />
    </Stack>
  );
};

interface ChatMessageProps {
  message: SupportChatMessageDto;
  authorLabel?: string;
  isActivePrompt: boolean;
  onOptionClick: (optionId: string) => void;
}

const ChatMessage: FC<ChatMessageProps> = ({ message, authorLabel, isActivePrompt, onOptionClick }) => {
  const theme = useTheme();
  const avatarColor = {
    bot: deepPurple[700],
    staff: pink[700],
    patient: theme.palette.secondary.main,
  }[message.author];

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Avatar
          sx={{ width: 40, height: 40, fontSize: 16, fontWeight: 600, color: 'common.white', bgcolor: avatarColor }}
        >
          {message.author === 'bot' ? message.authorName.charAt(0) : initialsFromName(message.authorName)}
        </Avatar>
        <Typography variant="body1" color="primary.main" fontWeight={500} sx={{ flexShrink: 0 }}>
          {authorLabel ?? message.authorName}
        </Typography>
        {message.requestTitle && (
          <Tooltip title={message.requestTitle}>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
              {message.requestTitle}
            </Typography>
          </Tooltip>
        )}
      </Stack>
      <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ mt: 1 }}>
        <Typography
          variant="body1"
          color={message.kind === 'recap' ? 'text.secondary' : 'text.primary'}
          sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}
        >
          {message.text}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {DateTime.fromISO(message.sentAt).toFormat('h:mm a')}
        </Typography>
      </Stack>
      {message.options && (
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
          {message.options.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              variant="outlined"
              color={isActivePrompt ? 'secondary' : 'default'}
              onClick={isActivePrompt ? () => onOptionClick(option.id) : undefined}
              sx={isActivePrompt ? undefined : { color: 'text.secondary' }}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
};
