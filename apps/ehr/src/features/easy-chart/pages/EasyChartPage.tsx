// Easy Chart: the visit note on the left, the AI charting assistant on the right.
//
// LAYOUT SPECIFICS THAT MATTER, not cosmetics:
//   - `Container maxWidth={false} disableGutters` and no padding of its own — the note needs the width,
//     and the chart layout's content pane already pads every tab. Doubling that costs ~44px a side.
//   - CSS grid `3fr minmax(320px, 2fr)` on md+, single column below. The minmax floor stops the
//     assistant collapsing to unusable width on a laptop.
//   - The grid is constrained to the available height on md+, so the page itself does not scroll: the
//     wheel over the left column scrolls the NOTE, the wheel over the chat scrolls the CHAT, and the chat
//     stays pinned in view with its composer at the bottom. Providers read the note while the
//     assistant works, and a single page scroll would drag the composer off screen.
//   - NOTHING sits above the grid. Every pixel spent there is taken from both scrolling columns, and the
//     patient identity that used to live there — name, DOB, allergies — is in the visit header directly
//     above this page, which is where the rest of the chart reads it from too. So both attestations, the
//     name/DOB verification and the readiness banner, scroll WITH the note instead.

import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { LoadingScreen } from 'src/components/LoadingScreen';
import { useGetImmunizationOrders } from 'src/features/visits/in-person/hooks/useImmunization';
import { ExamTab } from 'src/features/visits/shared/components/exam-tab/ExamTab';
import { RosTab } from 'src/features/visits/shared/components/ros-tab/RosTab';
import { useGetMedicationOrders } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import { chartKeyForNoteField } from 'utils/lib/easy-chart/note-fields';
import { computeSignBlockers } from 'utils/lib/easy-chart/sign-blockers';
import { AssistantColumn } from '../components/AssistantColumn';
import { ChartEditorDialog, ChartEditorSection } from '../components/ChartEditorDialog';
import { NotePane } from '../components/NotePane';
import { buildChartSnapshot } from '../executor/chartSnapshot';
import { PlanStep } from '../executor/types';
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

/**
 * The nearest SCROLLING ancestor, or undefined when the page itself is what scrolls.
 *
 * This is what makes the fill correct as a chart TAB. InPersonLayout puts every tab inside a
 * `flex: 1; overflow-y: auto` pane, with a header above it and the bottom navigation bar BELOW it — so
 * the bottom of the viewport is not the bottom of the space this page may use. Filling to `100vh` there
 * pushes the grid under the navigation bar, that pane starts scrolling, and the composer drifts out of
 * view: exactly the failure the pinned layout exists to prevent, just moved one container inwards.
 */
function findScrollParent(node: HTMLElement): HTMLElement | undefined {
  for (let element = node.parentElement; element; element = element.parentElement) {
    const overflowY = getComputedStyle(element).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return element;
  }
  return undefined;
}

/**
 * A height that makes the element fill the rest of the available space, MEASURED rather than hard-coded.
 *
 * Neither edge is a constant. Above: the environment banner is present outside production, the visit
 * header's height is a theme detail, and the patient line wraps to a second row when the allergy list is
 * long. Below: the bottom navigation bar is present on some tabs and not others, and the layout pane's
 * padding is a style. An offset guessed too small gives an ANCESTOR a scrollbar, which unpins the
 * composer, and one guessed too large wastes rows of the note. Measured rects cannot be wrong about
 * either.
 */
