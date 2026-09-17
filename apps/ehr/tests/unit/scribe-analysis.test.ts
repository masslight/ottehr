// The seam between the Easy Chart endpoints and the recommendations panel: typed actions in, recommendations
// the panel can show and edit out, and the edited recommendation back into the action the executor runs.

import { ExamLeaf } from 'utils/lib/config-helpers/exam-leaves';
import { ChartPlanResponse, ChartReviewResponse, PlannedAction, ReviewSuggestion } from 'utils/lib/easy-chart/api';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { describe, expect, it } from 'vitest';
import { buildChartSnapshot } from '../../src/features/easy-chart/executor/chartSnapshot';
import {
  appendToNoteField,
  buildAnalysis,
  INFERRED_NOTE,
  recommendationKey,
  resolveExamFinding,
  sectionForAction,
  toPlannedAction,
} from '../../src/features/visits/shared/components/scribe-recommendations/analysis';
import {
  ExamRecommendation,
  ExamResolution,
  ScribeRecommendation,
} from '../../src/features/visits/shared/components/scribe-recommendations/types';

const envelope = { usage: [], escalation: { attempts: 1, escalated: false, failures: [] }, triggers: [] };
const plan = (actions: PlannedAction[], rejected: ChartPlanResponse['rejected'] = []): ChartPlanResponse => ({
  actions,
  rejected,
  ...envelope,
});
const review = (
  suggestions: ReviewSuggestion[],
  rejected: ChartReviewResponse['rejected'] = []
): ChartReviewResponse => ({ suggestions, rejected, ...envelope });

const analyse = (
  actions: PlannedAction[],
  options: { review?: ChartReviewResponse; written?: Record<string, string> } = {}
): ScribeRecommendation[] =>
  buildAnalysis(plan(actions), options.review, { written: options.written ?? {} }).recommendations;

