// Easy Chart: the visit note on the left, the AI charting assistant on the right.
//
// LAYOUT SPECIFICS THAT MATTER, not cosmetics:
//   - `Container maxWidth={false}` — the note needs the width; do not centre it in a narrow column.
//   - CSS grid `3fr minmax(320px, 2fr)` on md+, single column below. The minmax floor stops the
//     assistant collapsing to unusable width on a laptop.
//   - The grid is constrained to the VIEWPORT on md+, so the page itself does not scroll: the wheel
//     over the left column scrolls the NOTE, the wheel over the chat scrolls the CHAT, and the chat
//     stays pinned in view with its composer at the bottom. Providers read the note while the
//     assistant works, and a single page scroll would drag the composer off screen.
//   - Everything above the grid is fixed chrome and must stay SHORT — a patient line and one row of
//     detail. Each pixel spent there is a pixel taken from both scrolling columns, so the attestation
//     and the readiness banner scroll WITH the note rather than sitting above it.
//
// The two attestations sit above the note's sections but INSIDE its scroll: the name/DOB verification
// and the readiness banner.

import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LoadingScreen } from 'src/components/LoadingScreen';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import { getPatientName } from 'src/shared/utils/getPatientName';
import { NoteTextField } from 'utils/lib/easy-chart/actions';
import { chartKeyForNoteField } from 'utils/lib/easy-chart/note-fields';
import { computeSignBlockers } from 'utils/lib/easy-chart/sign-blockers';
import { AssistantColumn } from '../components/AssistantColumn';
import { NotePane } from '../components/NotePane';
import { buildChartSnapshot } from '../executor/chartSnapshot';
import { PlanStep } from '../executor/types';
import { useChartAssistant } from '../hooks/useChartAssistant';
import { useChartWriter } from '../hooks/useChartWriter';
import { useCatalogue } from '../hooks/useCatalogue';
import { useEasyChartData } from '../hooks/useEasyChartData';
import {
  clearAuthorship,
  emptyProvenance,
  markAllReviewed,
  markReviewed,
  needsReview,
  recordAiAuthorship,
} from '../provenance/provenance';

/** The Container's own bottom padding (`py: 2`), which the grid must leave room for. */
const GRID_BOTTOM_GAP_PX = 16;

/**
 * A height that makes the element fill the rest of the viewport, MEASURED rather than hard-coded.
 *
 * The chrome above the grid is not a constant: the environment banner is present outside production,
 * the navbar's height is a theme detail, and the patient line wraps to a second row when the allergy
 * list is long. An offset guessed too small gives the PAGE a scrollbar, which unpins the composer —
 * the one thing this layout exists to prevent — and one guessed too large wastes rows of the note.
 * The element's own `top` cannot be wrong about any of it.
 */
