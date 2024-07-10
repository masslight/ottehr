import { Close } from '@mui/icons-material';
import SendIcon from '@mui/icons-material/Send';
import { LoadingButton } from '@mui/lab';
import {
  Avatar,
  CircularProgress,
  Dialog,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  Modal,
  TextField,
  useTheme,
} from '@mui/material';
import Typography from '@mui/material/Typography';
import { Location } from 'fhir/r4';
import { DateTime } from 'luxon';
import { ChangeEvent, ReactElement, UIEvent, memo, useEffect, useMemo, useState } from 'react';
import {
  AppointmentMessaging,
  ConversationMessage,
  initialsFromName,
  markAllMessagesRead,
  standardizePhoneNumber,
} from 'ehr-utils';
import { useApiClients } from '../../hooks/useAppClients';
import useOttehrUser, { OttehrUser } from '../../hooks/useOttehrUser';
import { useFetchChatMessagesQuery, useSendMessagesMutation } from './chat.queries';

interface PatientParticipant {
  firstName: string;
  name: string;
  initials: string;
  appointmentId: string;
}

function scrollToBottomOfChat(): void {
  // this helps with the scroll working,
  // not sure why setting it to 0 works.
  // maybe the element scrollheight isn't set
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

const makePendingSentMessage = (text: string, timezone: string, sender: OttehrUser): MessageModel => {
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

// eslint-disable-next-line react/display-name
const ChatModal = memo(
  ({
    appointment,
    currentLocation,
    onClose,
    onMarkAllRead,
  }: {
    appointment: AppointmentMessaging;
    currentLocation?: Location;
    onClose: () => void;
    onMarkAllRead: () => void;
  }): ReactElement => {
    const theme = useTheme();
    const { fhirClient } = useApiClients();
    const currentUser = useOttehrUser();
    const [_messages, _setMessages] = useState<MessageModel[]>([]);
    const [messageText, setMessageText] = useState<string>('');
    const [quickTextsOpen, setQuickTextsOpen] = useState<boolean>(false);

    const [pendingMessageSend, setPendingMessageSend] = useState<MessageModel | undefined>();

    const model = appointment?.smsModel;
    const timezone = useMemo(() => {
      // const state = currentLocation?.address?.state;
      return (
        currentLocation?.extension?.find((ext) => {
          return ext.url === 'http://hl7.org/fhir/StructureDefinition/timezone';
        })?.valueString ?? 'America/New_York'
      );
    }, [currentLocation]);

    const patientParticipant = getPatientParticipantFromAppointment(appointment);

    const numbersToSendTo = useMemo(() => {
      const numbers = (model?.recipients ?? []).map((recip) => recip.smsNumber);
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
      },
    );

    const { isFetching: isMessagesFetching, refetch: refetchMessages } = useFetchChatMessagesQuery(
      timezone,
      numbersToSendTo,
      (messages) => {
        _setMessages(messages);
        setPendingMessageSend(undefined);
      },
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

    useEffect(() => {
      if (messages.length) {
        scrollToBottomOfChat();
      }
    }, [messages]);

    const hasUnreadMessages = appointment?.smsModel?.hasUnreadMessages;

    const markAllRead = async (): Promise<void> => {
      if (currentUser && fhirClient && hasUnreadMessages) {
        try {
          await markAllMessagesRead({
            chat: messages,
            user: currentUser,
            fhirClient,
          });
          _setMessages(
            messages.map((m) => {
              return {
                ...m,
                isRead: true,
              };
            }),
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

    const locationInStorage = localStorage.getItem('selectedLocation');
    let officePhoneNumber: string | undefined;
    if (locationInStorage) {
      const location: Location | undefined = JSON.parse(locationInStorage);
      officePhoneNumber = location?.telecom?.find((telecomTemp) => telecomTemp.system === 'phone')?.value;
      officePhoneNumber = standardizePhoneNumber(officePhoneNumber);
    }

    const VITE_APP_QRS_URL = import.meta.env.VITE_APP_QRS_URL;

    const quickTexts = [
      // todo need to make url dynamic or pull from location
      `Please complete the paperwork and sign consent forms to avoid a delay in check-in. For ${patientParticipant?.firstName}, click here: ${VITE_APP_QRS_URL}/visit/${patientParticipant?.appointmentId}`,
      'We are now ready to check you in. Please head to the front desk to complete the process.',
      'We are ready for the patient to be seen, please enter the facility.',
      `Ottehr is trying to get ahold of you. Please call us at ${officePhoneNumber} or respond to this text message.`,
    ];

    const selectQuickText = (text: string): void => {
      setMessageText(text);
      setQuickTextsOpen(false);
    };

    const handleClose = (): void => {
      void markAllRead();
      onClose();
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
                Chat with {patientParticipant?.name}
              </Typography>
              <Typography
                id="modal-description"
                variant="h5"
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
            {pendingMessageSend === undefined && isMessagesFetching ? (
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
              messages.map((message) => {
                const contentKey = message.resolvedId ?? message.id;
                const isPending =
                  message.id === pendingMessageSend?.id || message.id === pendingMessageSend?.resolvedId;
                return (
                  <MessageBody
                    key={message.id}
                    isPending={isPending}
                    contentKey={contentKey}
                    message={message}
                    hasNewMessageLine={newMessagesStartId !== undefined && message.id === newMessagesStartId}
                    showDaySent={true} //keeping this config incase minds change again, YAGNI, I know
                  />
                );
              })
            )}
          </Grid>
          <Divider />
          <Grid container sx={{ margin: '16px 0 16px 24px' }}>
            <Grid item xs={8.35}>
              <TextField
                id="patient-message"
                label="Message to the patient"
                value={messageText}
                onPaste={(e) => e.preventDefault()}
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
                sx={{ marginX: 1, borderRadius: '100px', textTransform: 'none', fontWeight: 700 }}
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
              <Grid item sx={{ marginTop: '6px' }}>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: '600 !important', color: theme.palette.primary.main, marginBottom: '4px' }}
                >
                  Quick texts
                </Typography>
                <Typography variant="body2">Select the text to populate the message to the patient</Typography>
              </Grid>
              <Grid item>
                <List sx={{ padding: 0 }}>
                  {quickTexts.map((text) => {
                    return (
                      <ListItem
                        key={`${text}`}
                        sx={{ padding: 1, my: '12px', backgroundColor: 'rgba(77, 21, 183, 0.04)', cursor: 'pointer' }}
                        onClick={() => selectQuickText(text)}
                      >
                        <Typography variant="body1" id={text}>
                          {text}
                        </Typography>
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
  },
);

export default ChatModal;

interface MessageBodyProps {
  isPending: boolean;
  hasNewMessageLine: boolean;
  message: ConversationMessage;
  contentKey: string;
  showDaySent: boolean;
}
const MessageBody: React.FC<MessageBodyProps> = (props: MessageBodyProps) => {
  const { isPending, message, contentKey, hasNewMessageLine, showDaySent } = props;
  const theme = useTheme();
  const authorInitials = useMemo(() => {
    return initialsFromName(message.sender);
  }, [message.sender]);
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
              {`${message.sentDay} ${message.sentTime}`}
            </Typography>
          </Grid>
        )}
        <Grid
          item
          xs={12}
          display={'table-row'}
          spacing={1}
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

const getPatientParticipantFromAppointment = (appointment: AppointmentMessaging): PatientParticipant | undefined => {
  if (!appointment.patient) {
    return undefined;
  }
  const firstName = appointment.patient.firstName || '';
  const lastName = appointment.patient.lastName || '';
  const initials = `${firstName?.charAt(0) || ''} ${lastName?.charAt(0) || ''}`;
  const name = `${firstName} ${lastName}`;

  return {
    firstName,
    name,
    initials,
    appointmentId: appointment.id,
  };
};
