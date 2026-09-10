import { aiIcon } from '@ehrTheme/icons';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  LinearProgress,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { FC } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { AiDisclaimerTooltip } from '../AiSection';
import { useListTemplates } from '../templates/useListTemplates';
import { SAMPLE_TRANSCRIPT } from './fakeScribeAnalysis';
import { OrderSuggestions } from './OrderSuggestions';
import { RecommendationsList } from './RecommendationsList';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { useApplyRecommendations } from './useApplyRecommendations';

interface ScribeRecommendationsPanelProps {
  onCollapse: () => void;
}

const testIds = dataTestIds.scribeRecommendations;

export const ScribeRecommendationsPanel: FC<ScribeRecommendationsPanelProps> = ({ onCollapse }) => {
  const theme = useTheme();
  const phase = useScribeRecommendationsStore((state) => state.phase);

  return (
    <Box
      data-testid={testIds.panel}
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
      role="complementary"
      aria-label="Ambient Scribe recommendations"
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          minHeight: 48,
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
        }}
      >
        <img src={aiIcon} alt="" aria-hidden style={{ width: 22 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Ambient Scribe
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
            Charting recommendations
          </Typography>
        </Box>
        <AiDisclaimerTooltip />
        <Tooltip title="Collapse panel">
          <IconButton
            size="small"
            onClick={onCollapse}
            aria-label="Collapse panel"
            data-testid={testIds.collapseButton}
          >
            <ChevronRightIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {phase === 'ready' ? <ResultsStep /> : <TranscriptStep />}
    </Box>
  );
};

const TranscriptStep: FC = () => {
  const transcript = useScribeRecommendationsStore((state) => state.transcript);
  const phase = useScribeRecommendationsStore((state) => state.phase);
  const analysisError = useScribeRecommendationsStore((state) => state.analysisError);
  const setTranscript = useScribeRecommendationsStore((state) => state.setTranscript);
  const analyze = useScribeRecommendationsStore((state) => state.analyze);
  const isAnalyzing = phase === 'analyzing';

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
        Paste the transcript of the encounter. You’ll get a list of suggested chart updates to review, edit and apply to
        the progress note. Nothing is written until you apply it.
      </Typography>
      <TextField
        value={transcript}
        onChange={(event) => setTranscript(event.target.value)}
        multiline
        minRows={10}
        maxRows={22}
        fullWidth
        label="Encounter transcript"
        placeholder="Provider: What brings you in today?&#10;Patient: …"
        disabled={isAnalyzing}
        inputProps={{ 'data-testid': testIds.transcriptInput }}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          onClick={() => setTranscript(SAMPLE_TRANSCRIPT)}
          disabled={isAnalyzing}
          sx={{ textTransform: 'none' }}
          data-testid={testIds.useSampleButton}
        >
          Use sample transcript
        </Button>
        <RoundedButton
          variant="contained"
          onClick={() => void analyze()}
          disabled={!transcript.trim() || isAnalyzing}
          loading={isAnalyzing}
          data-testid={testIds.analyzeButton}
        >
          Get charting recommendations
        </RoundedButton>
      </Box>
      {isAnalyzing && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary">
            Reading the transcript and drafting recommendations…
          </Typography>
        </Box>
      )}
      {analysisError && <Alert severity="error">{analysisError}</Alert>}
    </Box>
  );
};

const ResultsStep: FC = () => {
  const theme = useTheme();
  const transcript = useScribeRecommendationsStore((state) => state.transcript);
  const recommendations = useScribeRecommendationsStore((state) => state.recommendations);
  const itemState = useScribeRecommendationsStore((state) => state.itemState);
  const isApplying = useScribeRecommendationsStore((state) => state.isApplying);
  const resetAnalysis = useScribeRecommendationsStore((state) => state.resetAnalysis);
  const setManySelected = useScribeRecommendationsStore((state) => state.setManySelected);
  const { templates } = useListTemplates();
  const { applySelected } = useApplyRecommendations();

  const pending = recommendations.filter((rec) => itemState[rec.id]?.status !== 'applied');
  const selectedPending = pending.filter((rec) => itemState[rec.id]?.selected);
  const appliedCount = recommendations.length - pending.length;
  const failedCount = recommendations.filter((rec) => itemState[rec.id]?.status === 'error').length;
  const allPendingSelected = pending.length > 0 && selectedPending.length === pending.length;

  const summary = [
    `${selectedPending.length} of ${pending.length} selected`,
    appliedCount > 0 ? `${appliedCount} applied` : undefined,
    failedCount > 0 ? `${failedCount} failed` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Accordion variant="outlined" disableGutters sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Transcript
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {transcript.trim().split(/\s+/).length} words
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Typography
              variant="body2"
              sx={{ whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto', color: 'text.secondary' }}
            >
              {transcript}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Button
                size="small"
                onClick={resetAnalysis}
                disabled={isApplying}
                sx={{ textTransform: 'none' }}
                data-testid={testIds.editTranscriptButton}
              >
                Edit transcript &amp; run again
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', color: theme.palette.primary.dark }}>
              Chart updates
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Checked items are written to the note when you apply. Uncheck anything you don’t want, or edit it first.
            </Typography>
          </Box>
          <RecommendationsList templates={templates} onRetry={() => void applySelected()} />
        </Box>

        <Divider />

        <OrderSuggestions />
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 2,
          py: 1.5,
          borderTop: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" data-testid={testIds.selectionSummary}>
            {summary}
          </Typography>
          {pending.length > 0 && (
            <Button
              size="small"
              onClick={() =>
                setManySelected(
                  pending.map((rec) => rec.id),
                  !allPendingSelected
                )
              }
              disabled={isApplying}
              sx={{ textTransform: 'none', alignSelf: 'flex-start', minWidth: 0, p: 0, fontSize: 12 }}
              data-testid={testIds.toggleAllButton}
            >
              {allPendingSelected ? 'Deselect all' : 'Select all'}
            </Button>
          )}
        </Box>
        <RoundedButton
          variant="contained"
          onClick={() => void applySelected()}
          disabled={selectedPending.length === 0 || isApplying}
          loading={isApplying}
          data-testid={testIds.applyButton}
        >
          Apply to progress note
        </RoundedButton>
      </Box>
    </>
  );
};
