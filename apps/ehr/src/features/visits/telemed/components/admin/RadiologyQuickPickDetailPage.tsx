import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Chip, CircularProgress, IconButton, Stack, Typography, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getRadiologyQuickPicks } from 'src/api/api';
import { Row } from 'src/components/layout/Row';
import { Section } from 'src/components/layout/Section';
import { useApiClients } from 'src/hooks/useAppClients';
import { LATERALITY_SELECTORS, LateralityValue, RadiologyQuickPickData } from 'utils';

function ValueDisplay({ value }: { value: string | undefined | null }): ReactElement {
  return (
    <Typography variant="body2">{value || <span style={{ color: '#999', fontStyle: 'italic' }}>—</span>}</Typography>
  );
}

export default function RadiologyQuickPickDetailPage(): ReactElement {
  const { quickPickId } = useParams<{ quickPickId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const [quickPick, setQuickPick] = useState<RadiologyQuickPickData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuickPick = useCallback(async () => {
    if (!oystehrZambda || !quickPickId) return;
    setLoading(true);
    try {
      const response = await getRadiologyQuickPicks(oystehrZambda);
      const found = response.quickPicks.find((qp) => qp.id === quickPickId);
      if (found) {
        setQuickPick(found);
      } else {
        enqueueSnackbar('Quick pick not found', { variant: 'error' });
        navigate('/admin/quick-picks');
      }
    } catch (error) {
      console.error('Failed to load quick pick:', error);
      enqueueSnackbar('Failed to load quick pick details', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, quickPickId, navigate]);

  useEffect(() => {
    void fetchQuickPick();
  }, [fetchQuickPick]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!quickPick) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">Quick pick not found</Typography>
      </Box>
    );
  }

  const lateralityDisplay = quickPick.laterality
    ? `${quickPick.laterality} (${
        LATERALITY_SELECTORS[quickPick.laterality as LateralityValue]?.uiDisplay ?? quickPick.laterality
      })`
    : undefined;

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/admin/quick-picks')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" color={theme.palette.primary.dark}>
          {quickPick.name}
        </Typography>
      </Box>

      <Stack spacing={2}>
        <Section title="Study Information">
          <Row label="Study Name">
            <ValueDisplay value={quickPick.studyName} />
          </Row>
          <Row label="Study Type (CPT)">
            <Typography variant="body2">
              {quickPick.cptCode ? (
                <Chip label={`${quickPick.cptCode} — ${quickPick.cptDisplay ?? ''}`} size="small" variant="outlined" />
              ) : (
                <span style={{ color: '#999', fontStyle: 'italic' }}>—</span>
              )}
            </Typography>
          </Row>
          <Row label="Laterality">
            <ValueDisplay value={lateralityDisplay} />
          </Row>
        </Section>

        <Section title="Order Details">
          <Row label="Clinical History">
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {quickPick.clinicalHistory || <span style={{ color: '#999', fontStyle: 'italic' }}>—</span>}
            </Typography>
          </Row>
        </Section>
      </Stack>
    </Box>
  );
}
