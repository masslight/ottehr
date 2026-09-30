import SendIcon from '@mui/icons-material/Send';
import { Box, IconButton, TextField } from '@mui/material';
import { FC, KeyboardEvent, useEffect, useRef, useState } from 'react';

export const MAX_MESSAGE_LENGTH = 4000;
const COUNTER_THRESHOLD = 3500;

interface MessageComposerProps {
  disabled: boolean;
  onSend: (body: string) => Promise<void>;
  focusWhenEnabled?: boolean;
  onFocusHandled?: () => void;
}

export const MessageComposer: FC<MessageComposerProps> = ({ disabled, onSend, focusWhenEnabled, onFocusHandled }) => {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const body = text.trim();
  const canSend = !disabled && !sending && body !== '' && text.length <= MAX_MESSAGE_LENGTH;

  useEffect(() => {
    if (!focusWhenEnabled || disabled) return;
    onFocusHandled?.();
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active.tabIndex < 0) inputRef.current?.focus();
  }, [focusWhenEnabled, disabled, onFocusHandled]);

  const send = async (): Promise<void> => {
    if (!canSend) return;
    const draft = text;
    setSending(true);
    setError(undefined);
    setText('');
    try {
      await onSend(body);
    } catch (sendError) {
      console.error('employee chat send failed', sendError);
      setText((typed) => (typed.trim() === '' ? draft : `${draft}\n${typed}`));
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
        inputRef={inputRef}
        inputProps={{ 'data-testid': 'employee-chat-input' }}
      />
      <IconButton color="primary" aria-label="Send message" disabled={!canSend} onClick={() => void send()}>
        <SendIcon />
      </IconButton>
    </Box>
  );
};
