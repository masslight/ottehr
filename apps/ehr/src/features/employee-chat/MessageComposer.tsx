import SendIcon from '@mui/icons-material/Send';
import { Box, IconButton, TextField } from '@mui/material';
import { FC, KeyboardEvent, useState } from 'react';

export const MAX_MESSAGE_LENGTH = 4000;
const COUNTER_THRESHOLD = 3500;

interface MessageComposerProps {
  disabled: boolean;
  onSend: (body: string) => Promise<void>;
}

export const MessageComposer: FC<MessageComposerProps> = ({ disabled, onSend }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const body = text.trim();
  const canSend = !disabled && !sending && body !== '' && text.length <= MAX_MESSAGE_LENGTH;

  const send = async (): Promise<void> => {
    if (!canSend) return;
    setSending(true);
    setError(undefined);
    try {
      await onSend(body);
      setText('');
    } catch (sendError) {
      console.error('employee chat send failed', sendError);
      setError('Message not sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  const helperText = error ?? (text.length >= COUNTER_THRESHOLD ? `${text.length} / ${MAX_MESSAGE_LENGTH}` : undefined);

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
      <TextField
        fullWidth
        multiline
        maxRows={4}
        size="small"
        placeholder="Write a message"
        value={text}
        disabled={disabled}
        error={!!error || text.length > MAX_MESSAGE_LENGTH}
        helperText={helperText}
        onChange={(event) => {
          setText(event.target.value);
          if (error) setError(undefined);
        }}
        onKeyDown={handleKeyDown}
        inputProps={{ 'data-testid': 'employee-chat-input' }}
      />
      <IconButton color="primary" aria-label="Send message" disabled={!canSend} onClick={() => void send()}>
        <SendIcon />
      </IconButton>
    </Box>
  );
};
