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
import { FC, ReactNode, useEffect, useMemo, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { CHART_DATA_QUERY_KEY } from 'src/constants';
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
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { useAppointmentData, useChartData } from '../../stores/appointment/appointment.store';
import { AiDisclaimerTooltip } from '../AiSection';
import { getDocumentReferenceSource, getSource } from '../OttehrAi';
import { useListTemplates } from '../templates/useListTemplates';
import { useSyncChartedRecommendations } from './chartedRecommendations';
import { NarrativeEditor } from './NarrativeEditor';
import { narrativeText } from './narrativeLines';
import { OrderSuggestions } from './OrderSuggestions';
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

      {/*
        One screen, whether or not a plan has been read. The transcript and the narrative stay exactly
        where they were put — same chips, same editor, same button — and the suggestions arrive
        UNDERNEATH them rather than replacing them. Planning again is then the same button in the same
        place, so there is no way back to find; and the narrative a suggestion is questioned against is
        still on screen to read it against.
      */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NarrativeStep />
        {/* A plan read from the previous narrative, still on screen while the next one is being read,
            would be answering a narrative nobody is looking at. */}
        {phase === 'ready' && <ResultsStep />}
      </Box>
    </Box>
  );
};

/**
 * The input, in two parts, and the one button that reads it. First the TRANSCRIPT — picked from the
 * recordings and chats already on the visit — or typed or pasted into the transcript box, which adds it to the
 * visit and processes it as a recording would. The box also edits the selected transcript, which is then
 * processed again. Then the NARRATIVE written from it: one provider-voice paragraph the provider corrects, and the only
 * thing the planner is sent. The split is what makes the recommendations checkable: every one quotes the
 * narrative, and every generated sentence of the narrative is traceable to the transcript words it came
 * from — or is called out as coming from none.
 *
 * A visit with no transcript is not a dead end: the narrative editor is the provider's own box to type or
 * dictate into, and the planner reads that just the same.
 *
 * This stays on screen after the plan comes back, with the suggestions below it, so it is also how the
 * provider plans again: fix the narrative, press the button, confirm that the suggestions go.
 */
