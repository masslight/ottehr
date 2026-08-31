// The post-template reconciliation: the merge rules, and the wiring that makes the second pass possible.
//
// Every rule here exists because its absence produced a specific wrong note, and each test names which.

import { readFileSync } from 'fs';
import { join } from 'path';
import { PlannedAction } from 'utils/lib/easy-chart/api';
import { describe, expect, it } from 'vitest';
import {
  isAlreadyCharted,
  mergeTemplateReconciliation,
  needsChartReread,
  templateStepIndex,
} from '../../src/features/easy-chart/executor/template-reconcile';
import { ChartSnapshot } from '../../src/features/easy-chart/executor/types';

const read = (relativePath: string): string => readFileSync(join(__dirname, '../..', relativePath), 'utf8');
const ASSISTANT = read('src/features/easy-chart/hooks/useChartAssistant.ts');
const RUN_PLAN = read('src/features/easy-chart/executor/runPlan.ts');

const emptyChart = (over: Partial<ChartSnapshot> = {}): ChartSnapshot =>
  ({
    diagnoses: [],
    examFindings: [],
    rosFindings: [],
    medications: [],
    allergies: [],
    conditions: [],
    surgicalHistory: [],
    hospitalizations: [],
    procedures: [],
    cptCodes: [],
    hasEmCode: false,
    ...over,
  }) as unknown as ChartSnapshot;

const action = (kind: string, over: Record<string, unknown> = {}): PlannedAction =>
  ({ kind, ...over }) as unknown as PlannedAction;

describe('where the plan pauses', () => {
  it('finds the apply-template step', () => {
    expect(templateStepIndex([action('add-diagnosis'), action('apply-template')])).toBe(1);
  });

  it('reports -1 when no template is planned, so the plan runs as one piece', () => {
    expect(templateStepIndex([action('add-diagnosis'), action('add-cpt')])).toBe(-1);
  });

  it('names apply-template as the one step whose writes the snapshot cannot model', () => {
    // Its response reports warnings and nothing else — no ids, no kinds. Every other write reports what
    // it created, which is what lets advanceSnapshot keep the snapshot honest without a round trip.
    expect(needsChartReread(action('apply-template'))).toBe(true);
    expect(needsChartReread(action('add-diagnosis'))).toBe(false);
    expect(needsChartReread(action('add-exam-finding'))).toBe(false);
  });
});

describe('rule 1 — no second template', () => {
  it('drops apply-template from the reconciliation output', () => {
    // A second one duplicates the first, or replaces the wrong fields when a different title comes back.
    const merged = mergeTemplateReconciliation({
      pending: [],
      reconciliation: [action('apply-template', { display: 'Sore throat' })],
      chart: emptyChart(),
    });
    expect(merged).toHaveLength(0);
  });
});

describe('rule 2 — the first pass owns the note text', () => {
  it('drops edit-note-text from the reconciliation and keeps the first pass version', () => {
    // The second pass re-summarises: a detailed HPI comes back as "Patient presents with <dx>".
    const firstPass = action('edit-note-text', {
      field: 'historyOfPresentIllness',
      newText: 'Detailed history as dictated.',
    });
    const merged = mergeTemplateReconciliation({
      pending: [firstPass],
      reconciliation: [action('edit-note-text', { field: 'historyOfPresentIllness', newText: 'Patient presents.' })],
      chart: emptyChart(),
    });
    expect(merged).toEqual([firstPass]);
  });
});

describe('rule 3 — nothing already on the chart', () => {
  it('drops a diagnosis the template already charted, from EITHER pass', () => {
    // Not idempotent: each add writes a fresh Condition, so this is how a note ends up with two J02.0.
    const chart = emptyChart({ diagnoses: [{ resourceId: '1', display: 'Strep', code: 'J02.0' }] } as never);
    const merged = mergeTemplateReconciliation({
      pending: [action('add-diagnosis', { code: 'J02.0', display: 'Strep' })],
      reconciliation: [action('add-diagnosis', { code: 'j02.0', display: 'Strep pharyngitis' })],
      chart,
    });
    expect(merged).toHaveLength(0);
  });

  it('drops a CPT the template already charted', () => {
    const chart = emptyChart({ cptCodes: [{ resourceId: '1', display: 'Strep test', code: '87880' }] } as never);
    expect(isAlreadyCharted(action('add-cpt', { code: '87880' }), chart)).toBe(true);
  });

  it('does not re-set an E&M level the template already set', () => {
    expect(isAlreadyCharted(action('set-em-code', { code: '99213' }), emptyChart({ hasEmCode: true }))).toBe(true);
    expect(isAlreadyCharted(action('set-em-code', { code: '99213' }), emptyChart({ hasEmCode: false }))).toBe(false);
  });

  it('NEVER filters an exam finding, because charting one twice is a no-op and dropping it is not', () => {
    // The reconciliation pair removes the template's normal and adds the dictated abnormal in the SAME
    // slot. Treating the add as "already charted" leaves the finding nowhere at all.
    const chart = emptyChart({ examFindings: [{ resourceId: '1', display: 'Oropharynx clear' }] } as never);
    expect(isAlreadyCharted(action('add-exam-finding', { display: 'Oropharynx clear' }), chart)).toBe(false);
  });
});

