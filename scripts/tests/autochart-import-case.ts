/**
 * Copies one eval-corpus case into autochart-cases/<id>.json, ready for the hand-written part:
 *
 *   npx tsx scripts/tests/autochart-import-case.ts case123 my-case-id "Label for the report"
 *
 * The corpus (tools/easy-chart-eval/harvested-cases; PHI, gitignored) exists only on machines that ran the
 * harvester. The copy keeps what the suites read — the transcript, the signed chart and the patient status —
 * and nothing else. The transcript is PHI too: replace names, places, dates and organizations with placeholders
 * (<patient name>, <clinician name>, <city>, <pharmacy>, <date>…) before committing. The patient's age and sex are read from the chart's HPI when it states them; the hand-written
 * sections start empty: see autochart-cases/README.md.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { parsePatient } from './autochart-corpus';

const [sourceCase, id, label] = process.argv.slice(2);
if (!sourceCase || !id) {
  console.error('usage: npx tsx scripts/tests/autochart-import-case.ts <corpus case id> <case id> ["label"]');
  process.exit(2);
}
const source = path.resolve(__dirname, '../../tools/easy-chart-eval/harvested-cases', `${sourceCase}.json`);
const target = path.resolve(__dirname, 'autochart-cases', `${id}.json`);
if (!existsSync(source)) {
  console.error(`${source} is not here: the corpus lives only on machines that ran the harvester.`);
  process.exit(1);
}
if (existsSync(target)) {
  console.error(`${target} already exists.`);
  process.exit(1);
}

const corpus = JSON.parse(readFileSync(source, 'utf8')) as {
  meta?: { patientStatus?: string };
  transcript: string;
  gold: { historyOfPresentIllness?: string };
};
const patientStatus = corpus.meta?.patientStatus ?? 'new';
// The chart's HPI usually says "The patient is a 47-year-old male…"; when it does not, fill `patient` in by hand.
const patient = parsePatient(corpus.gold.historyOfPresentIllness) ?? { ageYears: null, sex: null };
const file = {
  id,
  label: label ?? id,
  sourceCase,
  patient,
  patientStatus,
  notes: [],
  said: [],
  goldErrors: [],
  allowed: [],
  narrativeFacts: [],
  edits: [],
  transcript: corpus.transcript,
  gold: corpus.gold,
};
writeFileSync(target, JSON.stringify(file, null, 2) + '\n');
console.log(
  `wrote ${target}: ${corpus.transcript.length} chars of transcript, ${patientStatus} patient.\n` +
    `${
      patient.sex ? `patient ${JSON.stringify(patient)} from the HPI. ` : 'Fill in patient (age, sex). '
    }Replace names and places with <placeholders>; review with\n` +
    `  npx tsx scripts/tests/test-autochart-plan.ts --env local --dump-expectations --cases ${id}`
);