const NarrativeStep: FC = () => {
  const transcript = useScribeRecommendationsStore((state) => state.transcript);
  const sourceDocumentId = useScribeRecommendationsStore((state) => state.sourceDocumentId);
  const narrativeDraft = useScribeRecommendationsStore((state) => state.narrativeDraft);
  const narrativeStatus = useScribeRecommendationsStore((state) => state.narrativeStatus);
  const phase = useScribeRecommendationsStore((state) => state.phase);
  const analysisError = useScribeRecommendationsStore((state) => state.analysisError);
  // Suggestions being written into the chart are mid-flight; replacing them under the run would leave
  // the rows the executor is still reporting on belonging to a plan nobody asked for.
  const isApplying = useScribeRecommendationsStore((state) => state.isApplying);
  const selectTranscriptDocument = useScribeRecommendationsStore((state) => state.selectTranscriptDocument);
  const reloadTranscriptDocument = useScribeRecommendationsStore((state) => state.reloadTranscriptDocument);
  const clearTranscriptSelection = useScribeRecommendationsStore((state) => state.clearTranscriptSelection);
  const analyze = useScribeRecommendationsStore((state) => state.analyze);
  // The narrative and plan endpoints, each behind one function; the store only knows what it gets back.
  const generate = useNarrativeGenerator();
  const analyzer = useScribeAnalyzer();

  // The transcripts already on the visit ride along with the UNSCOPED chart-data call — the only one that
  // returns `aiChat` — which lands on the same react-query entry the analyzer's read does; the providers
  // come with them, for naming who recorded each one.
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

  // The analyzer goes along with the pick: once the narrative is ready the store reads the plan ahead of the
  // button, so the click has less to wait for. Nothing shows until the click.
  // Clicking the selected chip again unselects it.
  const pick = (doc: DocumentReference): void => {
    if (doc.id === sourceDocumentId) {
      clearTranscriptSelection();
      return;
    }
    void selectTranscriptDocument(doc, generate, analyzer);
  };

  // Saving a transcript writes it over the selected document, or adds a new one when none is selected; the
  // server processes it either way. The saved document is then (re)selected as soon as the refetched chart
  // data carries the saved text, as if its chip were clicked, so its new narrative replaces the draft.
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
    await queryClient.invalidateQueries({ queryKey: [CHART_DATA_QUERY_KEY, encounter.id] });
    setSavedTranscript({ documentId, text: text.trim(), edited: Boolean(sourceDocumentId) });
  };
  useEffect(() => {
    if (!savedTranscript) return;
    const doc = documents.find((d) => d.id === savedTranscript.documentId);
    if (!doc || transcriptTextOf(doc)?.trim() !== savedTranscript.text) return;
    setSavedTranscript(undefined);
    void (savedTranscript.edited ? reloadTranscriptDocument : selectTranscriptDocument)(doc, generate, analyzer);
  }, [savedTranscript, documents, selectTranscriptDocument, reloadTranscriptDocument, generate, analyzer]);

  // Planning again throws the standing suggestions away, and with them every tick and correction the
  // provider has made to them that hasn't been charted yet, so it is asked about first. A MUI dialog
  // rather than `window.confirm`: a browser dialog blocks the page, and nothing can drive it.
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

      {/* The picked document's dialogue, folded away: the narrative is what the provider works in. Opened, it
          edits the selected transcript, or takes a new one when none is selected. */}
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
 * Whether the chart holds anything at all, built out of the three prompt-side readers rather than a fourth
 * list of sections: `buildChartStateSummary` covers the coded items (diagnoses, conditions, medications,
 * allergies, procedures, ROS, orders), `chartedExamFindingLabels` the checked exam findings, and
 * `buildNoteContextFromChart` the free-text note fields. Each returns nothing for a section it finds empty,
 * so "any of them said something" is exactly "the chart is not blank" — and it stays that way as sections are
 * added to those helpers, which is why it is not a hand-written field list here.
 */
const chartHasContent = (chart: GetChartDataResponse | undefined): boolean =>
  Boolean(buildChartStateSummary(chart)) ||
  chartedExamFindingLabels(chart).length > 0 ||
  Boolean(buildNoteContextFromChart(chart));

/**
 * What the planner made of the narrative, under the narrative it read: the template it would apply, the
 * observations it would add, the orders it would suggest, and what it refused. The narrative itself is not
 * repeated here — it is a few lines up, in the editor, and one copy of it is the one being corrected.
 */
const ResultsStep: FC = () => {
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
  // The same chart read the analyzer makes — one react-query entry, already mounted above — only to tell
  // an empty plan's two meanings apart.
  const { encounter } = useAppointmentData();
  const { chartData } = useEasyChartData(encounter?.id, Boolean(encounter?.id));
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

  // A plan that found nothing is still an answer, and has to be given as one rather than as an empty panel.
  // TWO ANSWERS, because an empty plan has two meanings and only one of them is a failure: the planner
  // de-duplicates against the chart, so a narrative whose every item is already charted comes back just as
  // empty as one it could read nothing out of. Said the wrong way round — a provider who charted the
  // recording and then planned the intake chat of the same visit — "nothing chartable" reads as the
  // assistant having missed the whole visit. A chart with anything on it picks the reassuring sentence;
  // a blank chart can only mean the narrative itself yielded nothing.
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
          {/* Once every observation is in the chart there is nothing left for this button to do. */}
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

  if (orderSuggestions.length > 0) {
    stages.push(
      <ScribeStage key="orders" name="orders" lead="Finally, here are some orders you might want to make:">
        <OrderSuggestions />
      </ScribeStage>
    );
  }

  if (rejected.length > 0) stages.push(<RejectedList key="rejected" rejected={rejected} />);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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

/**
 * Actions the server refused, each with its reason. Listed rather than dropped, so something the transcript
 * said is never simply gone: a reading with no unit, a template the practice does not have.
 */
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
