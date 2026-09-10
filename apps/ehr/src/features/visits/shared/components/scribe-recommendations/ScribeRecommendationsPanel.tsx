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
  IconButton,
  LinearProgress,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { FC, ReactNode } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { AiDisclaimerTooltip } from '../AiSection';
import { useListTemplates } from '../templates/useListTemplates';
import { SAMPLE_TRANSCRIPT } from './fakeScribeAnalysis';
import { OrderSuggestions } from './OrderSuggestions';
import { RecommendationsList } from './RecommendationsList';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { ScribeStage } from './ScribeStage';
import { TemplateStage } from './TemplateStage';
import { TemplateRecommendation } from './types';
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
      aria-label="AI Chart Recommendations"
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          minHeight: 40,
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
        }}
      >
        <img src={aiIcon} alt="" aria-hidden style={{ width: 22 }} />
        <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 13 }}>
          AI Chart Recommendations
        </Typography>
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
  const transcript = useScribeRecommendationsStore((state) => state.transcript);
  const recommendations = useScribeRecommendationsStore((state) => state.recommendations);
  const itemState = useScribeRecommendationsStore((state) => state.itemState);
  const orderSuggestions = useScribeRecommendationsStore((state) => state.orderSuggestions);
  const isApplying = useScribeRecommendationsStore((state) => state.isApplying);
  const setManySelected = useScribeRecommendationsStore((state) => state.setManySelected);
  const updateRecommendation = useScribeRecommendationsStore((state) => state.updateRecommendation);
  const { templates } = useListTemplates();
  const { applyObservations, applyRecommendation } = useApplyRecommendations();

  // The template writes whole sections, so it leads; the observations land on top of it.
  const template = recommendations.find((rec): rec is TemplateRecommendation => rec.kind === 'template');
  const observations = recommendations.filter((rec) => rec.section !== 'template');

  const pending = observations.filter((rec) => itemState[rec.id]?.status !== 'applied');
  const selectedPending = pending.filter((rec) => itemState[rec.id]?.selected);
  const appliedCount = observations.length - pending.length;
  const failedCount = observations.filter((rec) => itemState[rec.id]?.status === 'error').length;
  const allPendingSelected = pending.length > 0 && selectedPending.length === pending.length;

  const summary = [
    pending.length > 0 ? `${selectedPending.length} of ${pending.length} selected` : undefined,
    appliedCount > 0 ? `${appliedCount} added` : undefined,
    failedCount > 0 ? `${failedCount} failed` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  const stages: ReactNode[] = [];

  if (template) {
    stages.push(
      <ScribeStage
        key="template"
        name="template"
        lead="There’s a template that looks like a good fit. I recommend applying it first."
      >
        <TemplateStage
          recommendation={template}
          itemState={itemState[template.id] ?? { selected: true, status: 'idle' }}
          templates={templates}
          locked={isApplying}
          onEdit={(patch) => updateRecommendation(template.id, patch)}
          onApply={async (sectionActions, options) => {
            // Park the choice on the recommendation so the apply — and any retry — uses it.
            updateRecommendation(template.id, { sectionActions, applyOptions: options });
            await applyRecommendation(template.id);
          }}
        />
      </ScribeStage>
    );
  }

  if (observations.length > 0) {
    stages.push(
      <ScribeStage
        key="observations"
        name="observations"
        lead="Then add these observations, which I read in the transcript."
      >
        <RecommendationsList
          recommendations={observations}
          templates={templates}
          onRetry={() => void applyObservations()}
        />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
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
          {/* Once every observation is in the chart there is nothing left for this button to do. */}
          {pending.length > 0 && (
            <RoundedButton
              variant="contained"
              onClick={() => void applyObservations()}
              disabled={selectedPending.length === 0 || isApplying}
              loading={isApplying}
              data-testid={testIds.applyObservationsButton}
            >
              {selectedPending.length === 0
                ? 'Add observations'
                : `Add ${selectedPending.length} ${selectedPending.length === 1 ? 'observation' : 'observations'}`}
            </RoundedButton>
          )}
        </Box>
      </ScribeStage>
    );
  }

  if (orderSuggestions.length > 0) {
    stages.push(
      <ScribeStage key="orders" name="orders" lead="Finally, here are some orders you might want to make:">
        <OrderSuggestions />
      </ScribeStage>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TranscriptSummary transcript={transcript} />
      {stages}
    </Box>
  );
};

const TranscriptSummary: FC<{ transcript: string }> = ({ transcript }) => {
  const resetAnalysis = useScribeRecommendationsStore((state) => state.resetAnalysis);
  const isApplying = useScribeRecommendationsStore((state) => state.isApplying);

  return (
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
  );
};
