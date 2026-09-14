/**
 * dump-prompt.ts — write the exact prompt a surface sends to the model, to a file, for reading.
 *
 * The prompts are assembled from the capability registry, the per-surface rules and a per-call tail,
 * so there is no single file to open and read: the only faithful way to see one is to build it. This
 * does that and writes it out.
 *
 * The per-visit tail is SYNTHETIC by default — invented demographics, an invented chart state, an
 * invented narrative — so the output carries no patient data and can be shared. Pass `--case caseNNN`
 * to substitute that case's real narrative and its gold-derived chart context instead; the result is
 * PHI and must stay local.
 *
 * The tail is filled completely on purpose. Every optional field left out renders as an absent block,
 * so a half-filled tail shows a prompt shape that no real call ever sends.
 *
 * Usage:
 *   npx tsx tools/easy-chart-eval/dump-prompt.ts plan   /tmp/plan.txt
 *   npx tsx tools/easy-chart-eval/dump-prompt.ts review /tmp/review.txt
 *   npx tsx tools/easy-chart-eval/dump-prompt.ts plan   /tmp/plan.txt --case case001   # PHI
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildPrompt, PromptTailInput } from 'utils/lib/easy-chart/prompt';
import { capabilitiesForSurface, Surface } from 'utils/lib/easy-chart/registry';

/** Invented, and deliberately clinical enough that every prompt block renders as it would live. */
const SYNTHETIC: PromptTailInput = {
  narrative:
    'Provider: Hi, I am Dr. Reyes. What brings you in? — Patient: My throat has been sore for three ' +
    'days and I have been running a fever. No cough, no trouble breathing. — Provider: Any ear pain? ' +
    'No. Let me look. Your throat is quite red with some exudate on the right tonsil, and you have ' +
    'tender nodes in the neck. Lungs are clear. I am going to run a rapid strep. That is positive, so ' +
    'this is strep throat. I will send amoxicillin 500 milligrams twice a day for ten days, and you ' +
    'can take ibuprofen for the pain. Follow up in a week if it is not better.',
  templateTitles: ['Pharyngitis', 'Sinusitis', 'Otitis Media', 'Urinary Tract Infection'],

  patientLine: 'Age: 24 years, Sex: female',
  patientStatus: 'new',
  chartStateSummary:
    'Diagnoses: J02.0 — Streptococcal pharyngitis (primary)\n' +
    'E&M code already set: 99203\n' +
    'Exam findings already checked:\n- Alert\n- Oropharynx clear with no erythema, lesions, or exudate\n- Lungs clear to auscultation',
  noteContext:
    'chiefComplaint: Sore throat\n\n' +
    'historyOfPresentIllness: New patient presents with a three-day sore throat and subjective fever.\n\n' +
    'medicalDecision: Rapid strep positive. Will treat with amoxicillin.',
};

/**
 * Blocks a FIRST-PASS call does not carry, added only under `--full-tail`.
 *
 * `appliedTemplate` comes from the REQUEST (a template applied before this call, server-validated),
 * `mustAddress` is force-included by the server for one call only — for plan when reconciling a
 * just-applied template, for review the computed disposition instruction. Filling them by default
 * showed two blocks that no first dictation ever sends, which over-represented the prompt.
 */
const EXTRA_TAIL: Partial<PromptTailInput> = {
  appliedTemplate: 'Pharyngitis',
  historyDigest: 'Provider: "add the strep test to billing"\nAssistant: charted add-cpt 87880',
  mustAddress:
    'The dictation states a follow-up plan ("follow up in a week if it is not better") and no ' +
    'disposition is charted. Address it.',
};

function main(): void {
  const [surfaceArg, outArg] = process.argv.slice(2);
  const surface = surfaceArg as Surface;
  const ci = process.argv.indexOf('--case');
  const caseId = ci >= 0 ? process.argv[ci + 1] : undefined;

  if (!surfaceArg || !outArg) {
    console.log('usage: dump-prompt.ts <surface> <outFile> [--case caseNNN]');
    console.log('surfaces: plan, review, template, findings, history, story, diagnoses, orders, plan-text, coding');
    process.exit(1);
  }

  let tail: PromptTailInput = process.argv.includes('--full-tail') ? { ...SYNTHETIC, ...EXTRA_TAIL } : SYNTHETIC;
  if (caseId) {
    const c = JSON.parse(readFileSync(join(__dirname, 'harvested-cases', `${caseId}.json`), 'utf8'));
    tail = { ...SYNTHETIC, narrative: c.transcript ?? SYNTHETIC.narrative };
  }

  const prompt = buildPrompt(surface, tail);
  const header = [
    `# easy-chart prompt — surface: ${surface}`,
    `# built ${new Date().toISOString()} from the working tree`,
    `# ${prompt.length} chars, ${prompt.split('\n').length} lines`,
    `# capabilities offered on this surface (${capabilitiesForSurface(surface).length}):`,
    `#   ${capabilitiesForSurface(surface).join(', ')}`,
    caseId
      ? `# per-visit tail: narrative taken from ${caseId} — CONTAINS PATIENT DATA, keep local`
      : `# per-visit tail: SYNTHETIC (invented patient, invented chart state) — no patient data`,
    '',
    '',
  ].join('\n');

  writeFileSync(outArg, header + prompt);
  console.log(`${surface}: ${prompt.length} chars, ${prompt.split('\n').length} lines -> ${outArg}`);
}

main();
