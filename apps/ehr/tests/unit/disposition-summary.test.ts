// The disposition's stored values are CODES, and both surfaces that display it must show the provider's
// words instead.
//
// `type` is stored as "pcp-no-type" and `followUpIn` as a number whose `0` means "as needed", not zero
// days. Rendering either raw is not a crash — it is a discharge plan that reads as database output, and
// the Easy Chart note did exactly that ("Disposition — pcp-no-type", "Follow up in 0 day(s)").
//
// The other half of this is drift: a disposition carries eight fields beyond its type, and two surfaces
// rendering them by hand agree only until one gains a ninth. So the last test reads both call sites and
// fails if either stops using the shared component.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  dispositionTypeLabel,
  followUpInLabel,
} from '../../src/features/visits/shared/components/DispositionSummary';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOTE_PANE = join(HERE, '../../src/features/easy-chart/components/NotePane.tsx');
const PROGRESS_NOTE_PLAN = join(
  HERE,
  '../../src/features/visits/shared/components/review-tab/components/PatientInstructionsContainer.tsx'
);

describe('the disposition type', () => {
  it('renders the label a provider chose, not the stored code', () => {
    expect(dispositionTypeLabel('pcp-no-type')).not.toBe('pcp-no-type');
    expect(dispositionTypeLabel('ed')).toBe('ED Transfer');
    expect(dispositionTypeLabel('specialty')).toBe('Specialty Transfer');
  });

  it('has no label for an unset type, so the heading can omit it', () => {
    expect(dispositionTypeLabel(undefined)).toBeUndefined();
  });

  // Bad or legacy data. Blanking it would hide that the field was set at all, which is worse than
  // showing an unfamiliar code.
  it('falls back to the raw code for a type outside the known set', () => {
    expect(dispositionTypeLabel('made-up' as never)).toBe('made-up');
  });
});

describe('the follow-up interval', () => {
  it('reads as a duration for a real interval', () => {
    expect(followUpInLabel(1)).toBe('Follow-up visit in 1 day');
  });

  // THE trap: 0 is a sentinel for "as needed", not a zero-day interval. "Follow up in 0 day(s)" is what
  // printing the number gives.
  it('reads as "as needed" for zero, without the "in"', () => {
    expect(followUpInLabel(0)).toBe('Follow-up visit as needed');
  });

  it('says nothing when no interval was set', () => {
    expect(followUpInLabel(undefined)).toBeUndefined();
  });

  it('says nothing for a value the option list does not know', () => {
    expect(followUpInLabel(999)).toBeUndefined();
  });
});

describe('both surfaces render the disposition from the shared component', () => {
  it.each([
    ['the Easy Chart note pane', NOTE_PANE],
    ['the progress note Plan block', PROGRESS_NOTE_PLAN],
  ])('%s uses DispositionSummary', (_name, path) => {
    const source = readFileSync(path, 'utf8');
    expect(source).toContain('<DispositionSummary');
    expect(source).toContain('dispositionTypeLabel(');
  });

  // Re-deriving any of these locally is how the two surfaces drift apart again.
  it.each([
    ['the Easy Chart note pane', NOTE_PANE],
    ['the progress note Plan block', PROGRESS_NOTE_PLAN],
  ])('%s does not re-derive the disposition labels itself', (_name, path) => {
    const source = readFileSync(path, 'utf8');
    expect(source).not.toContain('mapDispositionTypeToLabel');
    expect(source).not.toContain('followUpInOptions');
    expect(source).not.toContain('getSpecialtyTransferDisplay');
  });
});