function useFillViewportHeight(): { ref: (node: HTMLElement | null) => void; height: string } {
  // The node is STATE, not a ref: the grid mounts only after the loading screen goes away, and an
  // effect keyed on a ref would have already run against `null` and never attached its observer.
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [top, setTop] = useState<number | null>(null);

  // Layout effect, so the measured height is in place before the first paint — a frame at the
  // unmeasured fallback flashes a page scrollbar.
  useLayoutEffect(() => {
    if (!node) return;
    const measure = (): void => setTop(node.getBoundingClientRect().top);
    measure();
    window.addEventListener('resize', measure);
    // The chrome above can also change without the window resizing — allergies arrive and the detail
    // line wraps. Watching the PARENT catches that: setting our own height changes the parent's, which
    // re-fires this, but the re-measured top is identical so the state settles immediately.
    const parent = node.parentElement;
    const observer = typeof ResizeObserver === 'undefined' || !parent ? undefined : new ResizeObserver(measure);
    if (parent) observer?.observe(parent);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [node]);

  return { ref: setNode, height: top == null ? '100vh' : `calc(100vh - ${Math.round(top + GRID_BOTTOM_GAP_PX)}px)` };
}

export const EasyChartPage: FC = () => {
  const { encounterId } = useParams<{ encounterId: string }>();
  const { chartData, isLoading, refetch } = useEasyChartData(encounterId);
  const { data: progressNoteConfig } = useProgressNoteConfig();
  const { isAppointmentReadOnly } = useGetAppointmentAccessibility();

  const [provenance, setProvenance] = useState(emptyProvenance);
  const [verified, setVerified] = useState(false);

  const catalogue = useCatalogue({ encounterId });
  const writer = useChartWriter({
    encounterId: encounterId ?? '',
    diagnoses: chartData?.diagnosis,
    onRemoved: (ids) => setProvenance((state) => clearAuthorship(state, ids)),
    onOrdersChanged: () => void refetch(),
  });

  // Attribute every row a step created. A verified quote makes it `sourced` (blue); anything else,
  // including a bulk-run auto-pick, is honestly `inferred` (amber).
  const onStepsSettled = useCallback((steps: PlanStep[]): void => {
    setProvenance((state) => {
      let next = state;
      for (const step of steps) {
        const created = step.outcome?.createdResourceIds ?? [];
        if (created.length === 0) continue;
        next = recordAiAuthorship(next, {
          resourceIds: created,
          sourceText: step.action.sourceText,
          caution: step.action.caution,
          lowConfidence: step.outcome?.lowConfidence,
        });
      }
      return next;
    });
  }, []);

  const assistant = useChartAssistant({
    encounterId: encounterId ?? '',
    chartData,
    catalogue,
    writer,
    refetchChart: refetch,
    onStepsSettled,
    readOnly: isAppointmentReadOnly,
  });

  const snapshot = useMemo(() => buildChartSnapshot(chartData), [chartData]);

  // The SHARED sign rules, so a clean banner here means a signable note. `patientInfoConfirmed` is
  // this page's own checkbox until it is saved to the chart.
  const blockers = useMemo(
    () =>
      computeSignBlockers({
        hasPrimaryDiagnosis: snapshot.diagnoses.some((dx) => dx.isPrimary),
        medicalDecision: chartData?.medicalDecision?.text,
        hasEmCode: snapshot.hasEmCode,
        hpi: chartData?.[chartKeyForNoteField('historyOfPresentIllness')]?.text,
        patientInfoConfirmed: verified || chartData?.patientInfoConfirmed?.value,
        accident: chartData?.accident,
        inHouseLabResults: chartData?.inHouseLabResults,
        mdmRequired: progressNoteConfig?.mdmRequired ?? true,
      }),
    [snapshot, chartData, verified, progressNoteConfig?.mdmRequired]
  );

  const unreviewed = needsReview(provenance);

  const saveNoteText = useCallback(
    async (field: NoteTextField, text: string): Promise<void> => {
      await writer.save({ [chartKeyForNoteField(field)]: { text } });
      await refetch();
    },
    [writer, refetch]
  );

  if (!encounterId) return <Typography>No encounter selected.</Typography>;
  if (isLoading) return <LoadingScreen />;

  const patient = chartData?.patientId;
  const bannerSeverity = blockers.length > 0 ? 'warning' : unreviewed.length > 0 ? 'info' : 'success';

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      <Stack spacing={2} sx={{ height: { md: 'calc(100vh - 120px)' }, minHeight: 0 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
            <Box>
              <Typography variant="h6">{getPatientName(undefined).firstLastName || 'Visit note'}</Typography>
              <Typography variant="body2" color="text.secondary">
                Encounter {encounterId}
                {patient ? ` · Patient ${patient}` : ''}
              </Typography>
              {/* Red and bold when allergies exist, a grey "none" when they do not — a provider must be
                  able to see at a glance that this was checked. */}
              <Typography
                variant="body2"
                sx={{
                  color: snapshot.allergies.length > 0 ? 'error.main' : 'text.secondary',
                  fontWeight: snapshot.allergies.length > 0 ? 700 : 400,
                }}
              >
                Allergies:{' '}
                {snapshot.allergies.length > 0 ? snapshot.allergies.map((a) => a.display).join(', ') : 'none recorded'}
              </Typography>
            </Box>
            {/* The in-person route is keyed by APPOINTMENT id, not encounter id. Handing it an
                encounter id loads no appointment into the store, so the layout's mode-initialisation
                effect never fires and the page spins on a loader with no error. Hide the button when
                the visit has no appointment (an annotation follow-up) rather than link nowhere. */}
            {visit.appointment?.id && (
              <Button
                size="small"
                endIcon={<OpenInNewIcon />}
                component={Link}
                href={`/in-person/${visit.appointment.id}/progress-note`}
                target="_blank"
                rel="noopener"
              >
                Open in regular chart
              </Button>
            )}
          </Stack>
        </Paper>

        {/* Attestation one. Amber until checked, green once checked. */}
        <Alert severity={verified ? 'success' : 'warning'} sx={{ py: 0 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={verified}
                onChange={(event) => setVerified(event.target.checked)}
                data-testid="easy-chart-verify-patient"
              />
            }
            label="I verified patient's name and date of birth."
          />
        </Alert>

        {/* Attestation two: one banner, not several. */}
        <Alert
          severity={bannerSeverity}
          action={
            unreviewed.length > 0 ? (
              <Button size="small" onClick={() => setProvenance(markAllReviewed)}>
                Confirm all
              </Button>
            ) : undefined
          }
        >
          <AlertTitle sx={{ mb: 0 }}>
            {unreviewed.length > 0 ? `${unreviewed.length} item${unreviewed.length === 1 ? '' : 's'} need review` : null}
            {unreviewed.length > 0 && blockers.length > 0 ? ' · ' : ''}
            {blockers.length > 0 ? blockers.map((blocker) => blocker.text).join(' · ') : null}
            {unreviewed.length === 0 && blockers.length === 0 ? 'Ready to sign.' : null}
          </AlertTitle>
        </Alert>

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: '3fr minmax(320px, 2fr)' },
            flex: 1,
            minHeight: 0,
          }}
        >
          <Paper variant="outlined" sx={{ p: 2, overflowY: { md: 'auto' }, minHeight: 0 }}>
            <NotePane
              chartData={chartData}
              provenance={provenance}
              readOnly={isAppointmentReadOnly}
              onSaveNoteText={saveNoteText}
              onNoteEditStart={() => {
                // A hand-edit clears the AI mark for that field's row, so the note reflects who really
                // wrote what. The field's own resourceId is the row it owns.
                const ids = [chartData?.chiefComplaint?.resourceId, chartData?.medicalDecision?.resourceId].filter(
                  (id): id is string => Boolean(id)
                );
                setProvenance((state) => clearAuthorship(state, ids));
              }}
              onConfirmItem={(resourceId) => setProvenance((state) => markReviewed(state, [resourceId]))}
              onDeleteItem={(field, resourceId, display) => {
                void writer.remove(field, { resourceId, display }).then(refetch);
              }}
            />
            </Paper>

            <Typography variant="caption" color="text.secondary">
              Times shown in {DateTime.local().zoneName}.
            </Typography>
          </Stack>
        </Box>

        {/* The chat, pinned. It owns its own scroll: the thread scrolls inside it and the composer
            stays at the bottom of the cell, so a wheel over the chat never moves the note and a wheel
            over the note never moves the composer out of reach. */}
        <Box sx={{ minWidth: 0, minHeight: 0, display: 'flex' }}>
          <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
            <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
              <AssistantColumn
                assistant={assistant}
                readOnly={isAppointmentReadOnly}
                readOnlyReason={
                  isAppointmentReadOnly
                    ? 'This visit is signed. The assistant cannot write to it — append an addendum in the regular chart.'
                    : undefined
                }
              />
            </Box>
          </Paper>
        </Box>
      </Box>
    </Container>
  );
};

export default EasyChartPage;
