/**
 * Writes the exact prompt the planner sends to the model to a file. The per-visit tail is synthetic, so
 * the output carries no patient data; `--case caseNNN` substitutes a real narrative, which is PHI.
 *
 * Usage:
 *   npx tsx tools/easy-chart-eval/dump-prompt.ts /tmp/plan.txt
 *   npx tsx tools/easy-chart-eval/dump-prompt.ts /tmp/plan.txt --case case001   # PHI
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ACTION_KINDS } from 'utils/lib/easy-chart/actions';
import { buildPrompt, PromptTailInput } from 'utils/lib/easy-chart/prompt';

/** Invented, and clinical enough that every prompt block renders as it would live. */
const SYNTHETIC: PromptTailInput = {
  narrative:
    'Provider: Hi, I am Dr. Reyes. What brings you in? — Patient: My throat has been sore for three ' +
    'days and I have been running a fever. No cough, no trouble breathing. — Provider: Any ear pain? ' +
    'No. Let me look. Your throat is quite red with some exudate on the right tonsil, and you have ' +
    'tender nodes in the neck. Lungs are clear. I am going to run a rapid strep. That is positive, so ' +
    'this is strep throat. I will send amoxicillin 500 milligrams twice a day for ten days, and you ' +
    'can take ibuprofen for the pain. Follow up in a week if it is not better.',
  templates: [
    { title: 'Pharyngitis', diagnoses: [{ code: 'J02.9', display: 'Acute pharyngitis, unspecified' }] },
    { title: 'Sinusitis', diagnoses: [{ code: 'J01.90', display: 'Acute sinusitis, unspecified' }] },
    { title: 'Otitis Media', diagnoses: [{ code: 'H66.90', display: 'Otitis media, unspecified, unspecified ear' }] },
    {
      title: 'Urinary Tract Infection',
      diagnoses: [{ code: 'N39.0', display: 'Urinary tract infection, site not specified' }],
    },
  ],

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

function main(): void {
  const args = process.argv.slice(2);
  const ci = args.indexOf('--case');
  const caseId = ci >= 0 ? args[ci + 1] : undefined;
  const outArg = args.find((a, i) => !a.startsWith('--') && !(ci >= 0 && i === ci + 1));

  if (!outArg) {
    console.log('usage: dump-prompt.ts <outFile> [--case caseNNN]');
    process.exit(1);
  }

  let tail: PromptTailInput = SYNTHETIC;
  if (caseId) {
    const c = JSON.parse(readFileSync(join(__dirname, 'harvested-cases', `${caseId}.json`), 'utf8'));
    tail = { ...SYNTHETIC, narrative: c.transcript ?? SYNTHETIC.narrative };
  }

  const prompt = buildPrompt(tail);
  const header = [
    '# easy-chart planner prompt',
    `# built ${new Date().toISOString()} from the working tree`,
    `# ${prompt.length} chars, ${prompt.split('\n').length} lines`,
    `# action kinds offered (${ACTION_KINDS.length}):`,
    `#   ${ACTION_KINDS.join(', ')}`,
    caseId
      ? `# per-visit tail: narrative taken from ${caseId} — CONTAINS PATIENT DATA, keep local`
      : `# per-visit tail: SYNTHETIC (invented patient, invented chart state) — no patient data`,
    '',
    '',
  ].join('\n');

  writeFileSync(outArg, header + prompt);
  console.log(`planner: ${prompt.length} chars, ${prompt.split('\n').length} lines -> ${outArg}`);
}

main();
