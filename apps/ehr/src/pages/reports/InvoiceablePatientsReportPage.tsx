import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { Box, IconButton, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { InvoiceTaskSource } from 'utils';
import { BOTH_INVOICING_SCREENS_ENABLED } from '../../constants/feature-flags';
import PageContainer from '../../layout/PageContainer';
import InvoiceablePatients, { INVOICE_TASK_SOURCE_LABELS } from './InvoiceablePatients';

const pageTitle = (source: InvoiceTaskSource): string =>
  BOTH_INVOICING_SCREENS_ENABLED
    ? `Invoiceable Patients Report — ${INVOICE_TASK_SOURCE_LABELS[source]}`
    : 'Invoiceable Patients Report';

interface InvoiceablePatientsReportPageProps {
  source: InvoiceTaskSource;
}

export default function InvoiceablePatientsReportPage({ source }: InvoiceablePatientsReportPageProps): ReactElement {
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
              {pageTitle(source)}
            </Typography>
          </Box>
        </Box>

        <InvoiceablePatients source={source} />
      </Box>
    </PageContainer>
  );
}
