import { Close, Search } from '@mui/icons-material';
import SendIcon from '@mui/icons-material/Send';
import { LoadingButton } from '@mui/lab';
import {
  Avatar,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
} from '@mui/material';
import Typography from '@mui/material/Typography';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ChangeEvent, memo, ReactElement, UIEvent, useEffect, useMemo, useState } from 'react';
import { LocationWithWalkinSchedule } from 'src/pages/AddPatient';
import { getPatientName } from 'src/shared/utils/getPatientName';
import { AppointmentMessaging, ConversationMessage, initialsFromName, markAllMessagesRead, Timezone } from 'utils';
import { CompleteConfiguration } from '../../components/CompleteConfiguration';
import { LANGUAGES } from '../../constants';
import { dataTestIds } from '../../constants/data-test-ids';
import { useApiClients } from '../../hooks/useAppClients';
import useEvolveUser, { EvolveUser } from '../../hooks/useEvolveUser';
import {
  buildQuickTextVariables,
  QuickTextsContext,
  resolveQuickText,
  useFetchChatMessagesQuery,
  useGetMessagingConfigQuery,
  useQuickTextsQuery,
  useSendMessagesMutation,
} from './chat.queries';

function scrollToBottomOfChat(): void {
  // this helps with the scroll working,
  // not sure why setting it to 0 works.
  // maybe the element scrollHeight isn't set
  // and this waiting helps?
  setTimeout(() => {
    const element = document.getElementById('message-container');
    if (element) {
      element.scrollTop = element?.scrollHeight;
    }
  }, 0);
}

export interface MessageModel extends ConversationMessage {
  resolvedId?: string | undefined;
}

const makePendingSentMessage = (text: string, timezone: string, sender: EvolveUser): MessageModel => {
  const id = `pending_sent_message_${Math.round(Math.random() * 100)}`;
  const now = DateTime.now().setZone(timezone);
  // todo: consts for these format strings somewhere, or just send the date from BE and do all the formatting in one place
  const sentDay = now.toLocaleString({ day: 'numeric', month: 'numeric', year: '2-digit' }, { locale: 'en-us' });
  const sentTime = now.toLocaleString({ timeStyle: 'short' }, { locale: 'en-us' });

  return {
    id,
    sender: sender.userName, // todo
    sentDay,
    sentTime,
    content: text,
    isRead: true,
    resolvedId: undefined,
    isFromPatient: false,
  };
};

