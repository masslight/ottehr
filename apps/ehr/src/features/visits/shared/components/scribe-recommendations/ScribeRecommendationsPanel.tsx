import { aiIcon } from '@ehrTheme/icons';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  LinearProgress,
  Paper,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { DocumentReference } from 'fhir/r4b';
import { FC, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { describeAction } from 'src/features/easy-chart/executor/labels';
import { useEasyChartData } from 'src/features/easy-chart/hooks/useEasyChartData';
import { useApiClients } from 'src/hooks/useAppClients';
import { PlannedAction, RejectedAction } from 'utils/lib/easy-chart/api';
import {
  buildChartStateSummary,
  buildNoteContextFromChart,
  chartedExamFindingLabels,
} from 'utils/lib/easy-chart/chart-state';
import { isTranscriptDocument, transcriptTextOf } from 'utils/lib/easy-chart/narrative';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { invalidateChartSections } from '../../hooks/chartSectionCache';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { useAppointmentData, useChartData } from '../../stores/appointment/appointment.store';
import { AiDisclaimerTooltip } from '../AiSection';
import { getDocumentReferenceSource, getSource } from '../OttehrAi';
import { useListTemplates } from '../templates/useListTemplates';
import { useSyncChartedRecommendations } from './chartedRecommendations';
import { NarrativeEditor } from './NarrativeEditor';
import { narrativeText } from './narrativeLines';
import { PickerDialog } from './PickerDialog';
import { RecommendationsList } from './RecommendationsList';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { ScribeStage } from './ScribeStage';
import { roundedButtonSx, scaled } from './scribeTheme';
import { TemplateStage } from './TemplateStage';
import { TranscriptEvidence } from './TranscriptEvidence';
import { TemplateRecommendation } from './types';
import { useApplyRecommendations } from './useApplyRecommendations';
import { useNarrativeGenerator } from './useNarrativeGenerator';
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
      aria-label="Autochart"
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
        <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: scaled(13) }}>
          Autochart
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

      {/* The input stays on screen and results appear below it, so planning again uses the same button. */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NarrativeStep />
        {/* Hidden while planning again, since the old results answer the previous narrative. */}
        {phase === 'ready' && <ResultsStep />}
      </Box>
    </Box>
  );
};

/**
 * Transcript picker and editor, narrative editor and the "Plan note" button. Without a transcript the provider
 * types or dictates the narrative directly.
 */