describe('buildAnalysis', () => {
  it('turns the kinds the panel has editors for into typed recommendations, in their sections', () => {
    const recs = analyse([
      { kind: 'apply-template', display: 'Sinusitis', templateId: 't-1', sourceText: 'sinus infection' },
      {
        kind: 'edit-note-text',
        field: 'historyOfPresentIllness',
        newText: 'Sinus pressure x 1 week.',
        sourceText: 'a week',
      },
      { kind: 'add-ros-finding', display: 'denies fever', finding: 'denies', sourceText: 'No fever.' },
      {
        kind: 'set-vital',
        field: 'vital-weight',
        display: '170 pounds',
        value: 170,
        unit: 'lb',
        sourceText: '170 pounds',
      },
      { kind: 'add-allergy', display: 'Fentanyl', sourceText: 'Fentanyl.' },
      { kind: 'add-medication', display: 'Ibuprofen', strength: '200 mg', sourceText: 'Ibuprofen' },
      {
        kind: 'add-diagnosis',
        code: 'J01.90',
        display: 'Acute sinusitis, unspecified',
        isPrimary: true,
        sourceText: 'sinus infection',
      },
    ]);

    expect(recs.map((rec) => [rec.kind, rec.section])).toEqual([
      ['template', 'template'],
      ['hpi', 'hpi'],
      ['ros', 'ros'],
      ['vital-weight', 'vitals'],
      ['allergy', 'allergies'],
      ['medication', 'medications'],
      ['diagnosis', 'assessment'],
    ]);
    expect(recs[0]).toMatchObject({ templateName: 'Sinusitis', templateId: 't-1' });
    expect(recs[1]).toMatchObject({ field: 'historyOfPresentIllness', text: 'Sinus pressure x 1 week.' });
    // The ROS wording resolved against the config's own catalogue, exactly as the executor will resolve it.
    expect(recs[2]).toMatchObject({
      baseKey: 'ros-constitutional-fever',
      label: 'Fever',
      systemLabel: 'Constitutional',
      finding: RosFindingState.Denies,
    });
    expect(recs[3]).toMatchObject({ weightLbs: 170 });
    expect(recs[5]).toMatchObject({ name: 'Ibuprofen', strength: '200 mg' });
    expect(recs[6]).toMatchObject({ code: 'J01.90', isPrimary: true, transcriptTerm: 'sinus infection' });
    // Every recommendation keeps the endpoint's action, so applying it needs no second reading of the fields.
    recs.forEach((rec) => expect(rec.action?.kind).toBeDefined());
  });

  it('shows a kilogram weight in pounds for the editor, and puts pounds back on the wire', () => {
    const [rec] = analyse([{ kind: 'set-vital', field: 'vital-weight', display: '77 kg', value: 77, unit: 'kg' }]);
    expect(rec).toMatchObject({ kind: 'vital-weight', weightLbs: 169.8 });
    expect(toPlannedAction(rec)).toMatchObject({ kind: 'set-vital', field: 'vital-weight', value: 169.8, unit: 'lb' });
  });

  it('wraps everything else as a generic row carrying the step label the executor would show', () => {
    const recs = analyse([
      // A removal is matched against the chart, not the catalogue, so it stays generic.
      { kind: 'remove-exam-finding', display: 'Sinus tenderness', sourceText: 'sinuses are not tender' },
      { kind: 'set-disposition', dispositionType: 'pcp', text: 'Follow up with PCP in one week.' },
      { kind: 'set-em-code', code: '99213', display: 'Office visit, established, low' },
      // Another vital has no editor of its own.
      { kind: 'set-vital', field: 'vital-temperature', display: '38 C', value: 38, unit: 'C' },
    ]);
    expect(recs.map((rec) => [rec.kind, rec.section])).toEqual([
      ['action', 'exam'],
      ['action', 'plan'],
      ['action', 'assessment'],
      ['action', 'vitals'],
    ]);
    expect(recs[0]).toMatchObject({ label: 'Removing exam finding: Sinus tenderness' });
    expect(recs[1]).toMatchObject({ label: 'Setting disposition: pcp', secondary: 'Follow up with PCP in one week.' });
    expect(recs[2]).toMatchObject({ label: 'Setting E&M level: 99213', secondary: 'Office visit, established, low' });
    // The wrapped action is returned untouched.
    expect(toPlannedAction(recs[3])).toEqual({
      kind: 'set-vital',
      field: 'vital-temperature',
      display: '38 C',
      value: 38,
      unit: 'C',
    });
  });

  it('keeps the quote as evidence, the guard’s caution as the warning, and says when an item was inferred', () => {
    const [quoted, inferred, flagged] = analyse([
      { kind: 'add-allergy', display: 'Fentanyl', sourceText: 'Fentanyl. I had a bad reaction.' },
      { kind: 'add-allergy', display: 'Latex' },
      {
        kind: 'set-vital',
        field: 'vital-weight',
        display: '170 lb',
        value: 170,
        unit: 'lb',
        caution: 'Patient-reported, not measured.',
        needsProvider: true,
      },
    ]);
    expect(quoted).toMatchObject({ evidence: 'Fentanyl. I had a bad reaction.' });
    expect(quoted.note).toBeUndefined();
    expect(inferred.evidence).toBeUndefined();
    expect(inferred.note).toBe(INFERRED_NOTE);
    expect(flagged.warning).toMatch(/^Patient-reported, not measured\. The assistant could not establish a value/);
  });

  // A quote the server verified against the chart state — a resulted test behind a diagnosis — is the
  // chart's words, not the narrative's: shown as such, with nothing in the narrative to highlight.
  it('shows a quote of the chart as the chart’s words, with no narrative evidence', () => {
    const chartLine = 'In-house lab resulted: Test: Rapid strep | Result: Positive | Flag: abnormal';
    const [fromChart] = buildAnalysis(
      plan([
        {
          kind: 'add-diagnosis',
          code: 'J02.0',
          display: 'Streptococcal pharyngitis',
          sourceText: chartLine,
          sourceOrigin: 'chart',
        },
      ]),
      undefined,
      { written: {}, narrative: 'Sore throat for two days.', narrativeGenerated: [], narrativeIsTranscript: true }
    ).recommendations;
    expect(fromChart).toMatchObject({ chartSources: [chartLine], evidenceOrigin: 'chart' });
    expect(fromChart.evidence).toBeUndefined();
    expect(fromChart.transcriptSources).toBeUndefined();
    expect(fromChart.note).toBeUndefined();
  });

  it('measures the text a note row would go after, and measures nothing for an empty field', () => {
    const edit: PlannedAction = { kind: 'edit-note-text', field: 'medicalDecision', newText: 'New MDM.' };
    const [onto] = analyse([edit], { written: { medicalDecision: 'The MDM the provider typed.' } });
    // Not a warning: adding after the provider's words is not overwriting them. The count feeds the row's chip.
    expect(onto).toMatchObject({ kind: 'hpi', section: 'assessment', existingWords: 5 });
    expect(onto.warning).toBeUndefined();
    const [fresh] = analyse([edit], { written: {} });
    expect(fresh).not.toHaveProperty('existingWords');
    expect(fresh.warning).toBeUndefined();
  });

  it('drops what the review repeats from the plan and keeps what it adds, tagged with its question', () => {
    const recs = analyse(
      [{ kind: 'add-diagnosis', code: 'J01.90', display: 'Acute sinusitis, unspecified', isPrimary: true }],
      {
        review: review([
          {
            category: 'diagnosis',
            question: 'Is sinusitis the primary diagnosis?',
            actions: [
              { kind: 'add-diagnosis', code: 'J01.90', display: 'Acute sinusitis, unspecified', isPrimary: true },
            ],
          },
          {
            category: 'pertinent-negative',
            question: 'Record the pertinent negative for chills?',
            rationale: 'Fever was denied; chills were not asked.',
            actions: [{ kind: 'add-ros-finding', display: 'denies chills', finding: 'denies' }],
          },
        ]),
      }
    );
    expect(recs.map((rec) => rec.id)).toEqual(['plan:add-diagnosis:J01-90', 'review:add-ros-finding:denies-chills']);
    expect(recs[1]).toMatchObject({
      kind: 'ros',
      baseKey: 'ros-constitutional-chills',
      source: { pass: 'review', category: 'pertinent-negative' },
      note: `Note review asked: Record the pertinent negative for chills? Fever was denied; chills were not asked. ${INFERRED_NOTE}`,
    });
  });

  it('keeps one proposal per thing the chart would hold, whichever way the model said it', () => {
    const recs = analyse([
      { kind: 'add-allergy', display: 'Penicillin' },
      { kind: 'add-allergy', display: 'penicillin ' },
      { kind: 'add-ros-finding', display: 'denies fever', finding: 'denies' },
      // The transcript cannot both report and deny it: the first reading wins.
      { kind: 'add-ros-finding', display: 'reports fever', finding: 'reports' },
      // Both resolve to the same box in the default exam config, so they are one proposal.
      { kind: 'add-exam-finding', display: 'Sinus tenderness' },
      { kind: 'add-exam-finding', display: 'sinus tenderness' },
    ]);
    expect(recs.map(recommendationKey)).toEqual([
      'allergy:penicillin',
      'ros:ros-constitutional-fever',
      'exam:sinus-tenderness',
    ]);
  });

  it('turns chat-only actions into notes and carries the servers’ refusals through', () => {
    const analysis = buildAnalysis(
      plan(
        [
          { kind: 'provider-note', text: 'Consider adding the knee surgery to surgical history.' },
          { kind: 'reply', text: 'Noted.' },
          { kind: 'unknown', message: 'Could not classify "call the pharmacy".' },
          { kind: 'provider-note', text: 'Noted.' },
        ],
        [{ kind: 'set-vital', display: '5.8', reason: 'a bare height could be centimetres or inches' }]
      ),
      review([], [{ kind: 'remove-diagnosis', display: 'R42', reason: 'the replacement could not be charted' }]),
      { written: {} }
    );
    expect(analysis.recommendations).toEqual([]);
    expect(analysis.notes).toEqual([
      'Consider adding the knee surgery to surgical history.',
      'Noted.',
      'Could not classify "call the pharmacy".',
    ]);
    expect(analysis.rejected.map((item) => item.reason)).toEqual([
      'a bare height could be centimetres or inches',
      'the replacement could not be charted',
    ]);
  });

  it('gives readable ids made of the action, unique even when an action repeats', () => {
    const recs = analyse([
      { kind: 'add-diagnosis', code: 'J01.90', display: 'Acute sinusitis' },
      { kind: 'set-vital', field: 'vital-weight', display: '170 lb', value: 170, unit: 'lb' },
      { kind: 'add-medication', display: 'Claritin (loratadine)' },
      { kind: 'add-patient-instruction', text: 'Rest and fluids.' },
      { kind: 'add-patient-instruction', text: 'Rest and fluids' },
    ]);
    expect(recs.map((rec) => rec.id)).toEqual([
      'plan:add-diagnosis:J01-90',
      'plan:set-vital:vital-weight',
      'plan:add-medication:Claritin-loratadine',
      'plan:add-patient-instruction:Rest-and-fluids',
      'plan:add-patient-instruction:Rest-and-fluids:2',
    ]);
  });

  it('leaves a review-of-systems wording that matches several symptoms as a generic row', () => {
    // "pain" is in a dozen labels across as many systems; guessing one would chart the wrong finding.
    const [rec] = analyse([{ kind: 'add-ros-finding', display: 'reports pain', finding: 'reports' }]);
    expect(rec).toMatchObject({ kind: 'action', section: 'ros', label: 'Review of systems: reports pain' });
  });

  it('files each action kind under the section its page charts', () => {
    expect(sectionForAction({ kind: 'edit-note-text', field: 'ros' })).toBe('ros');
    expect(sectionForAction({ kind: 'edit-note-text', field: 'chiefComplaint' })).toBe('hpi');
    expect(sectionForAction({ kind: 'add-surgical-history' })).toBe('history');
    expect(sectionForAction({ kind: 'add-cpt', code: '99213' })).toBe('assessment');
    expect(sectionForAction({ kind: 'add-in-house-lab' })).toBe('orders');
    expect(sectionForAction({ kind: 'add-procedure' })).toBe('procedures');
  });
});

