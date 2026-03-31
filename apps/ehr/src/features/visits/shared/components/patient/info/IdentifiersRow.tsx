import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Box, Skeleton, Tooltip, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';

type Props = {
  loading?: boolean;
  id?: string;
};

export const IdentifiersRow: FC<Props> = ({ id, loading }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (): void => {
    if (!id) return;
    void navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {loading ? (
        <Skeleton width={300} />
      ) : (
        <Tooltip title={copied ? 'Copied!' : 'Click to copy'}>
          <Typography
            variant="body2"
            data-testid={dataTestIds.patientHeader.patientId}
            onClick={handleCopy}
            sx={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            PID: {id ?? '?'}
            {copied ? (
              <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
            ) : (
              <ContentCopyIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            )}
          </Typography>
        </Tooltip>
      )}
    </Box>
  );
};
