import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import { Alert, Box, Button, CircularProgress, Divider, Drawer, IconButton, Stack, Typography } from '@mui/material';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { adjustTopForBannerHeight } from 'src/helpers/misc.helper';
import { ChatList } from './ChatList';
import {
  closeEmployeeChatDrawer,
  loadMissingPreviews,
  loadOlderMessages,
  markActiveConversationSeen,
  markMissedMessage,
  openChatWithEmployee,
  openConversation,
  retryConversationRecovery,
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
  const pendingEmployee = useEmployeeChatStore((state) => state.pendingEmployee);
  const openError = useEmployeeChatStore((state) => state.openError);
  const myProfile = useEmployeeChatStore((state) => state.myProfile);
  const unreadEntry = useEmployeeChatStore((state) => state.unreadEntry);
  const history = useEmployeeChatStore((state) => state.history);
  const hasOlderHistory = useEmployeeChatStore((state) => state.hasOlderHistory);
  const recovery = useEmployeeChatStore((state) => state.recovery);

  const { data: employees, isLoading: employeesLoading } = useChatEmployees({ enabled: drawerOpen, myProfile });
  const listItems = useMemo(() => visibleChats(chats, activeSid), [chats, activeSid]);
  const activeChat = activeSid ? chats[activeSid] : undefined;
  const headerEmployee = activeChat?.otherEmployee ?? pendingEmployee;
  const connected = status === 'connected';
  const activeWritable = activeSid === undefined || (activeChat !== undefined && activeChat.closed !== true);
  const chatSidsKey = Object.keys(chats).sort().join(',');
  const [focusComposerWhenReady, setFocusComposerWhenReady] = useState(false);
  const clearComposerFocusRequest = useCallback(() => setFocusComposerWhenReady(false), []);

  useEffect(() => {
    if (view === 'list' || !drawerOpen) setFocusComposerWhenReady(false);
  }, [view, drawerOpen, focusComposerWhenReady]);

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
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          display: 'flex',
          flexDirection: 'column',
          top: adjustTopForBannerHeight(0),
          height: `calc(100% - ${adjustTopForBannerHeight(0)}px)`,
        },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.5 }}>
        {view === 'conversation' && (
          <IconButton onClick={showChatList} aria-label="Back to chats" edge="start">
            <ArrowBackIcon />
          </IconButton>
        )}
        {view === 'conversation' && headerEmployee && <EmployeeAvatar employee={headerEmployee} size={32} />}
        <Typography variant="h5" color="primary.dark" sx={{ fontWeight: 'bold', flex: 1 }} noWrap>
          {view === 'conversation' ? headerEmployee?.name ?? 'Chat' : 'Chats'}
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
      {status === 'unavailable' && (
        <Alert severity="info" sx={{ borderRadius: 0 }} data-testid="employee-chat-unavailable">
          Chat isn&apos;t available in this environment.
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
      {view === 'conversation' && recovery === 'recovering' && (
        <Alert severity="info" sx={{ borderRadius: 0 }} data-testid="employee-chat-recovering">
          Reconnecting this chat…
        </Alert>
      )}
      {view === 'conversation' && recovery === 'failed' && (
        <Alert
          severity="error"
          sx={{ borderRadius: 0 }}
          data-testid="employee-chat-recovery-failed"
          action={
            <Button color="inherit" size="small" onClick={() => void retryConversationRecovery()}>
              Retry
            </Button>
          }
        >
          This chat could not be reconnected. Earlier messages are still available.
        </Alert>
      )}

      {view === 'list' && status !== 'connecting' && (
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <Box sx={{ p: 2 }}>
            <EmployeeSearch
              employees={employees ?? []}
              loading={employeesLoading}
              disabled={!connected}
              onSelect={(employee) => {
                void openChatWithEmployee(employee);
                setFocusComposerWhenReady(true);
              }}
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
            history={history}
            entryId={unreadEntry?.sid === activeSid ? unreadEntry?.id : undefined}
            dividerIndex={unreadEntry?.sid === activeSid ? unreadEntry?.dividerIndex : undefined}
            unreadAbove={unreadEntry?.sid === activeSid && unreadEntry?.unreadAbove === true}
            otherName={activeChat?.otherEmployee.name ?? ''}
            loading={loadingMessages || (recovery === 'recovering' && history.length === 0)}
            loadFailed={openError !== undefined || recovery === 'failed'}
            hasOlderMessages={hasOlderMessages || hasOlderHistory}
            loadingOlder={loadingOlder}
            onLoadOlder={() => void loadOlderMessages()}
            onSeen={markActiveConversationSeen}
            onMissedMessage={markMissedMessage}
          />
          <Divider />
          <Box sx={{ p: 2 }}>
            <MessageComposer
              key={activeSid}
              disabled={!connected || loadingMessages || recovery !== undefined || !activeWritable}
              onSend={sendChatMessage}
              focusWhenEnabled={focusComposerWhenReady}
              onFocusHandled={clearComposerFocusRequest}
            />
          </Box>
        </>
      )}
    </Drawer>
  );
};
