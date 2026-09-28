import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Box, Button, Paper, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback } from 'react';

interface QuestionnaireJsonPreviewProps {
  json: string;
}

export const QuestionnaireJsonPreview: FC<QuestionnaireJsonPreviewProps> = ({ json }) => {
  const handleCopyJson = useCallback(() => {
    void navigator.clipboard.writeText(json).then(() => {
      enqueueSnackbar('JSON copied to clipboard', { variant: 'success' });
    });
  }, [json]);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        mt: 2,
        maxHeight: 400,
        overflow: 'auto',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h4" sx={{ color: '#0F347C' }}>
          JSON Preview
        </Typography>
        <Button size="small" startIcon={<ContentCopyIcon />} onClick={handleCopyJson}>
          Copy
        </Button>
      </Box>
      <Box
        component="pre"
        sx={{
          fontSize: 12,
          fontFamily: 'monospace',
          bgcolor: '#f5f5f5',
          p: 1.5,
          borderRadius: 1,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          m: 0,
        }}
      >
        {json}
      </Box>
    </Paper>
  );
};
