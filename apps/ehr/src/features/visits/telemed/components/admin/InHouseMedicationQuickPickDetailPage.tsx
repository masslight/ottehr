import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, CircularProgress, IconButton, Stack, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import React, { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Row } from 'src/components/layout/Row';
import { Section } from 'src/components/layout/Section';
import { searchRouteByCode } from 'utils';
import { useInHouseMedicationQuickPicksQuery } from './admin.queries';

function ValueDisplay({ value }: { value: string | number | undefined | null }): ReactElement {
  return (
    <Typography variant="body2">
      {value != null && value !== '' ? String(value) : <span style={{ color: '#999', fontStyle: 'italic' }}>—</span>}
    </Typography>
  );
}

export default function InHouseMedicationQuickPickDetailPage(): ReactElement {
  const { quickPickId } = useParams<{ quickPickId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();

  const { data: quickPicks = [], isLoading } = useInHouseMedicationQuickPicksQuery();
  const quickPick = quickPicks.find((qp) => qp.id === quickPickId);

  if (isLoading) {
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

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/admin/quick-picks/in-house-medications')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" color={theme.palette.primary.dark}>
          {quickPick.name}
        </Typography>
      </Box>

      <Stack spacing={2}>
        <Section title="Medication Information">
          <Row label="Medication">
            <ValueDisplay value={quickPick.medicationName} />
          </Row>
          <Row label="Dose">
            <ValueDisplay value={quickPick.dose} />
          </Row>
          <Row label="Units">
            <ValueDisplay value={quickPick.units} />
          </Row>
          <Row label="Route">
            <ValueDisplay value={searchRouteByCode(quickPick.route)?.display ?? quickPick.route} />
          </Row>
          <Row label="Location">
            <ValueDisplay value={quickPick.location?.name} />
          </Row>
          <Row label="Manufacturer">
            <ValueDisplay value={quickPick.manufacturer} />
          </Row>
        </Section>

        <Section title="Codes">
          <Row label="NDC">
            <ValueDisplay value={quickPick.ndc} />
          </Row>
          <Row label="CPT / HCPCS">
            {quickPick.cptCodes && quickPick.cptCodes.length > 0 ? (
              <Stack spacing={0.5}>
                {quickPick.cptCodes.map((cptCode) => (
                  <Typography key={cptCode.code} variant="body2">
                    {cptCode.code} {cptCode.display}
                    {cptCode.billableUnitSize != null && (
                      <Typography component="span" variant="body2" color="text.secondary">
                        {' '}
                        — Billable Unit Size: {cptCode.billableUnitSize}
                        {quickPick.units ? ` ${quickPick.units}` : ''}
                        {cptCode.billableUnits != null ? `, Billable Units: ${cptCode.billableUnits}` : ''}
                      </Typography>
                    )}
                  </Typography>
                ))}
              </Stack>
            ) : (
              <ValueDisplay value={undefined} />
            )}
          </Row>
        </Section>

        <Section title="Administration Details">
          <Row label="Lot Number">
            <ValueDisplay value={quickPick.lotNumber} />
          </Row>
          <Row label="Expiration Date">
            <ValueDisplay
              value={quickPick.expDate ? DateTime.fromISO(quickPick.expDate).toFormat('yyyy-MM-dd') : undefined}
            />
          </Row>
          <Row label="Instructions">
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {quickPick.instructions || <span style={{ color: '#999', fontStyle: 'italic' }}>—</span>}
            </Typography>
          </Row>
        </Section>
      </Stack>
    </Box>
  );
}
