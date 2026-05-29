import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { Box, IconButton, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../../layout/PageContainer';
import InvoiceablePatientsContent from './InvoiceablePatientsContent';

export default function InvoiceablePatients(): ReactElement {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/reports')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AssessmentIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
              Invoiceable Patients Report
            </Typography>
          </Box>
        </Box>

        <InvoiceablePatientsContent />
      </Box>
    </PageContainer>
  );
}