const NarrativeStep: FC = () => {
  const transcript = useScribeRecommendationsStore((state) => state.transcript);
  const sourceDocumentId = useScribeRecommendationsStore((state) => state.sourceDocumentId);
  const narrativeDraft = useScribeRecommendationsStore((state) => state.narrativeDraft);
  const narrativeStatus = useScribeRecommendationsStore((state) => state.narrativeStatus);
  const phase = useScribeRecommendationsStore((state) => state.phase);
  const analysisError = useScribeRecommendationsStore((state) => state.analysisError);
  // Planning again mid-apply would replace rows the executor is still reporting on.
  const isApplying = useScribeRecommendationsStore((state) => state.isApplying);
  const selectTranscriptDocument = useScribeRecommendationsStore((state) => state.selectTranscriptDocument);
  const reloadTranscriptDocument = useScribeRecommendationsStore((state) => state.reloadTranscriptDocument);
  const clearTranscriptSelection = useScribeRecommendationsStore((state) => state.clearTranscriptSelection);
  const analyze = useScribeRecommendationsStore((state) => state.analyze);
  const generate = useNarrativeGenerator();
  const analyzer = useScribeAnalyzer();

  // Transcripts come from the aiChat chart section, the same cache entry the layout's recording poll updates.
  const { encounter } = useAppointmentData();
  const { chartData } = useChartData({ encounterId: encounter?.id, enabled: Boolean(encounter?.id) });
  const { oystehr } = useApiClients();
  const documents = useMemo(
    () =>
      (chartData?.aiChat?.documents ?? [])
        .filter(isTranscriptDocument)
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
    [chartData?.aiChat?.documents]
  );
  const hasPendingRecording = Boolean(chartData?.aiChat?.hasPendingRecording);

  const isAnalyzing = phase === 'analyzing';
  const isGenerating = narrativeStatus === 'generating';
  const isBusy = isAnalyzing || isGenerating;
  const narrative = narrativeText(narrativeDraft);

  // Clicking the selected chip again unselects it. The analyzer lets the store read the plan ahead.
  const pick = (doc: DocumentReference): void => {
    if (doc.id === sourceDocumentId) {
      clearTranscriptSelection();
      return;
    }
    void selectTranscriptDocument(doc, generate, analyzer);
  };

  // Saving overwrites the selected document or adds a new one. Once the refetched chart data carries the saved
  // text, the document is (re)selected so its new narrative replaces the draft.
  const apiClient = useOystehrAPIClient();
  const queryClient = useQueryClient();
  const [savedTranscript, setSavedTranscript] = useState<{ documentId: string; text: string; edited: boolean }>();
  const saveTranscript = async (text: string): Promise<void> => {
    if (!apiClient || !encounter?.id) throw new Error('The visit is still loading. Please try again.');
    const { documentId } = await apiClient.easyChartSaveTranscript({
      transcript: text,
      encounterId: encounter.id,
      documentId: sourceDocumentId,
    });
    // Only the aiChat section changed; refetching it brings in the saved document.
    await invalidateChartSections(queryClient, encounter.id, ['aiChat']);
    setSavedTranscript({ documentId, text: text.trim(), edited: Boolean(sourceDocumentId) });
  };
  // Handle each save once: selecting re-renders this before the cleared state lands.
  const handledSave = useRef<typeof savedTranscript>();
  useEffect(() => {
    if (!savedTranscript || handledSave.current === savedTranscript) return;
    const doc = documents.find((d) => d.id === savedTranscript.documentId);
    if (!doc || transcriptTextOf(doc)?.trim() !== savedTranscript.text) return;
    handledSave.current = savedTranscript;
    setSavedTranscript(undefined);
    void (savedTranscript.edited ? reloadTranscriptDocument : selectTranscriptDocument)(doc, generate, analyzer);
  }, [savedTranscript, documents, selectTranscriptDocument, reloadTranscriptDocument, generate, analyzer]);

  // Planning again discards unapplied ticks and edits, so it asks first.
  const [replanOpen, setReplanOpen] = useState(false);
  const runAnalysis = (): void => {
    setReplanOpen(false);
    void analyze(analyzer);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
        Select a transcript or type/dictate a narrative.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography variant="subtitle2" sx={{ fontSize: scaled(13) }}>
          Transcripts on this visit
        </Typography>
        {documents.length === 0 && !hasPendingRecording ? (
          <Typography variant="caption" color="text.secondary">
            No transcripts on this visit yet.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {documents.map((doc) => {
              const source = getDocumentReferenceSource(doc);
              const selected = doc.id === sourceDocumentId;
              return (
                <Chip
                  key={doc.id}
                  label={`${source === 'audio' ? '🎤' : '💬'} ${getSource(doc, oystehr, chartData?.aiChat?.providers)}`}
                  variant={selected ? 'filled' : 'outlined'}
                  color={selected ? 'primary' : 'default'}
                  onClick={() => pick(doc)}
                  disabled={isBusy}
                  data-testid={testIds.transcriptChip(doc.id ?? '')}
                />
              );
            })}
            {hasPendingRecording && (
              <Chip label="Transcribing…" variant="outlined" disabled data-testid={testIds.transcriptPendingChip} />
            )}
          </Box>
        )}
      </Box>

      {/* Collapsed transcript; opened, it edits the selected one or takes a new one. */}
      <TranscriptEvidence
        transcript={transcript}
        documentId={sourceDocumentId}
        disabled={isBusy || isApplying}
        onSave={saveTranscript}
      />

      <NarrativeEditor disabled={isBusy} />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
        <RoundedButton
          variant="contained"
          onClick={() => (phase === 'ready' ? setReplanOpen(true) : runAnalysis())}
          disabled={!narrative || isBusy || isApplying}
          loading={isAnalyzing}
          sx={roundedButtonSx}
          data-testid={testIds.analyzeButton}
        >
          Plan note
        </RoundedButton>
      </Box>
      <Dialog open={replanOpen} onClose={() => setReplanOpen(false)} data-testid={testIds.replanDialog}>
        <DialogTitle>Replace the suggestions?</DialogTitle>
        <DialogContent>
          <DialogContentText>Anything you’ve ticked or edited but not yet applied will be lost.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setReplanOpen(false)}
            sx={{ textTransform: 'none' }}
            data-testid={testIds.replanCancelButton}
          >
            Cancel
          </Button>
          <RoundedButton
            variant="contained"
            onClick={runAnalysis}
            sx={roundedButtonSx}
            data-testid={testIds.replanConfirmButton}
          >
            Replace
          </RoundedButton>
        </DialogActions>
      </Dialog>
      {isAnalyzing && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary">
            Reading the narrative and drafting recommendations…
          </Typography>
        </Box>
      )}
      {analysisError && <Alert severity="error">{analysisError}</Alert>}
    </Box>
  );
};

/**
 * Reuses the prompt-side chart readers (coded items, exam findings, note fields) rather than a separate
 * section list, so it stays correct as sections are added to them.
 */