const ChatModal = memo(
  ({
    appointment,
    patient,
    onClose,
    onMarkAllRead,
    quickTextsContext,
  }: {
    appointment: AppointmentMessaging;
    patient?: Patient;
    currentLocation?: LocationWithWalkinSchedule;
    onClose: () => void;
    onMarkAllRead: () => void;
    quickTextsContext: QuickTextsContext;
  }): ReactElement => {
    const theme = useTheme();
    const { oystehr } = useApiClients();
    const currentUser = useEvolveUser();
    const [_messages, _setMessages] = useState<MessageModel[]>([]);
    const [messageText, setMessageText] = useState<string>('');
    const [quickTextsOpen, setQuickTextsOpen] = useState<boolean>(false);
    const [quickTextSearchTerm, setQuickTextSearchTerm] = useState<string>('');
    const [language, setLanguage] = useState<LANGUAGES>(LANGUAGES.english);
    const [isMessagingSetup, setIsMessagingSetup] = useState<boolean>(true);

    const [pendingMessageSend, setPendingMessageSend] = useState<MessageModel | undefined>();

    const { patient: patientFromAppointment, smsModel: model } = appointment;
    const timezone = DateTime.now().zoneName;

    let patientName;
    if (patientFromAppointment?.firstName || patientFromAppointment?.lastName)
      patientName = `${patientFromAppointment?.firstName || ''} ${patientFromAppointment?.lastName || ''}`;

    const numbersToSendTo = useMemo(() => {
      const numbers = (model?.recipients ?? []).map((recipient) => recipient.smsNumber);
      const uniqueNumbers = Array.from(new Set(numbers));
      if (uniqueNumbers.length === 0) {
        return undefined;
      } else {
        if (uniqueNumbers.length > 1) {
          console.log('multiple numbers associated with this patient; using first');
        }
        return uniqueNumbers;
      }
    }, [model?.recipients]);

    const sendMessagesMutation = useSendMessagesMutation(
      model?.recipients || [],
      messageText,
      (sendResult) => {
        if (sendResult) {
          setPendingMessageSend(sendResult);
          setMessageText('');
          void refetchMessages({ throwOnError: true });
        } else {
          throw new Error('send message failed - no id returned');
        }
      },
      (error) => {
        console.error('send message failure: ', error);
        setPendingMessageSend(undefined);
      }
    );

    const { isFetching: isMessagesFetching, refetch: refetchMessages } = useFetchChatMessagesQuery(
      timezone,
      patientFromAppointment.id,
      numbersToSendTo,
      (messages) => {
        if (!messages) {
          return;
        }
        _setMessages(messages);
        setPendingMessageSend(undefined);
      }
    );

    const [messages]: [MessageModel[]] = useMemo(() => {
      const pending = pendingMessageSend ? [pendingMessageSend] : [];
      const messagesToReturn = [..._messages, ...pending];
      return [messagesToReturn];
    }, [_messages, pendingMessageSend]);

    const newMessagesStartId = useMemo(() => {
      return messages.find((message) => {
        return !message.isRead;
      })?.id;
    }, [messages]);

    const hasUnreadMessages = model?.hasUnreadMessages;

    const markAllRead = async (): Promise<void> => {
      if (currentUser && oystehr && hasUnreadMessages) {
        try {
          await markAllMessagesRead({
            chat: messages,
            user: currentUser,
            oystehr,
          });
          _setMessages(
            messages.map((m) => {
              return {
                ...m,
                isRead: true,
              };
            })
          );
          onMarkAllRead();
        } catch (e) {
          console.error('failed to mark messages as read: ', e);
        }
      }
    };

    const handleSendMessage = async (event: UIEvent, message: string): Promise<void> => {
      event.preventDefault();

      if (message.trim() === '') {
        return;
      }
      if (!currentUser) {
        throw new Error(`Message send failed. Current user is not defined`);
      }
      const newPendingMessage = makePendingSentMessage(message, timezone, currentUser);
      setPendingMessageSend(newPendingMessage);
      await sendMessagesMutation.mutateAsync(newPendingMessage);

      void markAllRead();
    };

    const selectQuickText = (text: string): void => {
      setMessageText(text);
      setQuickTextsOpen(false);
    };

    const handleClose = (): void => {
      void markAllRead();
      onClose();
    };

    const { data: rawQuickTexts = [] } = useQuickTextsQuery();
    const quickTexts = useMemo(() => {
      const vars = buildQuickTextVariables(quickTextsContext);
      return rawQuickTexts.map((quickPick) => resolveQuickText(quickPick, vars));
    }, [rawQuickTexts, quickTextsContext]);
    const visibleQuickTexts = useMemo(
      () => quickTexts.filter((text) => (text[language] ?? '').trim().length > 0),
      [quickTexts, language]
    );
    const searchedQuickTexts = useMemo(() => {
      const term = quickTextSearchTerm.trim().toLowerCase();
      if (!term) return visibleQuickTexts;
      return visibleQuickTexts.filter((text) => {
        const haystack = `${text.name} ${text.english} ${text.spanish ?? ''}`.toLowerCase();
        return haystack.includes(term);
      });
    }, [visibleQuickTexts, quickTextSearchTerm]);

    const MessageBodies: JSX.Element[] = useMemo(() => {
      if (pendingMessageSend === undefined && isMessagesFetching) {
        return [];
      }
      return messages.map((message) => {
        const contentKey = message.resolvedId ?? message.id;
        const isPending = message.id === pendingMessageSend?.id || message.id === pendingMessageSend?.resolvedId;
        return (
          <MessageBody
            key={message.id}
            isPending={isPending}
            contentKey={contentKey}
            message={message}
            hasNewMessageLine={newMessagesStartId !== undefined && message.id === newMessagesStartId}
            showDaySent={true} //keeping this config in case minds change again, YAGNI, I know
            timezone={timezone}
          />
        );
      });
    }, [isMessagesFetching, messages, newMessagesStartId, pendingMessageSend, timezone]);

    useEffect(() => {
      if (MessageBodies.length) {
        scrollToBottomOfChat();
      }
    }, [MessageBodies.length]);

    const { isLoading: isMessagingConfigLoading } = useGetMessagingConfigQuery(
      (data) => {
        if (!data?.transactionalSMSConfig && !data?.conversationConfig) {
          setIsMessagingSetup(false);
        }
      },
      // todo: Need to change this when sdk is updated to return code in response instead of 404
      () => setIsMessagingSetup(false)
    );

    const handleSetup = (): void => {
      window.open('https://docs.oystehr.com/ottehr/setup/messaging/', '_blank');
    };

    return (
      <Dialog
        open={true}
        onClose={handleClose}
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        maxWidth="md"
        fullWidth
      >
        <form>
          <Grid container>
            <Grid item xs={12} sx={{ margin: '24px 24px 16px 24px' }}>
              <Typography id="modal-title" variant="h4" sx={{ fontWeight: 600, color: theme.palette.primary.dark }}>
                Chat with {patientName || getPatientName(patient?.name).firstLastName}
              </Typography>
              <Typography
                id="modal-description"
                variant="h5"
                data-testid={dataTestIds.telemedEhrFlow.chatModalDescription}
                sx={{ fontWeight: 600, color: theme.palette.primary.dark }}
              >
                {numbersToSendTo ? numbersToSendTo.join(', ') : ''}
              </Typography>
              <IconButton
                aria-label="Close"
                onClick={handleClose}
                sx={{
                  position: 'absolute',
                  right: 16,
                  top: 16,
                }}
              >
                <Close />
              </IconButton>
            </Grid>
            <Grid item xs={12}>
              <Divider />
            </Grid>
          </Grid>
          <Grid
            container
            id="message-container"
            sx={{ height: '400px', overflowY: 'scroll', padding: '24px 32px 16px 24px' }}
          >
            {(pendingMessageSend === undefined && isMessagesFetching) || isMessagingConfigLoading ? (
              <Grid
                item
                xs={12}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CircularProgress />
              </Grid>
            ) : (
              <>{MessageBodies}</>
            )}
          </Grid>
          {!isMessagingSetup && !isMessagingConfigLoading && (
            <Grid item sx={{ margin: '24px' }}>
              <CompleteConfiguration handleSetup={handleSetup} />
            </Grid>
          )}
          <Divider />
          <Grid container sx={{ margin: '16px 0 16px 24px', width: 'auto' }}>
            <Grid item xs={8.35}>
              <TextField
                id="patient-message"
                label="Message to the patient"
                value={messageText}
                disabled={pendingMessageSend !== undefined}
                autoComplete="off"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setMessageText(event.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    await handleSendMessage(e, messageText);
                  }
                }}
                fullWidth
                multiline
                inputProps={{ maxLength: 300 }}
                helperText={`${messageText.length} / 300`}
              />
            </Grid>

            <Grid item xs={3} sx={{ alignSelf: 'center', textAlign: 'center', display: 'flex' }}>
              <LoadingButton
                sx={{ marginX: 1, borderRadius: '100px', textTransform: 'none', fontWeight: 500 }}
                variant="outlined"
                onClick={() => setQuickTextsOpen(true)}
                disabled={pendingMessageSend !== undefined}
              >
                Quick text
              </LoadingButton>
              <LoadingButton
                sx={{
                  background: theme.palette.primary.main,
                  borderRadius: '100px',
                  textTransform: 'none',
                }}
                variant="contained"
                // size="small"
                startIcon={<SendIcon />}
                onClick={(event) => handleSendMessage(event, messageText)}
                loading={pendingMessageSend !== undefined}
                type="submit"
              >
                Send
              </LoadingButton>
            </Grid>
          </Grid>
          <Dialog
            open={quickTextsOpen}
            onClose={() => setQuickTextsOpen(false)}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { borderRadius: 2 } }}
          >
            <DialogTitle
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                px: 3,
                pt: 3,
                pb: 1,
              }}
            >
              <Typography variant="h4" color="primary.dark" sx={{ fontWeight: 600 }}>
                Quick Text
              </Typography>
              <IconButton onClick={() => setQuickTextsOpen(false)} size="small">
                <Close />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ px: 3, pt: 1, pb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Select a quick text to populate the message to the patient
                </Typography>
                <ToggleButtonGroup
                  sx={{
                    '& .MuiToggleButton-sizeSmall': {
                      textTransform: 'none',
                      color: theme.palette.primary.main,
                      fontSize: '13px',
                      fontWeight: 500,
                    },
                    '& .MuiToggleButton-sizeSmall:hover': {
                      color: theme.palette.primary.contrastText,
                      backgroundColor: theme.palette.primary.light,
                    },
                    '& .Mui-selected': {
                      color: `${theme.palette.primary.contrastText} !important`,
                      backgroundColor: `${theme.palette.primary.main} !important`,
                      textTransform: 'none',
                    },
                  }}
                  size="small"
                  exclusive
                  value={language}
                  onChange={(_e: React.MouseEvent<HTMLElement>, value: LANGUAGES) => {
                    if (value) setLanguage(value);
                  }}
                >
                  <ToggleButton value={LANGUAGES.english} sx={{ padding: '4px 10px 4px 10px' }}>
                    English
                  </ToggleButton>
                  <ToggleButton value={LANGUAGES.spanish} sx={{ padding: '4px 10px 4px 10px' }}>
                    Spanish
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <TextField
                fullWidth
                size="small"
                placeholder="Search quick texts"
                value={quickTextSearchTerm}
                onChange={(e) => setQuickTextSearchTerm(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {quickTextSearchTerm.length > 0 ? (
                        <IconButton
                          aria-label="clear search"
                          onClick={() => setQuickTextSearchTerm('')}
                          onMouseDown={(event) => event.preventDefault()}
                          size="small"
                          sx={{ p: 0 }}
                        >
                          <Close fontSize="small" />
                        </IconButton>
                      ) : (
                        <Search fontSize="small" />
                      )}
                    </InputAdornment>
                  ),
                }}
              />
              <Box sx={{ height: 360, overflowY: 'auto' }}>
                {visibleQuickTexts.length === 0 ? (
                  <Typography variant="body2" sx={{ p: 1, color: theme.palette.text.secondary }}>
                    No quick texts configured. Admins can add them in EHR Admin → Quick Picks → Quick Texts.
                  </Typography>
                ) : searchedQuickTexts.length === 0 ? (
                  <Typography variant="body2" sx={{ p: 1, color: theme.palette.text.secondary }}>
                    No quick texts match your search.
                  </Typography>
                ) : (
                  <List sx={{ padding: 0 }}>
                    {searchedQuickTexts.map((text, index) => {
                      const body = text[language] ?? '';
                      return (
                        <ListItem
                          key={`${index}-${text.name}`}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            padding: 1,
                            my: '8px',
                            borderRadius: 1,
                            backgroundColor: 'rgba(77, 21, 183, 0.04)',
                            cursor: 'pointer',
                            transition: 'background-color 120ms ease',
                            '&:hover': {
                              backgroundColor: 'rgba(77, 21, 183, 0.12)',
                            },
                          }}
                          onClick={() => selectQuickText(body)}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.primary.dark }}>
                            {text.name}
                          </Typography>
                          <Typography variant="body2">{body}</Typography>
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </Box>
            </DialogContent>
          </Dialog>
        </form>
      </Dialog>
    );
  }
);

