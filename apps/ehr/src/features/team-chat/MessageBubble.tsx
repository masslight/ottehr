import { otherColors } from '@ehrTheme/colors';
import { alpha, Box, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { isMentioned, splitBodyByMentions } from './mention.utils';
import { TeamChatMessage } from './team-chat.store';

interface MessageBubbleProps {
  message: TeamChatMessage;
  isMine: boolean;
  myProfile: string | undefined;
}

export const MessageBubble: FC<MessageBubbleProps> = ({ message, isMine, myProfile }) => {
  const theme = useTheme();
  const mentions = message.attributes.mentions ?? [];
  const mentionsMe = isMentioned(mentions, myProfile);
  const senderName = message.attributes.senderName ?? message.author;
  const time = message.dateCreated ? DateTime.fromISO(message.dateCreated).toFormat('h:mm a') : '';
  const segments = splitBodyByMentions(message.body, mentions);

  return (
    <Box
      data-testid="team-chat-message"
      sx={{
        alignSelf: isMine ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        bgcolor: mentionsMe
          ? alpha(theme.palette.warning.main, 0.15)
          : isMine
          ? otherColors.lightBlue
          : theme.palette.grey[100],
        borderRadius: 2,
        px: 1.5,
        py: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {isMine ? 'You' : senderName}
        {time !== '' && ` · ${time}`}
      </Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {segments.map((segment, i) =>
          segment.mention ? (
            <Box
              key={i}
              component="span"
              sx={{
                color: theme.palette.primary.main,
                fontWeight: segment.mention.profile === myProfile ? 700 : 600,
              }}
            >
              {segment.text}
            </Box>
          ) : (
            <span key={i}>{segment.text}</span>
          )
        )}
      </Typography>
    </Box>
  );
};
