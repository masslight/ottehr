import { Box, CircularProgress, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { FC } from 'react';
import api from '../api/ottehrApi';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';
import { CustomDialog } from './CustomDialog';
import PageForm from './PageForm';

type ContactSupportDialogProps = { onClose: () => void };

const SUPPORT_DIALOG_TITLE = 'Need help?';

export const ContactSupportDialog: FC<ContactSupportDialogProps> = ({ onClose }) => {
  const zambdaClient = useUCZambdaClient({ tokenless: true });

  const { data, isPending, isError } = useQuery({
    queryKey: ['public-support-dialog'],
    queryFn: () => api.getPublicSupportDialog(zambdaClient!),
    enabled: !!zambdaClient,
    staleTime: 5 * 60_000,
  });

  const bodyHtml = data?.bodyHtml?.trim();

  return (
    <CustomDialog open={true} onClose={onClose}>
      <Typography variant="h2" color="primary.main" sx={{ mb: 2 }}>
        {SUPPORT_DIALOG_TITLE}
      </Typography>
      {isPending ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress />
        </Box>
      ) : isError || !bodyHtml ? (
        <Typography variant="body2">
          Support information is unavailable right now. If this is an emergency, please call 911.
        </Typography>
      ) : (
        <Box
          sx={{
            '& p': { my: 1 },
            '& h2, & h3': { mt: 1.5, mb: 1 },
            '& ul, & ol': { pl: 3, my: 1 },
            '& a': { color: 'primary.main' },
          }}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      )}
      <PageForm
        onSubmit={onClose}
        controlButtons={{
          submitLabel: 'Ok',
          backButton: false,
        }}
      />
    </CustomDialog>
  );
};
