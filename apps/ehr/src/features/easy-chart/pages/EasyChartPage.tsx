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
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LoadingScreen } from 'src/components/LoadingScreen';
import { useGetImmunizationOrders } from 'src/features/visits/in-person/hooks/useImmunization';
import { useGetMedicationOrders } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import { NoteTextField } from 'utils/lib/easy-chart/actions';
import { chartKeyForNoteField, NOTE_FIELD_LABELS } from 'utils/lib/easy-chart/note-fields';
import { computeSignBlockers } from 'utils/lib/easy-chart/sign-blockers';
import { ItemCorrection } from '../components/AiChartedItem';
import { AssistantColumn } from '../components/AssistantColumn';
import { NotePane } from '../components/NotePane';
import { buildChartSnapshot } from '../executor/chartSnapshot';
import { CORRECTION_SEARCH, CORRECTION_WRITE } from '../executor/corrections';
import { isCatalogueList, PlanStep } from '../executor/types';
import { useCatalogue } from '../hooks/useCatalogue';
import { useChartAssistant } from '../hooks/useChartAssistant';
import { useChartWriter } from '../hooks/useChartWriter';
import { useEasyChartData } from '../hooks/useEasyChartData';
import { useEasyChartLabOrders } from '../hooks/useEasyChartLabOrders';
import { useEasyChartVisit } from '../hooks/useEasyChartVisit';
import {
  clearAuthorship,
  emptyProvenance,
  markAllReviewed,
  markProcedureFieldReviewed,
  markReviewed,
  needsReview,
  recordAiAuthorship,
  recordFieldAuthorship,
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
  // Read the visit by ENCOUNTER id: the appointment store is empty on this route, and reading the
  // lock state from it would report a signed visit as writable.
  const visit = useEasyChartVisit(encounterId);
  const isAppointmentReadOnly = visit.isReadOnly;

  const [provenance, setProvenance] = useState(emptyProvenance);
  const [verified, setVerified] = useState(false);

  const catalogue = useCatalogue({ encounterId });
  // Lab ORDERS, which chart data does not carry — it carries results. Both sections exist, in that order.
  const labOrders = useEasyChartLabOrders(encounterId);
  const writer = useChartWriter({
    encounterId: encounterId ?? '',
    diagnoses: chartData?.diagnosis,
    // Both are for the procedure write: a quick-pick carries its own CPT codes and supporting
    // diagnoses, and re-saving one the plan already charted from the dictation duplicated it on the
    // note. `procedures` is how the write tells which row in its response is the one it just created.
    cptCodes: chartData?.cptCodes,
    procedures: chartData?.procedures,
    onRemoved: (ids) => setProvenance((state) => clearAuthorship(state, ids)),
    onOrdersChanged: () => {
      void refetch();
      // The orders list is its own query, so a placed order has to refresh it too or the "Labs ordered"
      // section stays a step behind what the assistant just did.
      labOrders.refetch();
    },
  });

  // Attribute every row a step created. A verified quote makes it `sourced` (blue); anything else,
  // including a bulk-run auto-pick, is honestly `inferred` (amber).
  const onStepsSettled = useCallback((steps: PlanStep[]): void => {
    setProvenance((state) => {
      let next = state;
      for (const step of steps) {
        const created = step.outcome?.createdResourceIds ?? [];
        // A composite step creates rows of DIFFERENT provenance. A procedure quick-pick's linked
        // diagnoses and CPT codes were contributed by the template, not spoken, so they must not
        // inherit the procedure's verbatim quote and read as blue "the provider said this".
        const fromTemplate = new Set(step.outcome?.inferredResourceIds ?? []);
        const dictated = created.filter((id) => !fromTemplate.has(id));
        if (dictated.length > 0) {
          next = recordAiAuthorship(next, {
            resourceIds: dictated,
            sourceText: step.action.sourceText,
            caution: step.action.caution,
            lowConfidence: step.outcome?.lowConfidence,
          });
        }
        if (fromTemplate.size > 0) {
          next = recordAiAuthorship(next, {
            resourceIds: [...fromTemplate],
            caution: 'added by the procedure quick-pick, not stated in the visit',
            lowConfidence: true,
          });
        }
        // Per-field markers for the composite row itself: ten template-filled fields, ten separate
        // confirmations.
        for (const entry of step.outcome?.templateFilledFields ?? []) {
          next = recordFieldAuthorship(
            next,
            entry.resourceId,
            Object.fromEntries(entry.fields.map((field) => [field, { origin: 'template-default' as const }]))
          );
        }
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

  // Two sections are NOT chart data, and getting them from there is what showed a medication from a
  // previous visit: `chartData.inhouseMedications` is fetched PATIENT-scoped, so it is the patient's
  // history across every encounter. The MAR and immunization queries are encounter-scoped.
  const { data: medicationOrders } = useGetMedicationOrders({ field: 'encounterId', value: encounterId ?? '' });
  const { data: immunizationOrders } = useGetImmunizationOrders({
    encounterIds: encounterId ? [encounterId] : undefined,
  });
  const administeredImmunizations = useMemo(
    () =>
      (immunizationOrders?.orders ?? []).filter(
        // Only what was actually GIVEN. An ordered-but-not-administered immunization is not part of
        // this visit's record.
        (order) => order.status === 'administered' || order.status === 'administered-partly'
      ),
    [immunizationOrders]
  );

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

  /**
   * Click-to-correct, per field. The search is the SAME catalogue the assistant resolved against, so a
   * provider correcting a row is choosing from what the assistant could have chosen — and the write
   * replaces the row rather than adding a second one.
   */
  const buildCorrection = useCallback(
    (field: string, item: { resourceId: string; display: string }): ItemCorrection | undefined => {
      const search = CORRECTION_SEARCH[field];
      const write = CORRECTION_WRITE[field];
      if (!search || !write || isAppointmentReadOnly) return undefined;
      return {
        initialQuery: item.display,
        search: async (query) => {
          const result = await search(catalogue, query);
          // `undefined` means the catalogue could not be consulted at all, which is not the same as
          // "nothing matched" — an empty list is the honest answer for both, but the editor's own
          // message tells the provider to reword rather than to go elsewhere.
          return isCatalogueList(result) ? result.map((match) => ({ id: match.id, display: match.display })) : [];
        },
        replace: async (option) => {
          try {
            // Remove first, then write: leaving both versions on the note is worse than a brief gap.
            await writer.remove(field, item);
            await writer.save(write(option, undefined));
            await refetch();
          } catch (error) {
            console.error('[easy-chart] correction failed', error);
            enqueueSnackbar(
              `Could not replace "${item.display}": ${error instanceof Error ? error.message : 'unknown error'}`,
              { variant: 'error' }
            );
          }
        },
      };
    },
    [catalogue, writer, refetch, isAppointmentReadOnly]
  );

  const saveNoteText = useCallback(
    async (field: NoteTextField, text: string): Promise<void> => {
      try {
        await writer.save({ [chartKeyForNoteField(field)]: { text } });
        await refetch();
      } catch (error) {
        console.error('[easy-chart] note save failed', error);
        enqueueSnackbar(
          `Could not save ${NOTE_FIELD_LABELS[field]}: ${error instanceof Error ? error.message : 'unknown error'}`,
          { variant: 'error' }
        );
      }
    },
    [writer, refetch]
  );

  // Before the early returns: the loading screen renders instead of the grid, and a hook skipped on
  // that render would change hook order.
  const viewport = useFillViewportHeight();

  if (!encounterId) return <Typography>No encounter selected.</Typography>;
  if (isLoading || visit.isLoading) return <LoadingScreen />;

  const bannerSeverity = blockers.length > 0 ? 'warning' : unreviewed.length > 0 ? 'info' : 'success';

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      {/* Fixed chrome. Plain text rather than a card: a bordered Paper here costs ~32px of both
          scrolling columns for nothing, and the detail line reads fine as one row. */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" fontWeight={600} data-testid="easy-chart-patient">
            {visit.patientLine || 'Visit note'}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'baseline' }}>
            <Typography variant="caption" color="text.secondary">
              {visit.reasonForVisit ? `Reason: ${visit.reasonForVisit}` : `Encounter ${encounterId}`}
            </Typography>
            {/* Red and bold when allergies exist, a grey "none" when they do not — a provider must be
                able to see at a glance that this was checked. */}
            <Typography
              variant="caption"
              sx={{
                color: snapshot.allergies.length > 0 ? 'error.main' : 'text.secondary',
                fontWeight: snapshot.allergies.length > 0 ? 700 : 400,
              }}
            >
              Allergies: {snapshot.allergies.length > 0 ? snapshot.allergies.map((a) => a.display).join(', ') : 'none'}
            </Typography>
          </Box>
        </Box>
        {/* The in-person route is keyed by APPOINTMENT id, not encounter id. Handing it an
            encounter id loads no appointment into the store, so the layout's mode-initialisation
            effect never fires and the page spins on a loader with no error. Hide the button when
            the visit has no appointment (an annotation follow-up) rather than link nowhere. */}
        {visit.appointment?.id && (
          <Button
            variant="outlined"
            size="small"
            endIcon={<OpenInNewIcon />}
            component={Link}
            href={`/in-person/${visit.appointment.id}/progress-note`}
            target="_blank"
            rel="noopener"
            sx={{ textTransform: 'none', flexShrink: 0 }}
          >
            Open in regular chart
          </Button>
        )}
      </Stack>

      <Box
        ref={viewport.ref}
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '3fr minmax(320px, 2fr)' },
          // Viewport-bound on md+ so the two columns scroll independently and the chat stays pinned.
          // Below md there is one column and the page scrolls normally, which is the right behaviour
          // on a phone — a pinned half-height chat there would leave no room for the note.
          height: { md: viewport.height },
          minHeight: 0,
        }}
      >
        {/* The note's own scroll. `pr` keeps the scrollbar off the section text. */}
        <Box sx={{ overflowY: { md: 'auto' }, pr: { md: 1 }, minHeight: 0 }}>
          <Stack spacing={2}>
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
                {unreviewed.length > 0
                  ? `${unreviewed.length} item${unreviewed.length === 1 ? '' : 's'} need review`
                  : null}
                {unreviewed.length > 0 && blockers.length > 0 ? ' · ' : ''}
                {blockers.length > 0 ? blockers.map((blocker) => blocker.text).join(' · ') : null}
                {unreviewed.length === 0 && blockers.length === 0 ? 'Ready to sign.' : null}
              </AlertTitle>
            </Alert>

            <Paper variant="outlined" sx={{ p: 2 }}>
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
                // A vital typed by hand is provider-entered, so it carries no AI mark. The editor has
                // already converted to the canonical unit the chart stores.
                onSaveVital={async (draft) => {
                  try {
                    await writer.save({ vitalsObservations: [draft] });
                    await refetch();
                  } catch (error) {
                    console.error('[easy-chart] vital save failed', error);
                    enqueueSnackbar(
                      `Could not save that vital: ${error instanceof Error ? error.message : 'unknown error'}`,
                      { variant: 'error' }
                    );
                  }
                }}
                // Promoting a diagnosis demotes the current primary in the SAME save, so the note is
                // never momentarily left with two primaries or none.
                onMakePrimary={async (diagnosis) => {
                  const current = chartData?.diagnosis?.find(
                    (dx) => dx.isPrimary && dx.resourceId !== diagnosis.resourceId
                  );
                  try {
                    await writer.save({
                      diagnosis: [
                        ...(current ? [{ ...current, isPrimary: false }] : []),
                        { ...diagnosis, isPrimary: true },
                      ],
                    });
                    await refetch();
                  } catch (error) {
                    console.error('[easy-chart] make primary failed', error);
                    enqueueSnackbar(
                      `Could not make "${diagnosis.display}" primary: ${
                        error instanceof Error ? error.message : 'unknown error'
                      }`,
                      { variant: 'error' }
                    );
                  }
                }}
                // Confirming ONE template-filled field. The whole-item confirm is separate on purpose:
                // accepting a procedure must not accept ten assertions the provider never made.
                onConfirmProcedureField={(resourceId, field) =>
                  setProvenance((state) => markProcedureFieldReviewed(state, resourceId, field))
                }
                buildCorrection={buildCorrection}
                labOrders={labOrders.orders}
                appointmentStart={visit.appointment?.start}
                encounterId={encounterId}
                // The disposition card writes through its own mutation, so this page's chart query has
                // to be refetched or the sign-blockers and the assistant's snapshot stay a step behind.
                onDispositionSaved={() => void refetch()}
                // A field the provider rewrote by hand is no longer AI-written, so the mark on the row it
                // owns is dropped as well as the chart being refetched.
                onNoteFieldSaved={() => {
                  const ids = [chartData?.chiefComplaint?.resourceId, chartData?.mechanismOfInjury?.resourceId].filter(
                    (id): id is string => Boolean(id)
                  );
                  setProvenance((state) => clearAuthorship(state, ids));
                  void refetch();
                }}
                addendumResources={{
                  encounterId,
                  appointmentId: visit.appointment?.id,
                  patientId: visit.patient?.id,
                }}
                inHouseMedications={medicationOrders?.orders ?? []}
                immunizations={administeredImmunizations.map((order) => ({
                  id: order.id,
                  medicationName: order.details.medication.name,
                  status: order.status,
                  details: [order.details.dose, order.details.units, order.details.route].filter(Boolean).join(' '),
                }))}
                onDeleteItem={(field, resourceId, display) => {
                  // A failed delete must SAY so. `void promise.then()` with no catch is how "remove did
                  // nothing" happens: the row stays, the error goes to an unhandled rejection, and the
                  // provider has no idea whether the item is still on the chart.
                  writer
                    .remove(field, { resourceId, display })
                    .then(refetch)
                    .catch((error) => {
                      console.error('[easy-chart] remove failed', error);
                      enqueueSnackbar(
                        `Could not remove "${display}": ${error instanceof Error ? error.message : 'unknown error'}`,
                        { variant: 'error' }
                      );
                    });
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
