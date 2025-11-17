import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, Button, Card, CardContent, CircularProgress, Typography } from '@mui/material';
import React, { ReactElement, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchReportDownloadURL } from '../../../../packages/zambdas/src/services/reports';

const FileDownload: React.FC = (): ReactElement => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    const fetchDownloadStatus = async (): Promise<any> => {
      if (!token) {
        setStatus('error');
        return;
      }
      try {
        const response = await fetchReportDownloadURL(token);

        if (response.status === 200) {
          setStatus('success');
          console.log('File Url:', response);
          const fileUrl = response.data.data.url;
          console.log('File Url:', fileUrl);
          if (fileUrl) {
            setTimeout(() => {
              window.location.href = fileUrl;
            }, 1500);
          }
        } else {
          setStatus('error');
        }
      } catch (error: any) {
        if (error.response?.status === 400) {
          setStatus('error');
        } else {
          setStatus('error');
        }
      }
    };

    void fetchDownloadStatus();
  }, [token]);

  const handleRetry = (): void => {
    setStatus('loading');
    window.location.reload();
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#f5f6fa',
        p: 2,
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 3,
          boxShadow: 3,
          textAlign: 'center',
          p: 3,
        }}
      >
        <CardContent>
          {status === 'loading' && (
            <Box sx={{ py: 4 }}>
              <CircularProgress size={48} />
              <Typography variant="h6" mt={2}>
                Checking your download link...
              </Typography>
            </Box>
          )}

          {status === 'success' && (
            <Box sx={{ py: 4 }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 60 }} />
              <Typography variant="h6" mt={2}>
                Your file will start downloading soon
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                If it doesn’t start automatically, click below.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => window.location.reload()}
                sx={{ mt: 3, borderRadius: 2 }}
              >
                Retry Download
              </Button>
            </Box>
          )}

          {status === 'error' && (
            <Box sx={{ py: 4 }}>
              <ErrorOutlineIcon color="error" sx={{ fontSize: 60 }} />
              <Typography variant="h6" mt={2}>
                This download link has expired
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                Please request a new link or contact support if you believe this is an error.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRetry}
                sx={{ mt: 3, borderRadius: 2 }}
              >
                Retry
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default FileDownload;