describe('the narrative is the transcript, with the evidence highlighted', () => {
  const transcript = `Provider: Any fever?\nPatient: No fever. I checked a couple of times.\nPatient: I'm about 170 pounds.`;

  it('cuts the transcript into plain runs and cited runs carrying the ids of the recommendations they produced', () => {
    const analysis = buildAnalysis(
      plan([
        {
          kind: 'add-ros-finding',
          display: 'denies fever',
          finding: 'denies',
          sourceText: 'No fever. I checked a couple of times.',
        },
        // The quote is matched the way the server matched it: punctuation is noise, so the trailing period stays plain.
        {
          kind: 'set-vital',
          field: 'vital-weight',
          display: '170 pounds',
          value: 170,
          unit: 'lb',
          sourceText: "I'm about 170 pounds",
        },
        // Inferred, so it has no place in the story.
        { kind: 'add-allergy', display: 'Latex' },
      ]),
      undefined,
      { written: {}, narrative: transcript }
    );
    expect(analysis.narrativeRuns).toEqual([
      { text: 'Provider: Any fever?\nPatient: ' },
      { text: 'No fever. I checked a couple of times.', itemIds: ['plan:add-ros-finding:denies-fever'] },
      { text: '\nPatient: ' },
      { text: "I'm about 170 pounds", itemIds: ['plan:set-vital:vital-weight'] },
      { text: '.' },
    ]);
  });

  it('lets two recommendations share a phrase, cutting the sentence where their quotes overlap', () => {
    const sentence = "Patient: I've had this post-nasal drip and pressure for a week.";
    const analysis = buildAnalysis(
      plan([
        {
          kind: 'edit-note-text',
          field: 'historyOfPresentIllness',
          newText: 'PND and sinus pressure x 1 week.',
          sourceText: "I've had this post-nasal drip and pressure for a week.",
        },
        { kind: 'add-diagnosis', code: 'R09.82', display: 'Postnasal drip', sourceText: 'post-nasal drip' },
      ]),
      undefined,
      { written: {}, narrative: sentence }
    );
    const hpi = 'plan:edit-note-text:historyOfPresentIllness';
    expect(analysis.narrativeRuns).toEqual([
      { text: 'Patient: ' },
      { text: "I've had this ", itemIds: [hpi] },
      { text: 'post-nasal drip', itemIds: [hpi, 'plan:add-diagnosis:R09-82'] },
      { text: ' and pressure for a week.', itemIds: [hpi] },
    ]);
  });

  it('has no narrative without a transcript, and a plain one when nothing was quoted', () => {
    const actions: PlannedAction[] = [{ kind: 'add-allergy', display: 'Latex' }];
    expect(buildAnalysis(plan(actions), undefined, { written: {} }).narrativeRuns).toEqual([]);
    expect(
      buildAnalysis(plan(actions), undefined, { written: {}, narrative: 'Allergic to latex.' }).narrativeRuns
    ).toEqual([{ text: 'Allergic to latex.' }]);
  });
});

