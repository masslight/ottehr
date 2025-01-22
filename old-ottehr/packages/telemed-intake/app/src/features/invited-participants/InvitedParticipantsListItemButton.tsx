import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import { useTranslation } from 'react-i18next';
import { StyledListItemWithButton } from 'ottehr-components';
import { useGetVideoChatInvites } from '../waiting-room';
import { useTheme } from '@mui/system';

export function InvitedParticipantListItemButton({
  onClick,
  hideText,
}: {
  onClick: () => void;
  hideText: boolean;
}): JSX.Element {
  const {
    data: invitesData,
    isLoading: isGetInvitesLoading,
    isFetching: isGetInvitesFetching,
  } = useGetVideoChatInvites();
  const { t } = useTranslation();
  const invitedParticipants = invitesData?.invites ?? [];
  const invitedParticipantsLoading = isGetInvitesFetching || isGetInvitesLoading;
  const theme = useTheme();

  return (
    <StyledListItemWithButton
      primaryText={t('participants.manageParticipants')}
      secondaryText={
        invitedParticipantsLoading
          ? t('general.loading')
          : invitedParticipants.length > 0
            ? [invitedParticipants[0].firstName, invitedParticipants[0].lastName].join(' ')
            : t('participants.noInvitedParticipants')
      }
      hideText={hideText}
      onClick={onClick}
    >
      <ManageAccountsOutlinedIcon sx={{ color: theme.palette.primary.main }} />
    </StyledListItemWithButton>
  );
}
