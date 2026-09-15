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
  Paper,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { FC, ReactNode } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { describeAction } from 'src/features/easy-chart/executor/labels';
import { PlannedAction, RejectedAction } from 'utils/lib/easy-chart/api';
import { AiDisclaimerTooltip } from '../AiSection';
import { useListTemplates } from '../templates/useListTemplates';
import { useSyncChartedRecommendations } from './chartedRecommendations';
import { NarrativeSummary } from './NarrativeSummary';
import { OrderSuggestions } from './OrderSuggestions';
import { PickerDialog } from './PickerDialog';
import { RecommendationsList } from './RecommendationsList';
import { SAMPLE_TRANSCRIPT } from './sampleTranscript';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { ScribeStage } from './ScribeStage';
import { TemplateStage } from './TemplateStage';
import { TemplateRecommendation } from './types';
import { useApplyRecommendations } from './useApplyRecommendations';
import { useScribeAnalyzer } from './useScribeAnalyzer';

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
  // The plan and review endpoints, behind one function; the store only knows it gets an analysis back.
  const analyzer = useScribeAnalyzer();
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
          onClick={() => void analyze(analyzer)}
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
  const narrative = useScribeRecommendationsStore((state) => state.narrative);
  const recommendations = useScribeRecommendationsStore((state) => state.recommendations);
  const itemState = useScribeRecommendationsStore((state) => state.itemState);
  const orderSuggestions = useScribeRecommendationsStore((state) => state.orderSuggestions);
  const rejected = useScribeRecommendationsStore((state) => state.rejected);
  const notes = useScribeRecommendationsStore((state) => state.notes);
  const isApplying = useScribeRecommendationsStore((state) => state.isApplying);
  const setManySelected = useScribeRecommendationsStore((state) => state.setManySelected);
  const updateRecommendation = useScribeRecommendationsStore((state) => state.updateRecommendation);
  const chartedIds = useScribeRecommendationsStore((state) => state.chartedIds);
  const { templates } = useListTemplates();
  const { applyObservations, applyRecommendation } = useApplyRecommendations();

  // Watches the chart and marks off anything it already holds — whether it was there all along,
  // arrived with the template, or the provider just entered it on one of the visit screens.
  useSyncChartedRecommendations(recommendations);

  // The template writes whole sections, so it leads; the observations land on top of it.
  const template = recommendations.find((rec): rec is TemplateRecommendation => rec.kind === 'template');
  const observations = recommendations.filter((rec) => rec.section !== 'template');

  const charted = new Set(chartedIds);
  const appliedCount = observations.filter((rec) => itemState[rec.id]?.status === 'applied').length;
  const chartedCount = observations.filter(
    (rec) => charted.has(rec.id) && itemState[rec.id]?.status !== 'applied'
  ).length;
  // Only what is left to write: anything already in the chart is nothing to do.
  const pending = observations.filter((rec) => itemState[rec.id]?.status !== 'applied' && !charted.has(rec.id));
  const selectedPending = pending.filter((rec) => itemState[rec.id]?.selected);
  const failedCount = observations.filter((rec) => itemState[rec.id]?.status === 'error').length;
  const skippedCount = observations.filter((rec) => itemState[rec.id]?.status === 'skipped').length;
  const allPendingSelected = pending.length > 0 && selectedPending.length === pending.length;

  // The Chart button does the whole review in one go: the template first, without the section
  // picker (the apply falls back to the panel's own defaults), then the checked observations.
  const templatePending =
    template !== undefined &&
    itemState[template.id]?.selected !== false &&
    itemState[template.id]?.status !== 'applied' &&
    !charted.has(template.id);
  const chartEverything = async (): Promise<void> => {
    if (template && templatePending) {
      await applyRecommendation(template.id);
      // The observations are meant to land on top of the template; if it failed, they wait.
      if (useScribeRecommendationsStore.getState().itemState[template.id]?.status === 'error') return;
    }
    if (selectedPending.length > 0) await applyObservations();
  };
  const observationsNoun = `${selectedPending.length} selected ${
    selectedPending.length === 1 ? 'observation' : 'observations'
  }`;
  const chartSummary = templatePending
    ? selectedPending.length > 0
      ? `Applies the template and ${observationsNoun}`
      : 'Applies the template'
    : selectedPending.length > 0
    ? `Applies ${observationsNoun}`
    : pending.length > 0
    ? 'Nothing is selected'
    : 'Everything is charted';

  const summary = [
    pending.length > 0 ? `${selectedPending.length} of ${pending.length} selected` : undefined,
    appliedCount > 0 ? `${appliedCount} added` : undefined,
    chartedCount > 0 ? `${chartedCount} already charted` : undefined,
    skippedCount > 0 ? `${skippedCount} skipped` : undefined,
    failedCount > 0 ? `${failedCount} failed` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  const stages: ReactNode[] = [];

  // The story of the visit — or, until the model tells one, what it found in the transcript — comes
  // first, with the one button that charts the whole review. Every stage below is a piece of it made
  // actionable. Whatever the assistant said rather than charted is read here too.
  const lead =
    narrative.length > 0
      ? 'Here’s what I heard in the visit.'
      : recommendations.length > 0
      ? 'Here’s what I found in the transcript.'
      : 'I couldn’t find anything chartable in that transcript.';
  stages.push(
    <ScribeStage key="summary" name="summary" lead={lead}>
      {narrative.length > 0 && <NarrativeSummary templates={templates} onRetry={() => void applyObservations()} />}
      <AssistantNotes notes={notes} />
      {recommendations.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary" data-testid={testIds.chartSummary}>
            {chartSummary}
          </Typography>
          <RoundedButton
            variant="contained"
            onClick={() => void chartEverything()}
            disabled={(!templatePending && selectedPending.length === 0) || isApplying}
            loading={isApplying}
            data-testid={testIds.chartButton}
          >
            Chart
          </RoundedButton>
        </Box>
      )}
    </ScribeStage>
  );

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

  if (rejected.length > 0) stages.push(<RejectedList key="rejected" rejected={rejected} />);

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TranscriptSummary transcript={transcript} />
      {stages}
      {/* The executor's question, when a batch of one meets several near-equal matches or a removal needs confirming. */}
      <PickerDialog />
    </Box>
  );
};

/** What the assistant said rather than charted: a template it can only suggest, a request it could not classify. */
const AssistantNotes: FC<{ notes: string[] }> = ({ notes }) => {
  if (notes.length === 0) return null;
  return (
    <Box data-testid={testIds.notes} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {notes.map((note, index) => (
        <Alert key={index} severity="info" variant="outlined" sx={{ py: 0, '& .MuiAlert-message': { fontSize: 13 } }}>
          {note}
        </Alert>
      ))}
    </Box>
  );
};

/**
 * Actions the server refused, each with its reason. Listed rather than dropped, so something the transcript
 * said is never simply gone: a reading with no unit, a template the practice does not have.
 */
const RejectedList: FC<{ rejected: RejectedAction[] }> = ({ rejected }) => (
  <ScribeStage name="rejected" lead="These I couldn’t turn into chart entries; they need your hand.">
    <Paper variant="outlined" data-testid={testIds.rejected}>
      {rejected.map((item, index) => (
        <Box
          key={index}
          sx={{ px: 1, py: 0.75, '&:not(:last-of-type)': { borderBottom: '1px solid', borderColor: 'divider' } }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {describeAction({ kind: item.kind, display: item.display } as PlannedAction)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {item.reason}
          </Typography>
        </Box>
      ))}
    </Paper>
  </ScribeStage>
);

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
