import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import { StyledListItemWithButton } from 'ottehr-components';
import { otherColors } from '../../IntakeThemeProvider';
import { useGetVideoChatInvites } from '../waiting-room';

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
  const invitedParticipants = invitesData?.invites ?? [];
  const invitedParticipantsLoading = isGetInvitesFetching || isGetInvitesLoading;

  return (
    <StyledListItemWithButton
      primaryText="Manage participants"
      secondaryText={
        invitedParticipantsLoading
          ? 'Loading...'
          : invitedParticipants.length > 0
            ? [invitedParticipants[0].firstName, invitedParticipants[0].lastName].join(' ')
            : 'No invited participants'
      }
      hideText={hideText}
      onClick={onClick}
    >
      <ManageAccountsOutlinedIcon sx={{ color: otherColors.purple }} />
    </StyledListItemWithButton>
  );
}
