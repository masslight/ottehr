import React, { useEffect, useMemo, useState } from 'react';
import Typography from '@mui/material/Typography';
import SendIcon from '@mui/icons-material/Send';
import {
  Avatar,
  CircularProgress,
  Dialog,
  Divider,
  Grid,
  IconButton,
  TextField,
  useTheme,
  Modal,
  List,
  ListItem,
} from '@mui/material';
import { ChangeEvent, ReactElement } from 'react';
import { JSONObject } from '@twilio/conversations';
import { DateTime } from 'luxon';
import { LoadingButton } from '@mui/lab';
import { Close } from '@mui/icons-material';
import { useChat } from '../contexts/ChatContext';
import { formatPhoneNumber } from '../helpers/formatPhoneNumber';
import { Location } from 'fhir/r4';

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
  }, 80);
}

const ChatModal = (): ReactElement => {
  const theme = useTheme();
  const [messageText, setMessageText] = useState<string>('');
  const [sendLoading, setSendLoading] = useState<boolean>(false);
  const [quickTextsOpen, setQuickTextsOpen] = useState<boolean>(false);
  const { currentOpenChat, chatModalOpen, closeChat, chatIsLoading } = useChat();

  const { messages, newMessagesStartIndex } = useMemo(() => {
    const messages = currentOpenChat?.messages ?? [];
    const newMessagesStartIndex = currentOpenChat?.newMessagesStartIndex;
    return { messages, newMessagesStartIndex };
  }, [currentOpenChat?.messages, currentOpenChat?.newMessagesStartIndex]);

  useEffect(() => {
    if (messages.length) {
      scrollToBottomOfChat();
    }
  }, [messages]);

  async function sendMessage(event: any, message: string): Promise<void> {
    if (!currentOpenChat) {
      return;
    }
    const { sendMessage } = currentOpenChat;
    event.preventDefault();
    if (message === '') {
      return;
    }

    setSendLoading(true);
    await sendMessage(message);
    setSendLoading(false);
    setMessageText('');
  }

  let recentAuthor: string | null = null;
  let authorName: string | null = null;

  // todo need to check this case accessibility
  if (chatIsLoading) {
    <Dialog
      open={chatModalOpen}
      onClose={() => {
        setMessageText('');
        closeChat();
      }}
      aria-labelledby="modal-title"
      maxWidth="md"
      fullWidth
    >
      <Typography id="modal-title" variant="h4" sx={{ fontWeight: 600, color: theme.palette.primary.dark }}>
        Loading chat...
      </Typography>
      <CircularProgress />
    </Dialog>;
  }

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
    officePhoneNumber = formatPhoneNumber(officePhoneNumber);
  }

  const VITE_APP_QRS_URL = import.meta.env.VITE_APP_QRS_URL;

  const quickTexts = [
    // todo need to make url dynamic or pull from location
    `Please complete the paperwork and sign consent forms to avoid a delay in check-in. For ${currentOpenChat?.patientParticipant.firstName}, click here: ${VITE_APP_QRS_URL}/visit/${currentOpenChat?.patientParticipant.appointmentId}`,
    'We are now ready to check you in. Please head to the front desk to complete the process.',
    'We are ready for the patient to be seen, please enter the facility.',
    `OttEHR is trying to get ahold of you. Please call us at ${officePhoneNumber} or respond to this text message.`,
  ];

  const selectQuickText = (text: string): void => {
    setMessageText(text);
    setQuickTextsOpen(false);
  };

  return (
    <Dialog
      open={chatModalOpen}
      onClose={() => {
        setMessageText('');
        closeChat();
      }}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      maxWidth="md"
      fullWidth
    >
      <form>
        <Grid container>
          <Grid item xs={12} sx={{ margin: '24px 24px 16px 24px' }}>
            <Typography id="modal-title" variant="h4" sx={{ fontWeight: 600, color: theme.palette.primary.dark }}>
              Chat with {currentOpenChat?.patientParticipant.name}
            </Typography>
            <Typography id="modal-description" variant="h5" sx={{ fontWeight: 600, color: theme.palette.primary.dark }}>
              {currentOpenChat?.patientParticipant.phoneNumber ?? ''}
            </Typography>
            <IconButton
              aria-label="Close"
              onClick={() => {
                setMessageText('');
                closeChat();
              }}
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
          {/* <Typography id="modal-modal-description" sx={{ mt: 1, fontSize: '16px', fontWeight: 400, color: '#333333' }}>
            Patient - {`${(patient as Patient)?.telecom?.[0]?.value}`}
          </Typography> */}

          {/* Content */}
        </Grid>
        <Grid
          container
          id="message-container"
          sx={{ maxHeight: '500px', overflowY: 'scroll', padding: '24px 32px 16px 24px' }}
        >
          {currentOpenChat &&
            messages.map((message, _i) => {
              let authorElement = null;
              let authorInitials = '';

              // If the message author starts with a + it is
              // from a phone number, which means it's from
              // a patient. The staff communicates using
              // chat on the website.
              const patientSender = message.author?.startsWith('+');
              if (patientSender) {
                authorInitials = currentOpenChat.patientParticipant.initials;
                authorName = currentOpenChat.patientParticipant.name;
              } else {
                authorName = (message.attributes as JSONObject)['senderName'] as string;
                if (!authorName) {
                  authorName = 'Staff';
                }
                authorInitials = authorName
                  .split(' ')
                  .map((item) => item.charAt(0))
                  .join('');
              }

              if (authorName !== recentAuthor) {
                authorElement = (
                  <>
                    <Grid item xs={0.8} marginTop={2}>
                      <Avatar
                        sx={{
                          backgroundColor: patientSender ? theme.palette.secondary.main : theme.palette.primary.main,
                        }}
                      >
                        {authorInitials}
                      </Avatar>
                    </Grid>
                    <Grid item xs={11.2} marginTop={2} alignSelf="center">
                      <Typography variant="body1" color="primary.dark" fontWeight={600}>
                        {authorName}
                      </Typography>
                    </Grid>
                  </>
                );
              }
              recentAuthor = authorName;

              let newMessageLineElement = null;
              // only new message if the sender is a patient
              if (newMessagesStartIndex && patientSender && message.index === newMessagesStartIndex) {
                newMessageLineElement = (
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
                );
              }
              return (
                <span key={message.sid} style={{ display: 'contents' }}>
                  {newMessageLineElement}
                  {authorElement}
                  <Grid item xs={8} marginTop={2}>
                    <Typography variant="body1" style={{ whiteSpace: 'pre-line' }}>
                      {message.body}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body1" color={'rgb(0, 0, 0, 0.7)'} textAlign="right">
                      {message.dateCreated
                        ? DateTime.fromJSDate(message.dateCreated).toLocaleString(DateTime.DATETIME_SHORT)
                        : 'Unknown'}
                    </Typography>
                  </Grid>
                </span>
              );
            })}
        </Grid>
        <Divider />
        <Grid container sx={{ margin: '16px 0 16px 24px' }}>
          <Grid item xs={8.35}>
            <TextField
              id="patient-message"
              label="Message to the patient"
              value={messageText}
              onPaste={(e) => e.preventDefault()}
              autoComplete="off"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setMessageText(event.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  await sendMessage(e, messageText);
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
              onClick={(event) => sendMessage(event, messageText)}
              loading={sendLoading}
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
};

export default ChatModal;
