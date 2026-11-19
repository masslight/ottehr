import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatComposer } from 'ui-components/lib/components/support-chat/ChatComposer';
import { ChatMessageList } from 'ui-components/lib/components/support-chat/ChatMessageList';
import { dataTestIds } from '../../../helpers/data-test-ids';
import { useSupportChat } from '../hooks/useSupportChat';
import { closeSupportChat } from '../support-chat.store';

export const SupportChatDialog: FC = () => {
  const { t } = useTranslation();
  const chat = useSupportChat();

  return (
    <Dialog open onClose={closeSupportChat} maxWidth="md" fullWidth data-testid={dataTestIds.supportChatDialog}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 3 }}>
        <Typography variant="h2" component="span" color="primary.main">
          {t('supportChat.title')}
        </Typography>
        <IconButton aria-label={t('supportChat.close')} onClick={closeSupportChat}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ height: '60vh' }}>
        {chat.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <ChatMessageList
            messages={chat.messages}
            firstUnreadId={chat.firstUnreadId}
            activePromptId={chat.activePromptId}
            newMessagesLabel={t('supportChat.newMessages')}
            patientAuthorLabel={t('supportChat.you')}
            onOptionClick={chat.selectOption}
            isPending={chat.isSending}
          />
        )}
      </DialogContent>
      <Divider />
      <Box sx={{ px: 3, py: 2 }}>
        {chat.hasSendError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t('supportChat.sendError')}
          </Alert>
        )}
        <ChatComposer
          label={t('supportChat.message')}
          sendLabel={t('supportChat.send')}
          isSending={chat.isSending}
          onSend={chat.sendText}
          buttonColor="secondary"
          leadingSlot={
            <Tooltip title={t('supportChat.newRequest')}>
              <IconButton
                aria-label={t('supportChat.newRequest')}
                onClick={chat.startNewRequest}
                disabled={chat.isSending}
                data-testid={dataTestIds.supportChatNewRequestButton}
                sx={{
                  bgcolor: 'secondary.main',
                  color: 'secondary.contrastText',
                  '&:hover': { bgcolor: 'secondary.dark' },
                }}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
          }
        />
      </Box>
    </Dialog>
  );
};
