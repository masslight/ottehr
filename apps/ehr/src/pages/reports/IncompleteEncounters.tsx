import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import { Box, IconButton, Typography } from '@mui/material';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../../layout/PageContainer';

export default function IncompleteEncounters(): React.ReactElement {
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
            <AssignmentLateIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
              Incomplete Encounters
            </Typography>
          </Box>
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          This report shows encounters that are missing required information or documentation.
        </Typography>

        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            Report content will be implemented here
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mt: 2 }}>
            This page will contain tables, filters, and analytics for incomplete encounters
          </Typography>
        </Box>
      </Box>
    </PageContainer>
  );
}
