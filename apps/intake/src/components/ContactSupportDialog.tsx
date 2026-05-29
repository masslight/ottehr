import { Box, CircularProgress, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { FC, useMemo } from 'react';
import { ALLOWED_SUPPORT_DIALOG_TAGS } from 'utils';
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

  const rawBodyHtml = data?.bodyHtml?.trim();
  const safeBodyHtml = useMemo(
    () =>
      rawBodyHtml
        ? DOMPurify.sanitize(rawBodyHtml, { ALLOWED_TAGS: ALLOWED_SUPPORT_DIALOG_TAGS, ALLOWED_ATTR: [] })
        : '',
    [rawBodyHtml]
  );

  return (
    <CustomDialog open={true} onClose={onClose}>
      <Typography variant="h2" color="primary.main" sx={{ mb: 2 }}>
        {SUPPORT_DIALOG_TITLE}
      </Typography>
      {isPending ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress />
        </Box>
      ) : isError || !safeBodyHtml ? (
        <Typography variant="body2">
          Support information is unavailable right now. If this is an emergency, please call 911.
        </Typography>
      ) : (
        <Box
          sx={{
            '& p': { my: 1 },
            '& h2, & h3': { mt: 1.5, mb: 1 },
            '& ul, & ol': { pl: 3, my: 1 },
          }}
          dangerouslySetInnerHTML={{ __html: safeBodyHtml }}
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
