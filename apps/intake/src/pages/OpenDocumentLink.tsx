import { Button, Card, Typography, useTheme } from '@mui/material';
import { Box, Container } from '@mui/system';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useUCZambdaClient } from 'src/hooks/useUCZambdaClient';
import { CustomContainer } from 'src/telemed/features/common/CustomContainer';
import { LoadingScreen } from 'src/telemed/features/common/LoadingScreen';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { OpenDocumentLinkOutput } from 'utils/lib/types/api/fax.types';

export const OPEN_DOCUMENT_LINK_ZAMBDA_ID = 'open-document-link';

type LinkState = { status: 'loading' } | { status: 'ok'; url: string } | { status: 'expired' } | { status: 'invalid' };

/**
 * Landing page for the document links emailed from the EHR. Exchanges the path token for a short-lived
 * download URL and navigates to it; an expired token has already triggered a fresh email server-side.
 */
const OpenDocumentLink = (): JSX.Element => {
  const { linkToken } = useParams<{ linkToken: string }>();
  const zambdaClient = useUCZambdaClient({ tokenless: true });
  const theme = useTheme();
  const [state, setState] = useState<LinkState>({ status: 'loading' });
  // Opening an expired link re-sends the email, so StrictMode's second effect run must not call again.
  const started = useRef(false);

  useEffect(() => {
    if (!zambdaClient || started.current) return;
    started.current = true;
    if (!linkToken) {
      setState({ status: 'invalid' });
      return;
    }
    zambdaClient
      .executePublic(OPEN_DOCUMENT_LINK_ZAMBDA_ID, { token: linkToken })
      .then((response) => {
        const output = chooseJson<OpenDocumentLinkOutput>(response);
        if (output.status === 'ok') {
          setState({ status: 'ok', url: output.url });
          window.location.replace(output.url);
        } else {
          setState({ status: 'expired' });
        }
      })
      .catch((error) => {
        console.error('Could not open the document link', error);
        setState({ status: 'invalid' });
      });
  }, [zambdaClient, linkToken]);

  return (
    <CustomContainer title="" useEmptyBody>
      <Container maxWidth="md" sx={{ mb: 5 }}>
        <Card
          variant="outlined"
          sx={{ boxShadow: 1, mt: 0, mb: 3, pt: 0, borderRadius: 2, [theme.breakpoints.down('md')]: { mx: 2 } }}
        >
          <Box
            sx={{
              m: 0,
              p: { xs: 3, md: 5 },
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            }}
          >
            {state.status === 'loading' && <LoadingScreen />}
            {state.status === 'ok' && (
              <>
                <Typography variant="h2" color="primary.main" textAlign="center">
                  Opening your documents
                </Typography>
                <Button variant="contained" href={state.url}>
                  Open document
                </Button>
              </>
            )}
            {state.status === 'expired' && (
              <Typography variant="h2" color="primary.main" textAlign="center">
                This link has expired. A new link has been emailed to you.
              </Typography>
            )}
            {state.status === 'invalid' && (
              <Typography variant="h2" color="primary.main" textAlign="center">
                This link is not valid. Please contact the practice for a new one.
              </Typography>
            )}
          </Box>
        </Card>
      </Container>
    </CustomContainer>
  );
};

export default OpenDocumentLink;
