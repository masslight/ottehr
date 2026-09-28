import { otherColors } from '@ehrTheme/colors';
import { Box, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { ChatMessage } from './employee-chat.store';
import { LinkifiedText } from './LinkifiedText';

interface MessageBubbleProps {
  message: ChatMessage;
  otherName: string;
}

export const formatMessageTimestamp = (dateCreated: string | undefined): string =>
  dateCreated ? DateTime.fromISO(dateCreated).toFormat('MMM d, yyyy · h:mm a') : '';

export const MessageBubble: FC<MessageBubbleProps> = ({ message, otherName }) => {
  const theme = useTheme();
  const timestamp = formatMessageTimestamp(message.dateCreated);

  return (
    <Box
      data-testid="employee-chat-message"
      sx={{
        alignSelf: message.mine ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        bgcolor: message.mine ? otherColors.lightBlue : theme.palette.grey[100],
        borderRadius: 2,
        px: 1.5,
        py: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary" component="div">
        {message.mine ? 'You' : otherName}
        {timestamp !== '' && ` · ${timestamp}`}
      </Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        <LinkifiedText text={message.body} />
      </Typography>
    </Box>
  );
};
