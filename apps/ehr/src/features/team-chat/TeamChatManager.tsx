import { Button } from '@mui/material';
import { closeSnackbar, enqueueSnackbar, SnackbarKey } from 'notistack';
import { FC, useCallback, useEffect } from 'react';
import { FEATURE_FLAGS } from '../../constants/feature-flags';
import { useApiClients } from '../../hooks/useAppClients';
import useEvolveUser from '../../hooks/useEvolveUser';
import { connectTeamChat, disconnectTeamChat, openTeamChatDrawer } from './team-chat.connection';
import { TeamChatMessage } from './team-chat.store';

// Renderless component mounted once at the app root. Owns the Twilio connection
// lifecycle so mention notifications arrive even while the chat drawer is closed.
export const TeamChatManager: FC = () => {
  const { oystehrZambda } = useApiClients();
  const user = useEvolveUser();
  const myProfile = user?.profile;
  const myName = user?.userName;

  const handleMention = useCallback((message: TeamChatMessage) => {
    const sender = message.attributes.senderName ?? 'Someone';
    enqueueSnackbar(`${sender} mentioned you in Team Chat`, {
      variant: 'info',
      action: (key: SnackbarKey) => (
        <Button
          color="inherit"
          size="small"
          onClick={() => {
            closeSnackbar(key);
            openTeamChatDrawer();
          }}
        >
          Open
        </Button>
      ),
    });
  }, []);

  useEffect(() => {
    if (!FEATURE_FLAGS.TEAM_CHAT_ENABLED) return;
    if (!oystehrZambda || !myProfile?.startsWith('Practitioner/') || !myName) return;
    void connectTeamChat({ oystehrZambda, myProfile, myName, onMention: handleMention });
    return () => {
      disconnectTeamChat();
    };
  }, [oystehrZambda, myProfile, myName, handleMention]);

  return null;
};
