import { Box, CircularProgress, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { FC, useMemo } from 'react';
import { CustomDialog } from 'ui-components';
import { ALLOWED_SUPPORT_DIALOG_TAGS } from 'utils';
import api from '../api/ottehrApi';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';
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
  const safeBodyHtml = useMemo(() => {
    if (!rawBodyHtml) return '';
    const sanitized = DOMPurify.sanitize(rawBodyHtml, {
      ALLOWED_TAGS: ALLOWED_SUPPORT_DIALOG_TAGS,
      ALLOWED_ATTR: [],
    });
    // tiptap emits blank lines as <p></p> (or <p> </p>); these collapse to zero
    // height and render invisibly. Give each blank paragraph a <br> so it occupies
    // a full line. Done after sanitizing — <br> is already in the allowlist.
    const doc = new DOMParser().parseFromString(sanitized, 'text/html');
    doc.querySelectorAll('p').forEach((p) => {
      if (!p.textContent?.trim() && !p.querySelector('br')) {
        p.appendChild(doc.createElement('br'));
      }
    });
    return doc.body.innerHTML;
  }, [rawBodyHtml]);

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