// An exam finding is resolved against the exam's checkboxes when the list is built — the same lookup the
// executor runs at apply time — so the row can name the box, offer the choice, or say where a miss goes.
describe('exam findings', () => {
  // A catalogue small enough to reason about: one box that matches on its own, two that tie, and nothing
  // for a finding the exam has no box for.
  const leaf = (field: string, leafLabel: string, extra: Partial<ExamLeaf> = {}): ExamLeaf => ({
    field,
    leafLabel,
    label: [...(extra.path ?? []), leafLabel].join(': '),
    sectionKey: 'lungs',
    sectionLabel: 'Lungs, Chest Wall',
    polarity: 'abnormal',
    path: [],
    ...extra,
  });
  const wheezing = leaf('wheezing', 'Wheezing');
  const rightTm = leaf('right-ear-tm-bulging', 'TM bulging', {
    sectionKey: 'ears',
    sectionLabel: 'Ears',
    path: ['Right ear'],
  });
  const leftTm = leaf('left-ear-tm-bulging', 'TM bulging', {
    sectionKey: 'ears',
    sectionLabel: 'Ears',
    path: ['Left ear'],
  });
  const examCatalogue = [wheezing, rightTm, leftTm];
  const analyseExam = (actions: PlannedAction[]): ScribeRecommendation[] =>
    buildAnalysis(plan(actions), undefined, { written: {}, examCatalogue }).recommendations;

  it('names the one box a clear match will tick', () => {
    const [rec] = analyseExam([
      { kind: 'add-exam-finding', display: 'expiratory wheezing', searchTerms: ['wheeze'], sourceText: 'wheezing' },
    ]);
    expect(rec).toMatchObject({
      kind: 'exam',
      section: 'exam',
      display: 'expiratory wheezing',
      searchTerms: ['wheeze'],
      resolution: { kind: 'confident', leaf: wheezing },
      evidence: 'wheezing',
    });
  });

  it('offers the near-equal boxes, best first, and leaves the choice to the provider', () => {
    const [rec] = analyseExam([{ kind: 'add-exam-finding', display: 'TM bulging' }]);
    expect(rec).toMatchObject({ kind: 'exam', resolution: { kind: 'ambiguous' } });
    const resolution = (rec as ExamRecommendation).resolution as Extract<ExamResolution, { kind: 'ambiguous' }>;
    expect(resolution.alternatives.map((alternative) => alternative.field).sort()).toEqual([
      'left-ear-tm-bulging',
      'right-ear-tm-bulging',
    ]);
    expect(resolution.alternatives).toContainEqual(resolution.leaf);
    expect(resolution.chosen).toBeUndefined();
  });

  it('says which card’s comment will take the words when no box fits them', () => {
    const [placed, unplaced] = analyseExam([
      // "tragus" names the Ears card and no box, exactly as `writeExamComment` would place it.
      { kind: 'add-exam-finding', display: 'Tenderness over the tragus' },
      { kind: 'add-exam-finding', display: 'Diaphoretic and pale' },
    ]);
    expect(placed).toMatchObject({
      resolution: { kind: 'none', sectionKey: 'ears', sectionLabel: 'Ears', commentField: 'ears-comment' },
    });
    expect(unplaced).toMatchObject({
      resolution: {
        kind: 'none',
        sectionKey: 'general',
        sectionLabel: 'General Appearance',
        commentField: 'general-comment',
      },
    });
  });

  it('hands the executor the box the provider read or chose, and nothing to search for otherwise', () => {
    const [clear, tied, missed] = analyseExam([
      { kind: 'add-exam-finding', display: 'wheezing', searchTerms: ['wheeze'], sourceText: 'wheezing' },
      { kind: 'add-exam-finding', display: 'TM bulging' },
      { kind: 'add-exam-finding', display: 'Diaphoretic and pale' },
    ]);
    expect(toPlannedAction(clear)).toEqual({
      kind: 'add-exam-finding',
      display: 'wheezing',
      searchTerms: ['wheeze'],
      sourceText: 'wheezing',
      resolvedLeaf: wheezing,
    });
    // Unchosen, the executor resolves it as it always did: the picker, or the batch's auto-pick.
    expect(toPlannedAction(tied)).toEqual({ kind: 'add-exam-finding', display: 'TM bulging' });
    const chosen = {
      ...tied,
      resolution: { ...(tied as ExamRecommendation).resolution, chosen: rightTm },
    } as ScribeRecommendation;
    expect(toPlannedAction(chosen)).toEqual({ kind: 'add-exam-finding', display: 'TM bulging', resolvedLeaf: rightTm });
    // A miss is the executor's to note in the card's comment.
    expect(toPlannedAction(missed)).toEqual({ kind: 'add-exam-finding', display: 'Diaphoretic and pale' });
  });

  it('looks reworded text up afresh, without the synonyms that described the old words', () => {
    const [rec] = analyseExam([{ kind: 'add-exam-finding', display: 'TM bulging', searchTerms: ['tympanic'] }]);
    // What the editor does on save: the new words alone, through the same lookup.
    const reworded = {
      ...rec,
      display: 'wheezing',
      searchTerms: undefined,
      resolution: resolveExamFinding('wheezing', undefined, examCatalogue),
    } as ScribeRecommendation;
    expect(reworded).toMatchObject({ resolution: { kind: 'confident', leaf: wheezing } });
    expect(toPlannedAction(reworded)).toEqual({
      kind: 'add-exam-finding',
      display: 'wheezing',
      resolvedLeaf: wheezing,
    });
  });
});

