import { useAuth0 } from '@auth0/auth0-react';
import { otherColors } from '@ehrTheme/colors';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { Box, Button, Card, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import React, { FC, useEffect, useState } from 'react';
import { ClaimsQueueItemStatus } from 'utils';
import { getPresignedFileUrl } from '../../../helpers/files.helper';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useClaimStore } from '../../state';
import { ClaimStatusChip } from '../claims-queue';

const formatDate = (date: string): string => {
  const dt = DateTime.fromISO(date);
  return `Last updated on ${dt.toFormat('MM/dd/yyyy')} at ${dt.toFormat('h:mm a')}`;
};

export const ClaimHeader: FC = () => {
  const { patientData, claim, appointment, visitNoteDocument } = getSelectors(useClaimStore, [
    'patientData',
    'claim',
    'appointment',
    'visitNoteDocument',
  ]);
  const { getAccessTokenSilently } = useAuth0();

  const [visitNotePresignedURL, setVisitNotePresignedURL] = useState<string>();

  useEffect(() => {
    async function getPresignedTemplateUrls(): Promise<void> {
      try {
        const authToken = await getAccessTokenSilently();

        const z3Url = visitNoteDocument?.content?.[0]?.attachment.url;
        if (z3Url) {
          const presignedUrl = await getPresignedFileUrl(z3Url, authToken);
          setVisitNotePresignedURL(presignedUrl);
        }
      } catch {
        console.error('Error while trying to get presigned url');
      }
    }

    if (visitNoteDocument) {
      void getPresignedTemplateUrls();
    }
  }, [getAccessTokenSilently, visitNoteDocument]);

  const status = claim?.meta?.tag?.find((tag) => tag.system === 'current-status')?.code;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          alignItems: 'center',
        }}
      >
        <Typography variant="h3" color="primary.dark">
          Claim for {patientData?.firstLastName}
        </Typography>

        {status && <ClaimStatusChip status={status as ClaimsQueueItemStatus} />}

        {claim?.meta?.lastUpdated && (
          <Typography variant="body2" color="text.secondary">
            {formatDate(claim.meta.lastUpdated)}
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            CID: {claim?.id}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            VID: {appointment?.id}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Card
            elevation={0}
            sx={{
              backgroundColor: otherColors.lightIconButton,
              display: 'flex',
              alignItems: 'center',
              px: 2,
              gap: 1,
            }}
          >
            <Typography variant="subtitle1" fontSize={16} color="primary.dark">
              Full visit note
            </Typography>

            <Button
              sx={{
                textTransform: 'none',
                fontWeight: 500,
                fontSize: 16,
              }}
              startIcon={<FileDownloadOutlinedIcon />}
              disabled={!visitNotePresignedURL}
              onClick={() => window.open(visitNotePresignedURL, '_blank')}
            >
              Download PDF
            </Button>
          </Card>

          {/*<RoundedButton startIcon={<RestartAltIcon />}>Refresh Demographics</RoundedButton>*/}
          {/*<RoundedButton startIcon={<OpenInNewIcon />}>Export</RoundedButton>*/}
        </Box>
      </Box>
    </Box>
  );
};
