import { FC, useContext, useMemo, useState } from 'react';
import LoadingButton from '@mui/lab/LoadingButton';
import { Alert, Snackbar, Typography, Box } from '@mui/material';
import { ConfirmationDialog, IntakeThemeContext, PageForm } from 'ui-components';
import { InvitedParticipantInfo } from 'utils';
import { useCancelInviteMutation } from '../waiting-room';

type InvitedParticipantListProps = {
  items: InvitedParticipantInfo[];
  onInviteCancelled?: () => void;
  onClose?: () => void;
};

export const InvitedParticipantList: FC<InvitedParticipantListProps> = ({ items, onInviteCancelled, onClose }) => {
  const { otherColors } = useContext(IntakeThemeContext);
  const [inviteErrorSnackbarOpen, setInviteErrorSnackbarOpen] = useState<boolean>(false);
  const cancelInviteMutation = useCancelInviteMutation();
  const invite = items[0]; // for this release we take only one invite.

  const submitCancelInvite = (emailAddress: string): void => {
    const params = {
      emailAddress: emailAddress,
    };
    cancelInviteMutation.mutate(params, {
      onSuccess: () => onInviteCancelled?.(),
      onError: () => {
        setInviteErrorSnackbarOpen(true);
      },
    });
  };

  const name = useMemo(() => [invite.firstName, invite.lastName].join(' '), [invite.firstName, invite.lastName]);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
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
            maxWidth: '100%',
          }}
        >
          <Typography variant="subtitle1" color="primary.main">
            {name}
          </Typography>
          <Typography
            variant="subtitle2"
            color="primary.main"
            sx={{
              fontWeight: 'normal',
              maxWidth: '100%',
              wordWrap: 'break-word',
            }}
          >
            {invite.emailAddress && invite.phoneNumber
              ? [invite.emailAddress, invite.phoneNumber].join(' | ')
              : invite.emailAddress || invite.phoneNumber}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            py: { xs: 1, md: 0 },
          }}
        >
          <ConfirmationDialog
            title="Cancel invite"
            description={`Are you sure you want to cancel invite for ${name} for this visit?`}
            response={() => submitCancelInvite(invite.emailAddress)}
            actionButtons={{
              proceed: {
                text: 'Cancel invite',
                color: 'destructive',
              },
              back: { text: 'Keep invite', variant: 'outlined' },
            }}
          >
            {(showDialog) => (
              <LoadingButton
                variant="text"
                loading={cancelInviteMutation.isLoading}
                color="destructive"
                size="large"
                onClick={showDialog}
              >
                Cancel invite
              </LoadingButton>
            )}
          </ConfirmationDialog>
        </Box>
      </Box>
      <Box sx={{ mt: -2 }}>
        <PageForm
          onSubmit={() => onClose?.()}
          controlButtons={{
            submitLabel: 'Done!',
            backButton: false,
            loading: cancelInviteMutation.isLoading,
          }}
        />
      </Box>
      <Snackbar
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={inviteErrorSnackbarOpen}
        autoHideDuration={5000}
        onClose={() => setInviteErrorSnackbarOpen(false)}
      >
        <Alert onClose={() => setInviteErrorSnackbarOpen(false)} severity="error" variant="filled">
          Something went wrong while trying to cancel the invitation. Please, try again.
        </Alert>
      </Snackbar>
    </Box>
  );
};