describe('transcript provenance for an inexact narrative sentence', () => {
  it('shows the closest transcript passage when the generated sentence had no verbatim snippet', () => {
    const narrative = 'Patient recently completed a course of antibiotics for allergies.';
    const generated = [
      {
        text: narrative,
        sources: [],
        approximateSource: 'they gave me some antibiotics. And I think there are a couple more left.',
      },
    ];
    const plan = {
      actions: [{ kind: 'add-medication', display: 'Antibiotic', sourceText: 'completed a course of antibiotics' }],
      rejected: [],
      usage: [],
      escalation: { attempts: 1, escalated: false, failures: [] },
      triggers: [],
    } as unknown as ChartPlanResponse;
    const analysis = buildAnalysis(plan, undefined, { written: {}, narrative, narrativeGenerated: generated });
    const rec = analysis.recommendations[0];
    expect(rec.evidenceOrigin).toBe('inexact');
    expect(rec.transcriptSources).toEqual(['they gave me some antibiotics. And I think there are a couple more left.']);
  });
});

describe('appendToNoteField', () => {
  const hpi: ScribeRecommendation = { id: 'hpi', kind: 'hpi', section: 'hpi', text: 'Sinus pressure x 1 week.' };
  const action = toPlannedAction(hpi);
  // The chart as the executor reads it at write time; the HPI is stored under the chiefComplaint key.
  const written = buildChartSnapshot({
    patientId: 'p-1',
    chiefComplaint: { resourceId: 'cc-1', text: 'Template HPI.' },
  } as GetChartDataResponse);

  it('lands the text as the row’s mode says: after the field by default, or over it', () => {
    expect(appendToNoteField(action, hpi, written).newText).toBe('Template HPI.\nSinus pressure x 1 week.');
    expect(appendToNoteField(action, hpi, written, 'append').newText).toBe('Template HPI.\nSinus pressure x 1 week.');
    // The executor's own edit-note-text is the rewrite, so replacing is handing the action on untouched.
    expect(appendToNoteField(action, hpi, written, 'replace')).toBe(action);
    // A skipped row is unticked and never applied; were it handed over anyway, nothing would be done to it.
    expect(appendToNoteField(action, hpi, written, 'skip')).toBe(action);
  });

  it('has nothing to append to in an empty field, and leaves every other kind alone', () => {
    expect(appendToNoteField(action, hpi, buildChartSnapshot(undefined), 'append')).toBe(action);
    const allergy: ScribeRecommendation = { id: 'a', kind: 'allergy', section: 'allergies', name: 'Latex' };
    const add = toPlannedAction(allergy);
    expect(appendToNoteField(add, allergy, written, 'append')).toBe(add);
  });
});

