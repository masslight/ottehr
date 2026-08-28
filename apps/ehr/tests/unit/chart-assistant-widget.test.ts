// The docked assistant's shell, checked structurally.
//
// Two of these invariants are the kind that break silently and cost a provider real work, so they are
// asserted against the sources rather than trusted to review:
//
//   - the session must NOT unmount when the panel is collapsed. A turn in flight is writing to the chart
//     from state held in that subtree; unmounting it mid-plan abandons the write halfway and loses the
//     thread that would have said so.
//   - the launcher must not sit on top of the Ambient Scribe launcher, which is fixed in the same corner
//     of the same layout. Two Fabs at the same offset means one control is simply unreachable.

import { readFileSync } from 'fs';
import { join } from 'path';
import { DOCK_BOTTOM_PX } from 'src/features/easy-chart/components/ChartAssistantWidget';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string): string => readFileSync(join(__dirname, '../..', relativePath), 'utf8');

const WIDGET = read('src/features/easy-chart/components/ChartAssistantWidget.tsx');
const PROGRESS_NOTE = read('src/features/visits/in-person/pages/ProgressNote.tsx');
const LAYOUT = read('src/features/visits/in-person/layout/InPersonLayout.tsx');
const HEADER = read('src/features/visits/in-person/components/Header.tsx');

/**
 * Every `bottom:` offset the layout's fixed launcher Fab can take, including both arms of the ternary it
 * is written as today.
 *
 * Scoped to that ONE element rather than to the whole file on purpose: the file also positions the
 * recorder's panel, and comparing against whichever offset happens to be smallest anywhere in it would
 * make this assert something nobody intended.
 */
const recorderLauncherBottomOffsets = (source: string): number[] => {
  const fabStart = source.indexOf('<Fab');
  if (fabStart === -1) return [];
  const fab = source.slice(fabStart, source.indexOf('</Fab>', fabStart));
  const bottom = fab.slice(fab.indexOf('bottom:'));
  return [...bottom.slice(0, bottom.indexOf('}')).matchAll(/(\d+)/g)].map((match) => Number(match[1]));
};

describe('the assistant is reachable from Review & Sign', () => {
  it('is mounted on the Review & Sign page', () => {
    expect(PROGRESS_NOTE).toContain('<ChartAssistantWidget />');
    expect(PROGRESS_NOTE).toContain("from 'src/features/easy-chart/components/ChartAssistantWidget'");
  });

  it('is the only place it is mounted — there is no second, ungated entry point', () => {
    // A second mount would run a second assistant against the same encounter, with its own thread.
    expect(WIDGET.match(/<ChartAssistantSession \/>/g)).toHaveLength(1);
  });
});

describe('both gates are applied, and they are the shared ones', () => {
  it('gates on the feature flag', () => {
    expect(WIDGET).toContain('FEATURE_FLAGS.EASY_CHART_ENABLED');
  });

  it('gates on the same role set the endpoints check, not a local copy', () => {
    expect(WIDGET).toContain("from 'utils/lib/easy-chart/access'");
    expect(WIDGET).toContain('EASY_CHART_ROLES');
    // A role list spelled out here would drift from the endpoints' list.
    expect(WIDGET).not.toMatch(/RoleType\.\w+/);
  });

  it('refuses rather than waves through a user that has not loaded', () => {
    expect(WIDGET).toContain('!user?.hasRole');
  });
});

describe('collapsing the panel does not abandon a running turn', () => {
  it('hides the panel with display: none instead of unmounting it', () => {
    expect(WIDGET).toContain("...(!open && { display: 'none' })");
  });

  it('does not gate the panel on `open`, which would unmount the session on every close', () => {
    // `everOpened` latches; `open` toggles. Rendering the panel under `open` is the mistake this guards.
    expect(WIDGET).toContain('{everOpened && (');
    expect(WIDGET).not.toContain('{open && (');
  });

  it('never clears the latch', () => {
    expect(WIDGET).toContain('setEverOpened(true)');
    expect(WIDGET).not.toContain('setEverOpened(false)');
  });

  it('does not mount the session before the first open, so the page pays nothing for it', () => {
    // The session pulls the chart, the quick-picks and the whole match catalogue.
    const beforePanel = WIDGET.slice(0, WIDGET.indexOf('{everOpened && ('));
    expect(beforePanel).not.toContain('<ChartAssistantSession');
  });
});

/** Every explicit z-index the widget sets. */
const widgetZIndexes = (): number[] => {
  const found = [...WIDGET.replace(/\/\/.*$/gm, '').matchAll(/zIndex:\s*(\d+)/g)].map((m) => Number(m[1]));
  expect(found.length).toBeGreaterThan(0);
  return found;
};

describe('the dock sits clear of the controls already in that corner', () => {
  it('clears the Ambient Scribe launcher fixed in the same corner of the same layout', () => {
    const recorderOffsets = recorderLauncherBottomOffsets(LAYOUT);
    // If the recorder ever stops being fixed in this corner, this stops being the right thing to measure
    // against — so an empty list is a failure, not a pass.
    expect(recorderOffsets.length).toBeGreaterThan(0);
    // A Fab is 56px tall (MUI `medium`), so anything lower than that overlaps it.
    expect(DOCK_BOTTOM_PX).toBeGreaterThanOrEqual(Math.min(...recorderOffsets) + 56);
  });

  it('stays below the modal layer, so the disambiguation dialog opens over it and not under', () => {
    // MUI's modal layer is 1300; a Dialog rendered from inside the panel must win.
    expect(Math.max(...widgetZIndexes())).toBeLessThan(1300);
  });
});

describe('the panel stops below the visit header instead of vanishing behind it', () => {
  it('cannot win a stacking contest with the header, and does not try to', () => {
    // If this ever inverts, the panel would cover the patient's name and allergies — which is why the
    // fix is to bound the height, not to raise the panel.
    const headerZIndex = Number(/zIndex:\s*(\d+)/.exec(HEADER)?.[1]);
    expect(headerZIndex).toBeGreaterThan(0);
    expect(Math.max(...widgetZIndexes())).toBeLessThan(headerZIndex);
  });

  it('derives its height from a measured inset rather than a guessed constant', () => {
    // A hard-coded number is wrong the moment the header wraps to a second row, and wrong differently
    // in every theme.
    expect(WIDGET).toContain('findScrollParent');
    expect(WIDGET).toContain('getBoundingClientRect().top');
    expect(WIDGET).toMatch(/height: `min\([^`]*topInset/);
  });

  it('re-measures when the header changes height without the window resizing', () => {
    // The patient line wraps to a second row when the allergy list is long. Nothing resizes the window.
    expect(WIDGET).toContain('ResizeObserver');
    expect(WIDGET).toContain("addEventListener('resize'");
  });

  it('assumes a header at least as tall as a real one until the first measurement lands', () => {
    // Guessing too SMALL puts the panel under the header for a frame, which is the bug itself.
    const fallback = Number(/FALLBACK_TOP_INSET_PX = (\d+)/.exec(WIDGET)?.[1]);
    const headerHeights = [...HEADER.matchAll(/(?:height|minHeight):\s*'?(\d+)/g)].map((m) => Number(m[1]));
    expect(fallback).toBeGreaterThanOrEqual(headerHeights.length ? Math.max(...headerHeights) : 100);
  });
});
