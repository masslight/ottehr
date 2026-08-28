// The charting assistant, docked to the Review & Sign page.
//
// This is the thread and the composer only — what used to be the RIGHT-HAND COLUMN of the Easy Chart
// page, kept whole while the page's left column (its own reimplementation of the note) is gone. The
// note is Review & Sign itself now, and it edits in place, so the assistant no longer needs a note of
// its own beside it.
//
// THREE THINGS ABOUT THE SHELL THAT ARE NOT COSMETIC:
//
//   - The session MOUNTS ON FIRST OPEN AND NEVER UNMOUNTS. Not mounting it up-front matters because the
//     session pulls the chart, the procedure quick-picks and the whole match catalogue — cost that no
//     provider who never opens the widget should pay on a page they open for every visit. Not
//     unmounting it matters more: the thread, the queued messages and any turn still in flight all live
//     in that subtree, so collapsing the panel mid-dictation would abandon a running plan halfway
//     through writing to the chart. So it is hidden with `display: none`, which is also how the Ambient
//     Scribe recorder two levels up this same layout does it.
//
//   - FIXED, not part of the page flow. Review & Sign is a full-width column of section cards, and
//     giving up 400px of it to a chat the provider is not currently using would narrow every section
//     for everyone. A fixed panel is also what makes the pinning work: the thread scrolls inside the
//     panel with the composer stapled to its bottom edge, while the note scrolls behind it.
//
//   - Its height is MEASURED against the visit header rather than guessed. The header is `position:
//     sticky` at `zIndex: 100`, so it wins every stacking contest a page-level panel could enter: a
//     panel tall enough to reach it does not overlap it, it vanishes behind it, taking the top of the
//     thread with it. Raising the panel over the header instead would be worse — it would bury the
//     patient's name and allergies under a chat window. So the panel stops below it, and the stop is
//     measured, because the header's height is a theme detail that also grows a row when the allergy
//     list wraps.
//
//   - It clears the recorder's launcher rather than stacking on it. That Fab is fixed in this same corner
//     and is 56px tall, so anything anchored lower covers a control that is present on this page too. The
//     test reads both offsets rather than trusting the number here to stay true.
//
// GATED TWICE, and both gates are the shared ones: the feature flag, and the SAME role set the plan and
// review endpoints check. A role that can open this can always use its API and vice versa.

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Fab, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { FC, useLayoutEffect, useState } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { EASY_CHART_ROLES } from 'utils/lib/easy-chart/access';
import { FEATURE_FLAGS } from '../../../constants/feature-flags';
import { useCatalogue } from '../hooks/useCatalogue';
import { useChartAssistant } from '../hooks/useChartAssistant';
import { useChartWriter } from '../hooks/useChartWriter';
import { useEasyChartData } from '../hooks/useEasyChartData';
import { useEasyChartVisit } from '../hooks/useEasyChartVisit';
import { AssistantColumn } from './AssistantColumn';

/**
 * How far off the bottom the launcher sits. Exported so the test can compare it against the Ambient
 * Scribe launcher's own offset, read out of InPersonLayout — the two are fixed in the same corner of the
 * same layout, and a Fab is 56px tall, so anything lower simply covers that control.
 */
export const DOCK_BOTTOM_PX = 80;
const DOCK_WIDTH_PX = 420;
/** The panel clears the launcher below it. */
const PANEL_BOTTOM_PX = DOCK_BOTTOM_PX + 64;
/** Tall enough to read a plan in; past this the thread is just wide whitespace. */
const PANEL_MAX_HEIGHT_PX = 640;
/** Breathing room between the top of the panel and the header it must not touch. */
const PANEL_TOP_GAP_PX = 8;
/**
 * Assumed header height until the first measurement lands — deliberately GENEROUS. Guessing too big
 * costs a few rows of thread for one frame; guessing too small puts the panel under the header, which
 * is the bug this exists to prevent.
 */
const FALLBACK_TOP_INSET_PX = 160;

/**
 * The nearest SCROLLING ancestor: the chart layout's content pane.
 *
 * Its top edge IS the header's bottom edge, which is the number wanted here — and reading it this way
 * needs no knowledge of what the header contains or which layout is hosting the page.
 */
function findScrollParent(node: HTMLElement): HTMLElement | undefined {
  for (let element = node.parentElement; element; element = element.parentElement) {
    const overflowY = getComputedStyle(element).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return element;
  }
  return undefined;
}

