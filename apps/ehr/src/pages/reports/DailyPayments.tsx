import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { Box, IconButton, Typography } from '@mui/material';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../../layout/PageContainer';

export default function DailyPayments(): React.ReactElement {
  const navigate = useNavigate();

  const handleBack = (): void => {
    navigate('/reports');
  };

  return (
    <PageContainer>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AttachMoneyIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
              Daily Payments
            </Typography>
          </Box>
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Review daily payment reports and transaction summaries.
        </Typography>

        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            Report content will be implemented here
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mt: 2 }}>
            This page will contain payment analytics, transaction tables, and financial summaries
          </Typography>
        </Box>
      </Box>
    </PageContainer>
  );
}
