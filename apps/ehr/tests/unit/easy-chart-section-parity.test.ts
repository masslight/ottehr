// Section parity, enforced by reading the progress note's own source.
//
// The requirement is that nothing a reviewer needs at sign-off is missing from the Easy Chart view. A
// manifest alone cannot enforce that: someone adds a section component to ProgressNoteDetails, never
// touches the manifest, and the Easy Chart note is quietly short one section. So this test reads that
// component and fails when it renders a section the manifest does not know about.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NOTE_SECTIONS } from '../../src/features/easy-chart/components/note-section-manifest';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROGRESS_NOTE_DETAILS = join(
  HERE,
  '../../src/features/visits/in-person/components/progress-note/ProgressNoteDetails.tsx'
);

/**
 * Component names ProgressNoteDetails renders inside its two section arrays. Read from the source
 * rather than imported, because importing it would pull in the whole appointment store.
 */
function sectionComponentsRenderedByProgressNote(): string[] {
  const source = readFileSync(PROGRESS_NOTE_DETAILS, 'utf8');
  // The section arrays are the only place a `<Container />`-style section is constructed; everything
  // else in the file is layout (Box/Stack/Typography) or a button.
  const LAYOUT = new Set([
    'Box',
    'Stack',
    'Typography',
    'Divider',
    'AccordionCard',
    'RoundedButton',
    'ErrorOutlineIcon',
    'SectionList',
    'Fragment',
  ]);
  const rendered = new Set<string>();
  for (const match of source.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)) {
    const name = match[1];
    if (!LAYOUT.has(name)) rendered.add(name);
  }
  return [...rendered];
}

describe('the note section manifest', () => {
  it('registers every section component the progress note renders', () => {
    const registered = new Set(NOTE_SECTIONS.map((section) => section.progressNoteComponent).filter(Boolean));
    const unregistered = sectionComponentsRenderedByProgressNote().filter((name) => !registered.has(name));
    expect(
      unregistered,
      `ProgressNoteDetails renders ${unregistered.join(', ')}, which the Easy Chart section manifest does not know ` +
        `about. Add each to NOTE_SECTIONS — with easyChart:true, or false and a reason — so the two surfaces cannot drift.`
    ).toEqual([]);
  });

  it('covers every registered section on the Easy Chart surface, or explains why not', () => {
    for (const section of NOTE_SECTIONS) {
      if (section.easyChart) continue;
      expect(
        section.easyChartOmissionReason?.trim(),
        `"${section.label}" is missing from Easy Chart with no reason given. An unexplained gap is ` +
          `indistinguishable from an oversight.`
      ).toBeTruthy();
    }
  });

  it('has unique ids and non-empty labels', () => {
    const ids = NOTE_SECTIONS.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const section of NOTE_SECTIONS) {
      expect(section.label.trim().length, `section "${section.id}" has no label`).toBeGreaterThan(0);
    }
  });

  // The deliberate gaps, listed here so shrinking the list is a visible diff rather than a quiet win.
  it('has exactly the gaps we know about', () => {
    expect(NOTE_SECTIONS.filter((section) => !section.easyChart).map((section) => section.id)).toEqual([
      'exam-migration-warning',
    ]);
  });
});
