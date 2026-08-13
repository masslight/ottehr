// Guards the Easy Chart promise that "nothing a reviewer needs at sign-off is missing from the Easy
// Chart view". Review & Sign and Easy Chart are two independent renderers of one note with no shared
// code, so this is the only thing standing between "someone added a section" and "half the product
// silently lost it".
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  EASY_CHART_SECTION_EXCLUSIONS,
  EASY_CHART_SECTION_IDS,
  NOTE_SECTIONS,
  PROGRESS_NOTE_SECTION_COMPONENTS,
  PROGRESS_NOTE_SECTION_IDS,
} from '../../src/features/visits/shared/components/review-tab/note-sections';

const PROGRESS_NOTE_DETAILS = join(
  __dirname,
  '../../src/features/visits/in-person/components/progress-note/ProgressNoteDetails.tsx'
);

describe('visit-note section parity', () => {
  it('Easy Chart renders every section Review & Sign renders', () => {
    const missing = PROGRESS_NOTE_SECTION_IDS.filter(
      (id) => !EASY_CHART_SECTION_IDS.includes(id) && !(id in EASY_CHART_SECTION_EXCLUSIONS)
    );
    expect(
      missing,
      `Easy Chart is missing note section(s) that Review & Sign shows: ${missing.join(', ')}. ` +
        'Render them in NoteSections.tsx / EasyChartPage.tsx and add the id to EASY_CHART_SECTION_IDS, ' +
        'or record a deliberate gap in EASY_CHART_SECTION_EXCLUSIONS with a reason.'
    ).toEqual([]);
  });

  it('every declared id exists in the canonical manifest', () => {
    const canonical = new Set<string>(NOTE_SECTIONS.map((s) => s.id));
    for (const id of [...PROGRESS_NOTE_SECTION_IDS, ...EASY_CHART_SECTION_IDS]) {
      expect(canonical.has(id), `"${id}" is not in NOTE_SECTIONS`).toBe(true);
    }
    // Exclusions must name real sections too, or a typo silently waives nothing.
    for (const id of Object.keys(EASY_CHART_SECTION_EXCLUSIONS)) {
      expect(canonical.has(id), `excluded id "${id}" is not in NOTE_SECTIONS`).toBe(true);
    }
  });

  // The load-bearing half: the manifest above is hand-written, so on its own it could drift from what
  // ProgressNoteDetails actually renders. Read that file and require every section-bearing component
  // it mounts to be registered — that is what makes adding a section to Review & Sign fail here.
  it('every section component rendered by ProgressNoteDetails is registered', () => {
    const source = readFileSync(PROGRESS_NOTE_DETAILS, 'utf8');
    // Section-bearing components are named by convention: *Container, *Warning, *Acknowledgement.
    const rendered = new Set(
      Array.from(source.matchAll(/<([A-Z][A-Za-z0-9]*(?:Container|Warning|Acknowledgement))\b/g)).map((m) => m[1])
    );
    const unregistered = [...rendered].filter((name) => !(name in PROGRESS_NOTE_SECTION_COMPONENTS));
    expect(
      unregistered,
      `ProgressNoteDetails renders unregistered section component(s): ${unregistered.join(', ')}. ` +
        'Add each to PROGRESS_NOTE_SECTION_COMPONENTS (and give it an Easy Chart counterpart) in note-sections.ts.'
    ).toEqual([]);
  });

  it('the component map only points at real sections', () => {
    const canonical = new Set<string>(NOTE_SECTIONS.map((s) => s.id));
    for (const [component, id] of Object.entries(PROGRESS_NOTE_SECTION_COMPONENTS)) {
      expect(canonical.has(id), `${component} maps to unknown section "${id}"`).toBe(true);
    }
  });
});
