import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { Button, Stack, TextField } from '@mui/material';
import { FC, KeyboardEvent, ReactNode, useState } from 'react';

const MAX_MESSAGE_LENGTH = 4000;

export interface ChatComposerProps {
  label: string;
  sendLabel: string;
  isSending: boolean;
  onSend: (text: string) => Promise<unknown>;
  leadingSlot?: ReactNode;
  buttonColor?: 'primary' | 'secondary';
  sendIcon?: ReactNode;
  allowEmpty?: boolean;
}

export const ChatComposer: FC<ChatComposerProps> = ({
  label,
  sendLabel,
  isSending,
  onSend,
  leadingSlot,
  buttonColor = 'primary',
  sendIcon = <SendOutlinedIcon />,
  allowEmpty = false,
}) => {
  const [text, setText] = useState('');
  const message = text.trim();
  const canSend = (allowEmpty || message.length > 0) && !isSending;

  const send = async (): Promise<void> => {
    if (!canSend) return;
    try {
      await onSend(message);
      setText('');
    } catch (error) {
      console.error('Failed to send the message', error);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <Stack direction="row" alignItems="center" spacing={2}>
      {leadingSlot}
      <TextField
        label={label}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        InputLabelProps={{ shrink: true }}
        inputProps={{ maxLength: MAX_MESSAGE_LENGTH, readOnly: isSending }}
        multiline
        maxRows={4}
        fullWidth
      />
      <Button
        variant="contained"
        color={buttonColor}
        startIcon={sendIcon}
        disabled={isSending}
        onClick={() => void send()}
        sx={{ flexShrink: 0, px: 3 }}
      >
        {sendLabel}
      </Button>
    </Stack>
  );
};
