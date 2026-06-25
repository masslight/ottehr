import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Chip, CircularProgress, IconButton, Stack, Typography, useTheme } from '@mui/material';
import React, { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Row } from 'src/components/layout/Row';
import { Section } from 'src/components/layout/Section';
import { useProcedureQuickPicksQuery } from './admin.queries';

function ValueDisplay({ value }: { value: string | undefined | null }): ReactElement {
  return (
    <Typography variant="body2">{value || <span style={{ color: '#999', fontStyle: 'italic' }}>—</span>}</Typography>
  );
}

function ChipList({ items }: { items: string[] }): ReactElement {
  if (items.length === 0) {
    return <ValueDisplay value={undefined} />;
  }
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {items.map((item, i) => (
        <Chip key={i} label={item} size="small" variant="outlined" />
      ))}
    </Box>
  );
}

export default function ProcedureQuickPickDetailPage(): ReactElement {
  const { quickPickId } = useParams<{ quickPickId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();

  const { data: quickPicks = [], isLoading } = useProcedureQuickPicksQuery();
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

  const bodySiteDisplay =
    quickPick.bodySite === 'Other' && quickPick.otherBodySite
      ? `Other: ${quickPick.otherBodySite}`
      : quickPick.bodySite;

  const complicationsDisplay =
    quickPick.complications === 'Other' && quickPick.otherComplications
      ? `Other: ${quickPick.otherComplications}`
      : quickPick.complications;

  const postInstructionsDisplay = [
    ...(quickPick.postInstructions?.filter((item) => item && item !== 'Other') ?? []),
    ...(quickPick.otherPostInstructions ? [`Other: ${quickPick.otherPostInstructions}`] : []),
  ];

  const suppliesDisplay = [
    ...(quickPick.suppliesUsed?.filter((item) => item && item !== 'Other') ?? []),
    ...(quickPick.otherSuppliesUsed ? [`Other: ${quickPick.otherSuppliesUsed}`] : []),
  ] as string[];

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/admin/quick-picks/procedures')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" color={theme.palette.primary.dark}>
          {quickPick.name}
        </Typography>
      </Box>

      <Stack spacing={2}>
        <Section title="Procedure Information">
          <Row label="Procedure Type">
            <ValueDisplay value={quickPick.procedureType} />
          </Row>
        </Section>

        <Section title="CPT Codes">
          {quickPick.cptCodes && quickPick.cptCodes.length > 0 ? (
            <ChipList items={quickPick.cptCodes.map((c) => `${c.code} — ${c.display}`)} />
          ) : (
            <ValueDisplay value={undefined} />
          )}
        </Section>

        <Section title="Clinical Details">
          <Row label="Body Site">
            <ValueDisplay value={bodySiteDisplay} />
          </Row>
          <Row label="Body Side">
            <ValueDisplay value={quickPick.bodySide} />
          </Row>
          <Row label="Medication Used">
            <ValueDisplay value={quickPick.medicationUsed} />
          </Row>
          <Row label="Technique">
            <ChipList items={quickPick.technique ?? []} />
          </Row>
          <Row label="Supplies Used">
            <ChipList items={suppliesDisplay} />
          </Row>
        </Section>

        <Section title="Procedure Details">
          <Row label="Details">
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {quickPick.procedureDetails || <span style={{ color: '#999', fontStyle: 'italic' }}>—</span>}
            </Typography>
          </Row>
          <Row label="Specimen Sent">
            <Typography variant="body2">
              {quickPick.specimenSent === true ? 'Yes' : quickPick.specimenSent === false ? 'No' : '—'}
            </Typography>
          </Row>
          <Row label="Complications">
            <ValueDisplay value={complicationsDisplay} />
          </Row>
          <Row label="Patient Response">
            <ValueDisplay value={quickPick.patientResponse} />
          </Row>
        </Section>

        <Section title="Post-Procedure">
          <Row label="Instructions">
            <ChipList items={postInstructionsDisplay} />
          </Row>
          <Row label="Time Spent">
            <ValueDisplay value={quickPick.timeSpent} />
          </Row>
          <Row label="Documented By">
            <ValueDisplay value={quickPick.documentedBy} />
          </Row>
        </Section>
      </Stack>
    </Box>
  );
}