function useFillViewportHeight(): { ref: (node: HTMLElement | null) => void; height: string } {
  // The node is STATE, not a ref: the grid mounts only after the loading screen goes away, and an
  // effect keyed on a ref would have already run against `null` and never attached its observer.
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [inset, setInset] = useState<number | null>(null);

  // Layout effect, so the measured height is in place before the first paint — a frame at the
  // unmeasured fallback flashes a page scrollbar.
  useLayoutEffect(() => {
    if (!node) return;
    const scrollParent = findScrollParent(node);
    const measure = (): void => {
      const top = node.getBoundingClientRect().top;
      // How much of the viewport is spoken for BELOW us. Zero when the page itself scrolls; the
      // navigation bar plus the pane's own bottom padding when we are a chart tab. The padding is
      // inside the rect, so it has to come off separately.
      let bottomInset = 0;
      if (scrollParent) {
        const style = getComputedStyle(scrollParent);
        const usableBottom =
          scrollParent.getBoundingClientRect().bottom -
          (parseFloat(style.paddingBottom) || 0) -
          (parseFloat(style.borderBottomWidth) || 0);
        bottomInset = Math.max(0, window.innerHeight - usableBottom);
      }
      setInset(Math.round(top + bottomInset));
    };
    measure();
    window.addEventListener('resize', measure);
    // Either edge can also move without the window resizing — allergies arrive and the detail line
    // wraps, or the navigation bar appears. Watching the PARENT catches the first: setting our own
    // height changes the parent's, which re-fires this, but the re-measured inset is identical so the
    // state settles immediately. Watching the scrolling pane catches the second.
    const parent = node.parentElement;
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    if (parent) observer?.observe(parent);
    if (scrollParent && scrollParent !== parent) observer?.observe(scrollParent);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [node]);

  return { ref: setNode, height: inset == null ? '100vh' : `calc(100vh - ${inset}px)` };
}

export const EasyChartPage: FC = () => {
  // The ENCOUNTER id comes from the appointment store, not from the URL: this is a tab of the in-person
  // chart, so the route is keyed by APPOINTMENT id (`/in-person/:id/easy-charting`) and the encounter is
  // whichever one InPersonLayout resolved for it. Reading it the same way `useChartData` does also means
  // this page's chart query shares the layout's cache entry rather than opening a second one.
  const visit = useEasyChartVisit();
  const encounterId = visit.encounter?.id;
  const { chartData, vitals, isLoading, refetch } = useEasyChartData(encounterId);
  const { data: progressNoteConfig } = useProgressNoteConfig();
  const isAppointmentReadOnly = visit.isReadOnly;

  const [provenance, setProvenance] = useState(emptyProvenance);
  const [verified, setVerified] = useState(false);
  // Which section editor is open, if any. The dialog owns no data — whatever changes inside is written by
  // the tab's own save path, so closing it has to refetch or the note keeps showing the pre-edit state.
  const [editorSection, setEditorSection] = useState<ChartEditorSection | undefined>(undefined);
  // The row that was clicked, so the dialog can scroll to it. Cleared with the section.
  const [editorTarget, setEditorTarget] = useState<string | undefined>(undefined);

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
   * Swap one charted row for the code the provider picked: remove, write, refetch.
   *
   * SHARED by the diagnosis and CPT rows because the failure handling is the point. NotePane calls these
   * as `void onEdit…(…)`, so a throw anywhere in here becomes an unhandled rejection: the row stays as it
   * was, nothing is said, and the provider cannot tell whether the pick landed. Removing first is
   * deliberate — leaving both versions on the note is worse than a brief gap.
   */
  const replaceRow = useCallback(
    async (
      field: string,
      item: { resourceId: string; display: string },
      write: Parameters<typeof writer.save>[0],
      picked: string
    ): Promise<void> => {
      try {
        await writer.remove(field, item);
        await writer.save(write);
        await refetch();
      } catch (error) {
        console.error('[easy-chart] replace failed', error);
        enqueueSnackbar(
          `Could not change "${item.display}" to "${picked}": ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
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
    <Container maxWidth={false} disableGutters sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* NO chrome above the grid. The patient line that used to be here — name, DOB, allergies — and the
          "open in the regular chart" button are both redundant now that this page renders under the visit
          header: the header states the same identity for every tab, and the rest of the chart is a click
          away in the header's Chart / Easy Chart switch. What that buys is height, for both columns. */}
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
                onEditDiagnosis={async (item, code) => {
                  // Replace, not add: delete the old row and write the picked one in its place, so a
                  // correction never leaves both versions on the note. The PRIMARY flag is carried over —
                  // correcting the primary diagnosis must not quietly leave the note without one.
                  const replaced = chartData?.diagnosis?.find((dx) => dx.resourceId === item.resourceId);
                  await replaceRow(
                    'diagnosis',
                    item,
                    {
                      diagnosis: [{ code: code.code, display: code.display, isPrimary: replaced?.isPrimary ?? false }],
                    },
                    code.display
                  );
                }}
                onEditCptCode={async (item, code) => {
                  // Same replace-then-write as the diagnosis row. Everything else on the line is carried
                  // over — an NDC, a dose, billable units — because this is one billing line whose CODE is
                  // being corrected, not a new line; dropping them would silently lose what a provider
                  // entered on the in-house medication path.
                  const replaced = chartData?.cptCodes?.find((cpt) => cpt.resourceId === item.resourceId);
                  const { resourceId: _resourceId, ...carried } = replaced ?? {};
                  await replaceRow(
                    'cptCodes',
                    item,
                    { cptCodes: [{ ...carried, code: code.code, display: code.display }] },
                    code.display
                  );
                }}
                onReplaceItem={replaceRow}
                onEditSection={(section, field) => {
                  setEditorSection(section);
                  setEditorTarget(field);
                }}
                chartData={chartData}
                provenance={provenance}
                readOnly={isAppointmentReadOnly}
                onConfirmItem={(resourceId) => setProvenance((state) => markReviewed(state, [resourceId]))}
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
                vitals={vitals}
                labOrders={labOrders.orders}
                appointmentStart={visit.appointment?.start}
                encounterId={encounterId}
                // The disposition card writes through its own mutation, so this page's chart query has
                // to be refetched or the sign-blockers and the assistant's snapshot stay a step behind.
                onDispositionSaved={() => void refetch()}
                // A field the provider rewrote by hand is no longer AI-written, so the mark on the row it
                // owns is dropped as well as the chart being refetched.
                onNoteFieldSaved={() => {
                  // Every row a reused field can rewrite. BOTH swapped keys are here: `chiefComplaint`
                  // stores the HPI and `historyOfPresentIllness` stores the chief complaint, so naming
                  // only one would leave the other still credited to the assistant.
                  const ids = [
                    chartData?.chiefComplaint?.resourceId,
                    chartData?.historyOfPresentIllness?.resourceId,
                    chartData?.mechanismOfInjury?.resourceId,
                    chartData?.medicalDecision?.resourceId,
                  ].filter((id): id is string => Boolean(id));
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

      {/* The real Examination / Review of Systems editors, hosted rather than reimplemented. They take no
          props and read their own stores and their own save paths — both of which work here because this
          page renders INSIDE InPersonLayout, which populates the appointment store and initialises the
          exam/ROS observation stores for every tab. */}
      <ChartEditorDialog
        section={editorSection}
        target={editorTarget}
        onClose={() => {
          setEditorSection(undefined);
          setEditorTarget(undefined);
          // Whatever was ticked inside was saved by the tab; this page renders from its own chart-data
          // query and would otherwise keep showing the note as it was before the edit.
          void refetch();
        }}
      >
        {editorSection === 'exam' && <ExamTab />}
        {editorSection === 'ros' && <RosTab />}
      </ChartEditorDialog>
    </Container>
  );
};

export default EasyChartPage;