const chartHasContent = (chart: GetChartDataResponse | undefined): boolean =>
  Boolean(buildChartStateSummary(chart)) ||
  chartedExamFindingLabels(chart).length > 0 ||
  Boolean(buildNoteContextFromChart(chart));

/** The plan's template, observations and refused actions, shown below the narrative editor. */
const ResultsStep: FC = () => {
  const recommendations = useScribeRecommendationsStore((state) => state.recommendations);
  const itemState = useScribeRecommendationsStore((state) => state.itemState);
  const rejected = useScribeRecommendationsStore((state) => state.rejected);
  const notes = useScribeRecommendationsStore((state) => state.notes);
  const isApplying = useScribeRecommendationsStore((state) => state.isApplying);
  const setManySelected = useScribeRecommendationsStore((state) => state.setManySelected);
  const updateRecommendation = useScribeRecommendationsStore((state) => state.updateRecommendation);
  const chartedIds = useScribeRecommendationsStore((state) => state.chartedIds);
  const { templates } = useListTemplates();
  // Shares the analyzer's query; used only to tell an empty plan's two meanings apart.
  const { encounter } = useAppointmentData();
  const { chartData } = useEasyChartData(encounter?.id);
  const { applyObservations, applyRecommendation } = useApplyRecommendations();

  // Marks off recommendations the chart already holds, however they got there.
  useSyncChartedRecommendations(recommendations);

  // The template writes whole sections, so it leads; the observations land on top of it.
  const template = recommendations.find((rec): rec is TemplateRecommendation => rec.kind === 'template');
  const observations = recommendations.filter((rec) => rec.section !== 'template');

  const charted = new Set(chartedIds);
  const appliedCount = observations.filter((rec) => itemState[rec.id]?.status === 'applied').length;
  const chartedCount = observations.filter(
    (rec) => charted.has(rec.id) && itemState[rec.id]?.status !== 'applied'
  ).length;
  const pending = observations.filter((rec) => itemState[rec.id]?.status !== 'applied' && !charted.has(rec.id));
  const selectedPending = pending.filter((rec) => itemState[rec.id]?.selected);
  const failedCount = observations.filter((rec) => itemState[rec.id]?.status === 'error').length;
  const skippedCount = observations.filter((rec) => itemState[rec.id]?.status === 'skipped').length;
  const allPendingSelected = pending.length > 0 && selectedPending.length === pending.length;

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

  // The planner de-duplicates against the chart, so an empty plan means either everything is already charted
  // or nothing was chartable; a non-empty chart implies the former.
  if (recommendations.length === 0) {
    const lead = chartHasContent(chartData)
      ? 'Nothing new to chart — everything in this narrative is already on the chart.'
      : 'I couldn’t find anything chartable in that narrative.';
    stages.push(
      <ScribeStage key="summary" name="summary" lead={lead}>
        <AssistantNotes notes={notes} />
      </ScribeStage>
    );
  } else if (notes.length > 0) {
    stages.push(<AssistantNotes key="notes" notes={notes} />);
  }

  if (template) {
    stages.push(
      <ScribeStage key="template" name="template" lead="Template suggestion">
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
        lead="Then add these observations, which I read in the narrative."
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
                sx={{ textTransform: 'none', alignSelf: 'flex-start', minWidth: 0, p: 0, fontSize: scaled(12) }}
                data-testid={testIds.toggleAllButton}
              >
                {allPendingSelected ? 'Deselect all' : 'Select all'}
              </Button>
            )}
          </Box>
          {pending.length > 0 && (
            <RoundedButton
              variant="contained"
              onClick={() => void applyObservations()}
              disabled={selectedPending.length === 0 || isApplying}
              loading={isApplying}
              sx={roundedButtonSx}
              data-testid={testIds.applyObservationsButton}
            >
              Chart note
            </RoundedButton>
          )}
        </Box>
      </ScribeStage>
    );
  }

  if (rejected.length > 0) stages.push(<RejectedList key="rejected" rejected={rejected} />);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {stages}
      {/* Executor questions: which of several near-equal matches to use. */}
      <PickerDialog />
    </Box>
  );
};

/** What the assistant said rather than charted, e.g. a request it could not classify. */
const AssistantNotes: FC<{ notes: string[] }> = ({ notes }) => {
  if (notes.length === 0) return null;
  return (
    <Box data-testid={testIds.notes} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {notes.map((note, index) => (
        <Alert
          key={index}
          severity="info"
          variant="outlined"
          sx={{ py: 0, '& .MuiAlert-message': { fontSize: scaled(13) } }}
        >
          {note}
        </Alert>
      ))}
    </Box>
  );
};

/** Actions the server refused, listed with their reasons so nothing the transcript said silently disappears. */
const RejectedList: FC<{ rejected: RejectedAction[] }> = ({ rejected }) => (
  <ScribeStage name="rejected" lead="Consider adding manually">
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
