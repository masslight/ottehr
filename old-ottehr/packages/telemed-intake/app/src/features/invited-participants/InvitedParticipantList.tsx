import LoadingButton from '@mui/lab/LoadingButton';
import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import { FC, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { IntakeThemeContext } from 'ottehr-components';
import { InvitedParticipantInfo } from 'ottehr-utils';
import { useCancelInviteMutation } from '../waiting-room';

type InvitedParticipantListProps = {
  items: InvitedParticipantInfo[];
  onInviteCancelled?: () => void;
};

export const InvitedParticipantList: FC<InvitedParticipantListProps> = ({ items, onInviteCancelled }) => {
  const { otherColors } = useContext(IntakeThemeContext);
  const { t } = useTranslation();
  const cancelInviteMutation = useCancelInviteMutation();
  const invite = items[0]; // for this release we take only one invite.

  const submitCancelInvite = (emailAddress: string): void => {
    const params = {
      emailAddress: emailAddress,
    };
    cancelInviteMutation.mutate(params, { onSuccess: () => onInviteCancelled?.() });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        backgroundColor: otherColors.coachingVisit,
        padding: '16px',
        borderRadius: '8px',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
        }}
      >
        <Typography variant="subtitle1" color="primary.main">
          {[invite.firstName, invite.lastName].join(' ')}
        </Typography>
        <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 'normal' }}>
          {[invite.emailAddress, invite.phoneNumber].join(' | ')}
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'flex',
        }}
      >
        <LoadingButton
          variant="outlined"
          disabled={false}
          loading={cancelInviteMutation.isLoading}
          color="destructive"
          sx={{
            // align button to right if no back button
            mt: { xs: 1, md: 0 },
            ml: { xs: 0, md: 'auto' },
            alignSelf: 'center',
            backgroundColor: '#FFFFFF',
            '&:hover': { backgroundColor: '#FFFFFF' },
          }}
          size="large"
          type="submit"
          onClick={(event) => {
            event.preventDefault();
            submitCancelInvite(invite.emailAddress);
          }}
        >
          {t('participants.cancelInvite')}
        </LoadingButton>
      </Box>
    </Box>
  );
};
