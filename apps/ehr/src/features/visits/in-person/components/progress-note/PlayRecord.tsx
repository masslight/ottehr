import { useAuth0 } from '@auth0/auth0-react';
import { ottehrAiIcon } from '@ehrTheme/icons';
import { PlayArrow } from '@mui/icons-material';
import { Box, Button, Typography, useTheme } from '@mui/material';
import { DocumentReference, Practitioner } from 'fhir/r4b';
import { ReactElement, useState } from 'react';
import { AiChatHistory } from 'src/components/AiChatHistory';
import { useApiClients } from 'src/hooks/useAppClients';
import { getPresignedURL } from 'utils';
import { getDocumentReferenceSource, getSource } from '../../../shared/components/OttehrAi';

interface PlayRecordProps {
  documentReference: DocumentReference;
  providers: Practitioner[] | undefined;
}

export function PlayRecord(props: PlayRecordProps): ReactElement {
  const theme = useTheme();
  const { getAccessTokenSilently } = useAuth0();
  const { documentReference, providers } = props;
  const { oystehr } = useApiClients();
  const [recordURL, setRecordURL] = useState<string | undefined>(undefined);

  async function downloadAudio(documentReference: DocumentReference): Promise<void> {
    const url = documentReference.content.find((contentTemp) => contentTemp.attachment.url !== undefined)?.attachment
      .url;
    if (!url) {
      throw new Error(`No URL found for DocumentReference ${documentReference.id}`);
    }
    const accessToken = await getAccessTokenSilently();
    const presignedURL = await getPresignedURL(url, accessToken);
    setRecordURL(presignedURL);
  }
  return (
    <>
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingBottom: 0.5,
        }}
      >
        <img src={ottehrAiIcon} style={{ width: '30px', marginRight: '8px' }} />
        <Typography variant="body1" style={{ fontWeight: 700, fontSize: '14px' }}>
          {getDocumentReferenceSource(documentReference) === 'audio'
            ? 'TRANSCRIPT OF VISIT BY OYSTEHR AI'
            : 'CHAT WITH OYSTEHR AI'}
        </Typography>
        {getDocumentReferenceSource(documentReference) === 'audio' && (
          <>
            {recordURL ? (
              <audio controls src={recordURL} autoPlay />
            ) : (
              <Button
                variant="outlined"
                startIcon={<PlayArrow />}
                size="small"
                onClick={() => downloadAudio(documentReference)}
                style={{ marginLeft: 8 }}
              >
                Play
              </Button>
            )}
          </>
        )}
        <Typography variant="body2" style={{ color: theme.palette.secondary.light, marginLeft: 8 }}>
          {getSource(documentReference, oystehr, providers)}
        </Typography>
      </Box>
      <Box sx={{ marginLeft: '38px' }}>
        <AiChatHistory documentReference={documentReference} />
      </Box>
    </>
  );
}
