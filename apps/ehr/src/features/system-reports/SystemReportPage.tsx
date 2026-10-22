// The page of one system report (Reports → tile): loads it and shows <SystemReport>. Who may open which report is
// decided per report, by its roles, in list-system-reports — a report the caller may not see is "not found" here.
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { Alert, Box, CircularProgress, IconButton, Typography } from '@mui/material';
import { captureException } from '@sentry/react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { SystemReport as SystemReportDefinition } from 'utils/lib/types/adhoc/system/system-report';
import { listSystemReports } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';
import { SystemReport } from './SystemReport';

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export default function SystemReportPage(): React.ReactElement {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [report, setReport] = useState<SystemReportDefinition>();
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    if (!oystehrZambda || !reportId) return;
    let cancelled = false;
    listSystemReports(oystehrZambda)
      .then(({ reports }) => {
        if (cancelled) return;
        const found = reports.find((r) => r.id === reportId);
        if (!found) {
          setLoadError('That system report no longer exists.');
          return;
        }
        setReport(found);
      })
      .catch((e) => {
        if (cancelled) return;
        captureException(e);
        setLoadError(`The report could not be loaded: ${errorMessage(e)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [oystehrZambda, reportId]);

  return (
    <PageContainer tabTitle={report?.title ?? report?.name}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton onClick={() => navigate('/reports')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <VerifiedOutlinedIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
          <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
            {report?.title ?? report?.name ?? 'System report'}
          </Typography>
        </Box>
        {loadError && <Alert severity="error">{loadError}</Alert>}
        {!report && !loadError && <CircularProgress size={24} />}
        {report && <SystemReport report={report} />}
      </Box>
    </PageContainer>
  );
}
