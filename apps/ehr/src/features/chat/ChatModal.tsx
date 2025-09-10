import { Close } from '@mui/icons-material';
import SendIcon from '@mui/icons-material/Send';
import { LoadingButton } from '@mui/lab';
import {
  Avatar,
  Box,
  CircularProgress,
  Dialog,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  Modal,
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
import { AppointmentMessaging, ConversationMessage, initialsFromName, markAllMessagesRead, Timezone } from 'utils';
import { CompleteConfiguration } from '../../components/CompleteConfiguration';
import { LANGUAGES } from '../../constants';
import { dataTestIds } from '../../constants/data-test-ids';
import { useApiClients } from '../../hooks/useAppClients';
import useEvolveUser, { EvolveUser } from '../../hooks/useEvolveUser';
import { getPatientName, removeHtmlTags } from '../../telemed/utils';
import { useFetchChatMessagesQuery, useGetMessagingConfigQuery, useSendMessagesMutation } from './chat.queries';

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
    quickTexts,
  }: {
    appointment: AppointmentMessaging;
    patient?: Patient;
    currentLocation?: LocationWithWalkinSchedule;
    onClose: () => void;
    onMarkAllRead: () => void;
    quickTexts: { [key in LANGUAGES]: string | undefined }[] | string[];
  }): ReactElement => {
    const theme = useTheme();
    const { oystehr } = useApiClients();
    const currentUser = useEvolveUser();
    const [_messages, _setMessages] = useState<MessageModel[]>([]);
    const [messageText, setMessageText] = useState<string>('');
    const [quickTextsOpen, setQuickTextsOpen] = useState<boolean>(false);
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

    const quickTextStyle = {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: 'sm',
      bgcolor: 'background.paper',
      boxShadow: 24,
      borderRadius: '4px',
      p: '8px 16px',
    };

    const selectQuickText = (text: string): void => {
      setMessageText(text);
      setQuickTextsOpen(false);
    };

    const handleClose = (): void => {
      void markAllRead();
      onClose();
    };

    const hasQuickTextTranslations = (quickTexts: any): quickTexts is { [key in LANGUAGES]: string | undefined }[] => {
      return typeof quickTexts[0] === 'object';
    };

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

    const { isLoading: isMessagingConfigLoading } = useGetMessagingConfigQuery((data) => {
      if (!data) {
        return;
      }
      if (!data.transactionalSMSConfig && !data.conversationConfig) {
        setIsMessagingSetup(false);
      }
    });

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
                {numbersToSendTo ? numbersToSendTo.join(',') : ''}
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
          <Grid container sx={{ margin: '16px 0 16px 24px' }}>
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
          <Modal
            open={quickTextsOpen}
            onClose={() => {
              setQuickTextsOpen(false);
            }}
          >
            <Grid container sx={quickTextStyle}>
              <Grid item sx={{ marginTop: '6px', width: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: '600 !important', color: theme.palette.primary.main, marginBottom: '4px' }}
                  >
                    Quick texts
                  </Typography>
                  {hasQuickTextTranslations(quickTexts) && (
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
                      onChange={(e: React.MouseEvent<HTMLElement>, value: LANGUAGES) => {
                        setLanguage(value);
                      }}
                    >
                      <ToggleButton value={LANGUAGES.english} sx={{ padding: '4px 10px 4px 10px' }}>
                        English
                      </ToggleButton>
                      <ToggleButton value={LANGUAGES.spanish} sx={{ padding: '4px 10px 4px 10px' }}>
                        Spanish
                      </ToggleButton>
                    </ToggleButtonGroup>
                  )}
                </Box>
                <Typography variant="body2">Select the text to populate the message to the patient</Typography>
              </Grid>
              <Grid item>
                <List sx={{ padding: 0 }}>
                  {hasQuickTextTranslations(quickTexts)
                    ? quickTexts
                        .filter((text) => text[language])
                        .map((text) => (
                          <ListItem
                            key={text[language]}
                            sx={{
                              padding: 1,
                              my: '12px',
                              backgroundColor: 'rgba(77, 21, 183, 0.04)',
                              cursor: 'pointer',
                            }}
                            onClick={() => selectQuickText(text[language] ?? '')}
                          >
                            <Typography variant="body1">{text[language]}</Typography>
                          </ListItem>
                        ))
                    : quickTexts.map((text) => {
                        return (
                          <ListItem
                            key={text}
                            sx={{
                              padding: 1,
                              my: '12px',
                              backgroundColor: 'rgba(77, 21, 183, 0.04)',
                              cursor: 'pointer',
                            }}
                            onClick={() => selectQuickText(removeHtmlTags(text))}
                          >
                            <Typography variant="body1">{parseTextToJSX(text)}</Typography>
                          </ListItem>
                        );
                      })}
                </List>
              </Grid>
            </Grid>
          </Modal>
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
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line', paddingBottom: '20px' }}>
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

function parseTextToJSX(text: string): JSX.Element[] {
  // Split the string at the custom HTML tag
  const parts = text.split(/(<phone.*?<\/phone>)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith('<phone')) {
      // Extract the content inside the custom HTML tag
      const match = part.match(/<phone[^>]*>(.*?)<\/phone>/);
      if (match) {
        return (
          <span key={index} style={{ whiteSpace: 'nowrap' }}>
            {match[1]}
          </span>
        );
      }
    }

    return <span key={index}>{part}</span>;
  });
}