describe('toPlannedAction', () => {
  it('lays the provider’s edit over the endpoint’s action, and drops search terms for a renamed item', () => {
    const [allergy] = analyse([
      { kind: 'add-allergy', display: 'Fentanyl', searchTerms: ['fentanyl citrate'], sourceText: 'Fentanyl.' },
    ]);
    expect(toPlannedAction(allergy)).toEqual({
      kind: 'add-allergy',
      display: 'Fentanyl',
      searchTerms: ['fentanyl citrate'],
      sourceText: 'Fentanyl.',
    });
    // Renamed: the synonyms described the old name and could pull the wrong product.
    const renamed = { ...allergy, name: 'Fentanyl patch' } as ScribeRecommendation;
    expect(toPlannedAction(renamed)).toEqual({
      kind: 'add-allergy',
      display: 'Fentanyl patch',
      sourceText: 'Fentanyl.',
    });
  });

  it('carries a flipped review-of-systems finding in the polarity and keeps the wording that resolved it', () => {
    const [ros] = analyse([{ kind: 'add-ros-finding', display: 'denies fever', finding: 'denies' }]);
    expect(ros).toMatchObject({ kind: 'ros', finding: RosFindingState.Denies });
    const flipped = { ...ros, finding: RosFindingState.Reports } as ScribeRecommendation;
    expect(toPlannedAction(flipped)).toEqual({ kind: 'add-ros-finding', display: 'denies fever', finding: 'reports' });
  });

  it('puts an edited diagnosis, weight and note text on the wire as the executor expects them', () => {
    const [dx, weight, note] = analyse([
      { kind: 'add-diagnosis', code: 'R09.82', display: 'Postnasal drip', sourceText: 'post-nasal drip' },
      { kind: 'set-vital', field: 'vital-weight', display: '170 lb', value: 170, unit: 'lb' },
      { kind: 'edit-note-text', field: 'historyOfPresentIllness', newText: 'Old text.' },
    ]);
    expect(
      toPlannedAction({ ...dx, code: 'J01.00', display: 'Acute maxillary sinusitis' } as ScribeRecommendation)
    ).toEqual({
      kind: 'add-diagnosis',
      code: 'J01.00',
      display: 'Acute maxillary sinusitis',
      isPrimary: false,
      sourceText: 'post-nasal drip',
    });
    expect(toPlannedAction({ ...weight, weightLbs: 175 } as ScribeRecommendation)).toEqual({
      kind: 'set-vital',
      field: 'vital-weight',
      display: '175 lb',
      value: 175,
      unit: 'lb',
    });
    expect(toPlannedAction({ ...note, text: 'New text.' } as ScribeRecommendation)).toEqual({
      kind: 'edit-note-text',
      field: 'historyOfPresentIllness',
      newText: 'New text.',
    });
  });

  it('builds an action from a recommendation that has none', () => {
    expect(toPlannedAction({ id: 'tpl', kind: 'template', section: 'template', templateName: 'Sinusitis' })).toEqual({
      kind: 'apply-template',
      display: 'Sinusitis',
    });
    expect(
      toPlannedAction({
        id: 'ros',
        kind: 'ros',
        section: 'ros',
        baseKey: 'ros-ent-ear-pain',
        label: 'Ear pain',
        systemLabel: 'Ears/Nose/Throat',
        finding: RosFindingState.Denies,
      })
    ).toEqual({ kind: 'add-ros-finding', display: 'Ears/Nose/Throat: Ear pain', finding: 'denies' });
  });
});
