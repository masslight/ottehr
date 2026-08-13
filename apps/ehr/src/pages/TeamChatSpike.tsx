import { otherColors } from '@ehrTheme/colors';
import SendIcon from '@mui/icons-material/Send';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { Client, Conversation, Message } from '@twilio/conversations';
import { DateTime } from 'luxon';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { getTeamChatAccess } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

// Spike page proving out the Oystehr Conversations service (Twilio Conversations
// under the hood) for real-time staff-to-staff chat. Throwaway UI: the real
// feature will live in the top bar with @-mentions and notifications.
export default function TeamChatSpike(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | undefined>(undefined);
  const [identity, setIdentity] = useState<string | undefined>(undefined);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const clientRef = useRef<Client | undefined>(undefined);
  const conversationRef = useRef<Conversation | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      void clientRef.current?.shutdown();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const refreshToken = useCallback(async (): Promise<void> => {
    if (!oystehrZambda || !clientRef.current) return;
    try {
      const access = await getTeamChatAccess(oystehrZambda);
      await clientRef.current.updateToken(access.token);
    } catch (e) {
      console.error('team chat token refresh failed', e);
    }
  }, [oystehrZambda]);

  const connect = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) {
      setError('Zambda client is not ready yet, try again in a moment');
      setStatus('error');
      return;
    }
    setStatus('connecting');
    setError(undefined);
    try {
      const access = await getTeamChatAccess(oystehrZambda);
      setConversationId(access.conversationId);

      const { Client: TwilioClient } = await import('@twilio/conversations');
      const client = new TwilioClient(access.token);
      clientRef.current = client;

      await new Promise<void>((resolve, reject) => {
        client.on('stateChanged', (state) => {
          if (state === 'initialized') resolve();
          if (state === 'failed') reject(new Error('Twilio client failed to initialize'));
        });
      });
      setIdentity(client.user.identity);

      client.on('tokenAboutToExpire', () => void refreshToken());
      client.on('tokenExpired', () => void refreshToken());

      const conversation = await client.getConversationBySid(access.conversationId);
      conversationRef.current = conversation;

      const page = await conversation.getMessages(50);
      setMessages(page.items);
      conversation.on('messageAdded', (message) => {
        setMessages((prev) => [...prev, message]);
      });

      setStatus('connected');
    } catch (e) {
      console.error('team chat connect failed', e);
      setError(e instanceof Error ? e.message : JSON.stringify(e));
      setStatus('error');
    }
  }, [oystehrZambda, refreshToken]);

  const send = useCallback(async (): Promise<void> => {
    const conversation = conversationRef.current;
    const body = draft.trim();
    if (!conversation || !body) return;
    setSending(true);
    try {
      await conversation.sendMessage(body);
      setDraft('');
    } catch (e) {
      console.error('team chat send failed', e);
      setError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      setSending(false);
    }
  }, [draft]);

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h4" color="primary.dark">
          Team Chat (spike)
        </Typography>
        <Chip
          label={status}
          color={status === 'connected' ? 'success' : status === 'error' ? 'error' : 'default'}
          size="small"
        />
      </Stack>

      {status === 'idle' && (
        <Button variant="contained" onClick={() => void connect()} sx={{ alignSelf: 'flex-start' }}>
          Connect to team chat
        </Button>
      )}
      {status === 'connecting' && (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={20} />
          <Typography>Connecting…</Typography>
        </Stack>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      {status === 'error' && (
        <Button variant="outlined" onClick={() => void connect()} sx={{ alignSelf: 'flex-start' }}>
          Retry
        </Button>
      )}

      {status === 'connected' && (
        <>
          <Typography variant="body2" color="text.secondary">
            Connected as <b>{identity}</b> · conversation <b>{conversationId}</b>
          </Typography>
          <Paper variant="outlined" sx={{ height: 420, overflowY: 'auto', p: 2 }}>
            {messages.length === 0 && (
              <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                No messages yet — say hi!
              </Typography>
            )}
            <Stack spacing={1}>
              {messages.map((message) => {
                const mine = message.author === identity;
                return (
                  <Box
                    key={message.sid}
                    sx={{
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      bgcolor: mine ? otherColors.lightBlue : 'grey.100',
                      borderRadius: 2,
                      px: 1.5,
                      py: 1,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {message.author} ·{' '}
                      {message.dateCreated ? DateTime.fromJSDate(message.dateCreated).toFormat('MMM d, h:mm a') : ''}
                    </Typography>
                    <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.body}</Typography>
                  </Box>
                );
              })}
            </Stack>
            <div ref={bottomRef} />
          </Paper>
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              placeholder="Type a message"
              value={draft}
              disabled={sending}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <IconButton color="primary" disabled={sending || draft.trim() === ''} onClick={() => void send()}>
              <SendIcon />
            </IconButton>
          </Stack>
        </>
      )}
    </Box>
  );
}
