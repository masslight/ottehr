import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import { Alert, Box, Button, CircularProgress, Divider, Drawer, IconButton, Stack, Typography } from '@mui/material';
import { FC, useEffect, useMemo } from 'react';
import { ChatList } from './ChatList';
import {
  closeEmployeeChatDrawer,
  loadMissingPreviews,
  loadOlderMessages,
  markActiveConversationSeen,
  openChatWithEmployee,
  openConversation,
  retryEmployeeChat,
  sendChatMessage,
  showChatList,
} from './employee-chat.connection';
import { useEmployeeChatStore } from './employee-chat.store';
import { visibleChats } from './employee-chat.utils';
import { EmployeeAvatar } from './EmployeeAvatar';
import { EmployeeSearch } from './EmployeeSearch';
import { MessageComposer } from './MessageComposer';
import { MessageList } from './MessageList';
import { useChatEmployees } from './useChatEmployees';

export const EmployeeChatDrawer: FC = () => {
  const drawerOpen = useEmployeeChatStore((state) => state.drawerOpen);
  const status = useEmployeeChatStore((state) => state.status);
  const error = useEmployeeChatStore((state) => state.error);
  const view = useEmployeeChatStore((state) => state.view);
  const chats = useEmployeeChatStore((state) => state.chats);
  const activeSid = useEmployeeChatStore((state) => state.activeSid);
  const messages = useEmployeeChatStore((state) => state.messages);
  const loadingMessages = useEmployeeChatStore((state) => state.loadingMessages);
  const hasOlderMessages = useEmployeeChatStore((state) => state.hasOlderMessages);
  const loadingOlder = useEmployeeChatStore((state) => state.loadingOlder);
  const openingProfile = useEmployeeChatStore((state) => state.openingProfile);
  const openError = useEmployeeChatStore((state) => state.openError);
  const myProfile = useEmployeeChatStore((state) => state.myProfile);
  const unreadEntry = useEmployeeChatStore((state) => state.unreadEntry);

  const { data: employees, isLoading: employeesLoading } = useChatEmployees({ enabled: drawerOpen, myProfile });
  const listItems = useMemo(() => visibleChats(chats, activeSid), [chats, activeSid]);
  const activeChat = activeSid ? chats[activeSid] : undefined;
  const connected = status === 'connected';
  const chatSidsKey = Object.keys(chats).sort().join(',');

  useEffect(() => {
    if (drawerOpen && view === 'list' && connected) {
      void loadMissingPreviews();
    }
  }, [drawerOpen, view, connected, chatSidsKey]);

  return (
    <Drawer
      anchor="right"
      open={drawerOpen}
      onClose={closeEmployeeChatDrawer}
      PaperProps={{ sx: { width: { xs: '100%', sm: 420 }, display: 'flex', flexDirection: 'column' } }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.5 }}>
        {view === 'conversation' && (
          <IconButton onClick={showChatList} aria-label="Back to chats" edge="start">
            <ArrowBackIcon />
          </IconButton>
        )}
        {view === 'conversation' && activeChat && <EmployeeAvatar employee={activeChat.otherEmployee} size={32} />}
        <Typography variant="h5" color="primary.dark" sx={{ fontWeight: 'bold', flex: 1 }} noWrap>
          {view === 'conversation' ? activeChat?.otherEmployee.name ?? 'Chat' : 'Chats'}
        </Typography>
        <IconButton onClick={closeEmployeeChatDrawer} aria-label="Close chats">
          <CloseIcon />
        </IconButton>
      </Stack>
      <Divider />

      {status === 'connecting' && (
        <Stack alignItems="center" sx={{ mt: 4 }}>
          <CircularProgress size={24} />
        </Stack>
      )}
      {status === 'reconnecting' && (
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          Reconnecting…
        </Alert>
      )}
      {status === 'error' && (
        <Alert
          severity="error"
          sx={{ borderRadius: 0 }}
          action={
            <Button color="inherit" size="small" onClick={() => void retryEmployeeChat()}>
              Retry
            </Button>
          }
        >
          {error ?? 'Chat failed to connect'}
        </Alert>
      )}
      {openError && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {openError}
        </Alert>
      )}

      {view === 'list' && status !== 'connecting' && (
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <Box sx={{ p: 2 }}>
            <EmployeeSearch
              employees={employees ?? []}
              loading={employeesLoading || openingProfile !== undefined}
              disabled={!connected || openingProfile !== undefined}
              onSelect={(employee) => void openChatWithEmployee(employee.profile)}
            />
          </Box>
          <ChatList chats={listItems} onOpen={(sid) => void openConversation(sid)} />
        </Box>
      )}

      {view === 'conversation' && (
        <>
          <MessageList
            key={activeSid}
            messages={messages}
            entryId={unreadEntry?.sid === activeSid ? unreadEntry?.id : undefined}
            dividerIndex={unreadEntry?.sid === activeSid ? unreadEntry?.dividerIndex : undefined}
            unreadAbove={unreadEntry?.sid === activeSid && unreadEntry?.unreadAbove === true}
            otherName={activeChat?.otherEmployee.name ?? ''}
            loading={loadingMessages}
            hasOlderMessages={hasOlderMessages}
            loadingOlder={loadingOlder}
            onLoadOlder={() => void loadOlderMessages()}
            onSeen={markActiveConversationSeen}
          />
          <Divider />
          <Box sx={{ p: 2 }}>
            <MessageComposer key={activeSid} disabled={!connected || loadingMessages} onSend={sendChatMessage} />
          </Box>
        </>
      )}
    </Drawer>
  );
};