export default ChatModal;

interface MessageBodyProps {
  isPending: boolean;
  hasNewMessageLine: boolean;
  message: ConversationMessage;
  contentKey: string;
  showDaySent: boolean;
  timezone: Timezone;
}
const MessageBody: React.FC<MessageBodyProps> = (props) => {
  const { isPending, message, contentKey, hasNewMessageLine, showDaySent, timezone } = props;
  const theme = useTheme();
  const authorInitials = initialsFromName(message.sender);

  const sentTimeLabel = (() => {
    if (!message.sentTime || !message.sentDay) return '';
    const sentDate = DateTime.fromFormat(`${message.sentDay} ${message.sentTime}`, 'M/d/yy h:mm a', {
      zone: timezone,
    });

    return sentDate.toFormat('M/d/yy h:mm a ZZZZ', { locale: 'en-US' });
  })();

  return (
    <Grid container item key={contentKey} spacing={3} sx={{ opacity: isPending ? '0.5' : '1.0' }}>
      {hasNewMessageLine && (
        <Grid item xs={12}>
          <Divider
            sx={{
              '&::before, &::after': { borderTop: `thin solid ${theme.palette.warning.main}` },
              color: theme.palette.warning.main,
            }}
          >
            New messages
          </Divider>
        </Grid>
      )}
      <Grid item container display={'table-row-group'} xs={12} spacing={0}>
        {showDaySent && (
          <Grid item xs={12} sx={{ paddingBottom: '0px' }}>
            <Typography
              variant="body1"
              color={'rgb(0, 0, 0, 0.7)'}
              textAlign="center"
              sx={{
                paddingTop: '40px',
              }}
            >
              {`${sentTimeLabel}`}
            </Typography>
          </Grid>
        )}
        <Grid
          item
          container
          xs={12}
          display={'table-row'}
          sx={{
            opacity: isPending ? '0.5' : '1.0',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          <Avatar
            sx={{
              backgroundColor: message.isFromPatient ? theme.palette.secondary.main : theme.palette.primary.main,
              fontSize: authorInitials.length > 3 ? '12px' : '16px',
              marginInlineEnd: '8px',
            }}
          >
            {authorInitials}
          </Avatar>
          <Typography variant="body1" color="primary.dark" fontWeight={600}>
            {message.sender}
          </Typography>
        </Grid>
        <Grid
          item
          container
          display={'table-row'}
          xs={12}
          sx={{
            opacity: isPending ? '0.5' : '1.0',
            padding: '2px',
            paddingTop: '8px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <Grid item xs={11}>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line', paddingBottom: '20px', wordWrap: 'break-word' }}>
              {message.content}
            </Typography>
          </Grid>
          <Grid item xs={1}>
            {/*
              more yagni...
              <Typography variant="body1" color={'rgb(0, 0, 0, 0.7)'} sx={{ marginLeft: '10px' }} textAlign="right">
              {message.sentTime}
            </Typography>
            */}
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
};