/** How much of the viewport is spoken for above the panel, measured off the layout rather than assumed. */
function useTopInset(): { anchorRef: (node: HTMLElement | null) => void; topInset: number } {
  // The anchor is STATE, not a ref: an effect keyed on a ref would have run against `null` on the
  // render that mounted it and never attached its observer.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [topInset, setTopInset] = useState(FALLBACK_TOP_INSET_PX);

  // Layout effect, so the measured height is in place before the first paint — one frame at the
  // fallback is a visible jump in panel height.
  useLayoutEffect(() => {
    if (!anchor) return;
    const pane = findScrollParent(anchor);
    if (!pane) return;
    const measure = (): void => setTopInset(Math.max(0, Math.round(pane.getBoundingClientRect().top)));
    measure();
    window.addEventListener('resize', measure);
    // The header also changes height without the window resizing — the patient line wraps to a second
    // row when the allergy list is long — and that shrinks this pane, which is what fires this.
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(pane);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [anchor]);

  return { anchorRef: setAnchor, topInset };
}

/**
 * The live assistant: every data hook, and the column itself.
 *
 * Split out from the shell so that mounting it is a decision the shell makes once — see the header. It
 * renders whether or not the panel is currently visible, and must, or a turn in flight would be lost.
 */
const ChartAssistantSession: FC = () => {
  const visit = useEasyChartVisit();
  const encounterId = visit.encounter?.id;
  const { chartData, refetch } = useEasyChartData(encounterId);

  const catalogue = useCatalogue({ encounterId });
  const writer = useChartWriter({
    encounterId: encounterId ?? '',
    // All three are for the procedure write: a quick-pick carries its own CPT codes and supporting
    // diagnoses, and re-saving one the plan already charted duplicates it on the note. `procedures` is
    // how the write tells which row in its response is the one it just created.
    diagnoses: chartData?.diagnosis,
    cptCodes: chartData?.cptCodes,
    procedures: chartData?.procedures,
    // A placed order is not chart data, so the sections that render it read their own queries. Refetching
    // the chart is what this surface can do from here; the note's own order lists refresh on their own
    // invalidation, which is why nothing else is wired to it.
    onOrdersChanged: () => void refetch(),
  });

  const assistant = useChartAssistant({
    encounterId: encounterId ?? '',
    chartData,
    catalogue,
    writer,
    refetchChart: refetch,
    // No `onStepsSettled`: nothing here tints the rows the assistant wrote. The settled plan card in the
    // thread is what says what landed, until the note itself marks its own rows.
    readOnly: visit.isReadOnly,
  });

  return (
    <AssistantColumn
      assistant={assistant}
      readOnly={visit.isReadOnly}
      readOnlyReason={
        visit.isReadOnly
          ? 'This visit is signed. The assistant cannot write to it — append an addendum below instead.'
          : undefined
      }
    />
  );
};

export const ChartAssistantWidget: FC = () => {
  const user = useEvolveUser();
  const [open, setOpen] = useState(false);
  // Latches on the first open and never clears — see the header on why the session must not unmount.
  const [everOpened, setEverOpened] = useState(false);
  // Measured off the launcher, which is mounted whenever the widget renders at all. A fixed element is
  // still a child of the tree it was rendered into, so walking up from it reaches the layout's pane.
  const { anchorRef, topInset } = useTopInset();

  if (!FEATURE_FLAGS.EASY_CHART_ENABLED) return null;
  if (!user?.hasRole([...EASY_CHART_ROLES])) return null;

  return (
    <>
      <Tooltip title="Charting assistant">
        <Fab
          ref={anchorRef}
          color="primary"
          size="medium"
          aria-label="Charting assistant"
          data-testid="chart-assistant-launcher"
          sx={{ position: 'fixed', right: 8, bottom: DOCK_BOTTOM_PX, zIndex: 11 }}
          onClick={() => {
            setEverOpened(true);
            setOpen((current) => !current);
          }}
        >
          <AutoAwesomeIcon />
        </Fab>
      </Tooltip>

      {everOpened && (
        <Paper
          elevation={8}
          data-testid="chart-assistant-panel"
          sx={{
            position: 'fixed',
            right: 8,
            bottom: PANEL_BOTTOM_PX,
            // Anchored at the BOTTOM only. A panel that also pinned its top would have to know the height
            // of the visit header, which is a theme detail and grows a row when the allergy list wraps.
            width: { xs: 'calc(100vw - 16px)', sm: DOCK_WIDTH_PX },
            // Capped against what is actually free: the viewport, less the space below the panel and the
            // measured header above it. A flat percentage runs into the header on a short window.
            height: `min(${PANEL_MAX_HEIGHT_PX}px, calc(100vh - ${PANEL_BOTTOM_PX + topInset + PANEL_TOP_GAP_PX}px))`,
            display: 'flex',
            flexDirection: 'column',
            p: 1.5,
            // Above the recorder's panel (10) and below MUI's modal layer (1300), because the composer's
            // disambiguation dialog has to open over this rather than under it. Deliberately NOT above the
            // header either — see the note on measuring, this stays out of the header's way instead of
            // covering the patient's name and allergies with a chat window.
            zIndex: 11,
            ...(!open && { display: 'none' }),
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Charting assistant</Typography>
            <IconButton size="small" aria-label="Close charting assistant" onClick={() => setOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
            <ChartAssistantSession />
          </Box>
        </Paper>
      )}
    </>
  );
};