describe('rule 4 — first-pass exam steps survive the second pass silence', () => {
  it('keeps a first-pass exam step the reconciliation did not mention', () => {
    // Silence is not disagreement: the second pass was asked a narrower question.
    const dictated = action('add-exam-finding', { display: 'Oropharynx injected' });
    const merged = mergeTemplateReconciliation({
      pending: [dictated],
      reconciliation: [action('remove-exam-finding', { display: 'Oropharynx clear' })],
      chart: emptyChart(),
    });
    expect(merged).toContain(dictated);
  });

  it('does not chart the same subject twice when both passes asked for it', () => {
    const merged = mergeTemplateReconciliation({
      pending: [action('add-exam-finding', { display: 'Oropharynx injected' })],
      reconciliation: [action('add-exam-finding', { display: 'oropharynx injected!' })],
      chart: emptyChart(),
    });
    expect(merged).toHaveLength(1);
  });
});

describe('ordering — removals clear the slot before additions land in it', () => {
  it('runs every reconciliation removal before any addition', () => {
    // Otherwise the exam removal resolves against a chart holding BOTH the template normal and the
    // just-added abnormal, and containment matching can take out the one just added.
    const merged = mergeTemplateReconciliation({
      pending: [action('add-cpt', { code: '99000', display: 'Handling' })],
      reconciliation: [
        action('add-exam-finding', { display: 'Oropharynx injected' }),
        action('remove-exam-finding', { display: 'Oropharynx clear' }),
        action('remove-diagnosis', { display: 'Personal history of pneumonia' }),
      ],
      chart: emptyChart(),
    });
    const firstAddition = merged.findIndex((a) => !a.kind.startsWith('remove-'));
    const lastRemoval = merged.map((a) => a.kind.startsWith('remove-')).lastIndexOf(true);
    expect(lastRemoval).toBeLessThan(firstAddition);
  });
});

describe('the wiring the second pass depends on', () => {
  it('re-reads the chart before reconciling, and acts on the returned value', () => {
    // Reading it back off `chartRef` would be a race: the refetch resolves before React re-renders.
    expect(ASSISTANT).toContain('await options.refetchChart()');
    expect(ASSISTANT).toMatch(/const fresh = await options\.refetchChart\(\)/);
    expect(ASSISTANT).toContain('buildChartSnapshot(fresh)');
  });

  it('asks the reconciliation call to withhold templates rather than trusting an instruction', () => {
    expect(ASSISTANT).toContain('reconcileTemplate: true');
  });

  it('skips the second model call when no template actually landed', () => {
    // A template that matched nothing leaves nothing to reconcile; spending a call to be told so only
    // makes a failed step slower.
    expect(ASSISTANT).toContain('templateApplied');
    expect(ASSISTANT).toContain('if (!templateApplied)');
  });

  it('numbers the second run past the first, so live steps do not overwrite each other', () => {
    // BOTH tails need it — the one that runs when no template landed and the reconciled one — because
    // either would otherwise renumber from zero and make finished steps turn back into running ones.
    expect(RUN_PLAN).toContain('indexOffset');
    expect(ASSISTANT.match(/indexOffset: templateAt \+ 1/g)).toHaveLength(2);
  });

  it('tells the provider when the reconciliation could not run', () => {
    // Silent degrade means a note that may still assert a normal the provider contradicted.
    const block = ASSISTANT.slice(ASSISTANT.indexOf('post-template reconciliation failed'));
    expect(block.slice(0, 700)).toContain("kind: 'provider-note'");
  });

  it('attributes the template rows to the template, as inferred rather than sourced', () => {
    // A template's contents come from its title, never from the narrative.
    expect(ASSISTANT).toContain('diffCreatedResourceIds(idsBeforeTemplate');
    expect(ASSISTANT).toContain('inferredResourceIds: templateIds');
  });
});
