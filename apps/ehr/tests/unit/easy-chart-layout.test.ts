// Is the chat still pinned, and does each column still own its scroll?
//
// This layout is a product requirement, not a preference: the chat sits in a viewport-height grid cell
// with its composer at the bottom, and the note scrolls beside it. The ways it breaks are all quiet —
// nothing throws, the page just starts scrolling as one document and the composer drifts off screen:
//
//   - the grid loses its viewport-bound height, so both cells grow to their content
//   - the note column loses `overflowY`, so its overflow pushes the page instead
//   - the chat cell gains one, so the composer scrolls away with the thread
//   - fixed chrome moves back ABOVE the grid, so it eats rows from both columns
//
// So the contract is asserted against the source. A structural test rather than a rendered one because
// jsdom has no layout: `getBoundingClientRect` is all zeros there, so a render test could not tell a
// pinned column from a scrolling one.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '../../src/features/easy-chart/pages/EasyChartPage.tsx');
const ASSISTANT_COLUMN = join(HERE, '../../src/features/easy-chart/components/AssistantColumn.tsx');

const page = readFileSync(PAGE, 'utf8');
const assistantColumn = readFileSync(ASSISTANT_COLUMN, 'utf8');

describe('the grid that pins the chat', () => {
  it('binds its height to the measured viewport fill, not a guessed constant', () => {
    expect(page).toMatch(/height:\s*\{\s*md:\s*viewport\.height\s*\}/);
    // Measured, so the environment banner, the navbar and a wrapped allergy line cannot put the offset
    // out by a few pixels and give the PAGE a scrollbar.
    expect(page).toContain('useFillViewportHeight()');
    expect(page).toMatch(/getBoundingClientRect\(\)\.top/);
  });

  it('leaves the single-column breakpoint scrolling as a normal page', () => {
    // `{ md: ... }` and not a bare value: a half-height pinned chat on a phone would leave no room for
    // the note.
    expect(page).not.toMatch(/height:\s*`calc\(100vh/);
  });

  it('gives the note column the only scroll on the page', () => {
    const scrollers = page.match(/overflowY:/g) ?? [];
    expect(scrollers, 'exactly one scroll container in the page: the note column').toHaveLength(1);
    expect(page).toMatch(/overflowY:\s*\{\s*md:\s*'auto'\s*\}/);
  });

  it('does not let the chat cell scroll — its thread scrolls inside AssistantColumn', () => {
    const chatCell = page.slice(page.indexOf('{/* The chat, pinned.'));
    expect(chatCell).not.toContain('overflowY');
    // The cell hands its full height down, so the composer can sit at the bottom of it.
    expect(chatCell).toMatch(/minHeight:\s*0/);
    expect(assistantColumn).toMatch(/flex:\s*1,[^}]*overflowY/);
  });
});

describe('what scrolls with the note', () => {
  const noteColumn = page.indexOf("overflowY: { md: 'auto' }");
  const notePane = page.indexOf('<NotePane');

  it('keeps the fixed chrome above the grid to the patient line only', () => {
    const chrome = page.slice(page.indexOf('{/* Fixed chrome.'), page.indexOf('ref={viewport.ref}'));
    // The attestation and the readiness banner are the two things that used to live up here, costing
    // both columns ~120px of height for content that is fine to scroll.
    expect(chrome).not.toContain('<Alert');
    expect(chrome).not.toContain('easy-chart-verify-patient');
    expect(chrome).toContain('easy-chart-patient');
  });

  it('puts both attestations inside the note scroll, above the sections', () => {
    const verify = page.indexOf('easy-chart-verify-patient');
    const readiness = page.indexOf('severity={bannerSeverity}');
    for (const [name, at] of [
      ['the name/DOB attestation', verify],
      ['the readiness banner', readiness],
    ] as const) {
      expect(at, `${name} is missing`).toBeGreaterThan(-1);
      expect(at, `${name} must be inside the note's scroll container`).toBeGreaterThan(noteColumn);
      expect(at, `${name} must come before the sections`).toBeLessThan(notePane);
    }
  });
});
