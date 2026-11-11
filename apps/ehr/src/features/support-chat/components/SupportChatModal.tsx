import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { FC } from 'react';
import { ChatComposer } from 'ui-components/lib/components/support-chat/ChatComposer';
import { ChatMessageList } from 'ui-components/lib/components/support-chat/ChatMessageList';
import { Task } from 'utils/lib/types/data/tasks/types';
import { useTaskSupportChat } from '../hooks/useTaskSupportChat';

export interface SupportChatModalProps {
  task: Task;
  onClose: () => void;
  isCompleting?: boolean;
}

export const SupportChatModal: FC<SupportChatModalProps> = ({ task, onClose, isCompleting = false }) => {
  const chat = useTaskSupportChat(task);

  const complete = async (text: string): Promise<void> => {
    await chat.complete(text);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Stack>
          <Typography variant="h4" color="primary.dark" fontWeight={600}>
            {isCompleting ? 'Complete the request' : 'Support Chat'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {task.title}
          </Typography>
        </Stack>
        <IconButton aria-label="Close" onClick={onClose}>
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
            newMessagesLabel="New messages"
            isPending={chat.isSending}
          />
        )}
      </DialogContent>
      <Divider />
      <Box sx={{ px: 3, py: 2 }}>
        {isCompleting ? (
          <ChatComposer
            label="Message to patient (optional)"
            sendLabel="Complete"
            sendIcon={<CheckIcon />}
            isSending={chat.isSending}
            onSend={complete}
            allowEmpty
          />
        ) : (
          <ChatComposer label="Message" sendLabel="Send" isSending={chat.isSending} onSend={chat.sendReply} />
        )}
      </Box>
    </Dialog>
  );
};
