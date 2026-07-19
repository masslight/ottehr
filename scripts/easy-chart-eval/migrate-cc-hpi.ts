/**
 * migrate-cc-hpi.ts — one-off, idempotent migration for already-harvested eval cases.
 *
 * Fixes the CC/HPI cross-wiring: the harvested `gold.chiefComplaint` actually holds the
 * clinician's real HPI (see the signed-note PDF composers cited in harvest-shared.ts). This
 * rewrites each caseNNN.json so:
 *   gold.historyOfPresentIllness = <old gold.chiefComplaint>   (the real HPI)
 *   gold.additionalInformation   = <old gold.historyOfPresentIllness>  (may be undefined)
 *   gold.chiefComplaint          -> removed
 * then regenerates renderedNote via the shared renderNote (no duplicated render logic) and
 * rewrites caseNNN.json + caseNNN.txt. The caseNNNa.txt transcript is untouched. manifest.json
 * carries no CC/HPI text, so it needs no change.
 *
 * Idempotent: a file with no `gold.chiefComplaint` is skipped. No prod access / token needed —
 * all text is already on disk. PHI-safe: prints counts only, never clinical text.
 *
 * Usage:
 *   npx tsx scripts/easy-chart-eval/migrate-cc-hpi.ts
 *   (HARVEST_OUT_DIR overrides the default harvested-cases dir)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GoldData, renderNote } from './harvest-shared';

const outDir = process.env.HARVEST_OUT_DIR?.trim() || join('scripts', 'easy-chart-eval', 'harvested-cases');

if (!existsSync(outDir)) {
  console.error(`Harvested-cases dir not found: ${outDir}`);
  process.exit(1);
}

const caseFiles = readdirSync(outDir).filter((f) => /^case\d+\.json$/.test(f));

let migrated = 0;
let skipped = 0;
let hpiPopulatedBefore = 0;
let hpiPopulatedAfter = 0;

for (const file of caseFiles) {
  const path = join(outDir, file);
  const caseFile = JSON.parse(readFileSync(path, 'utf-8')) as {
    gold: GoldData & { chiefComplaint?: string };
    renderedNote?: string;
  };
  const gold = caseFile.gold;

  // "Before" = HPI populated under the OLD (mislabeled) mapping.
  if (gold.historyOfPresentIllness && gold.historyOfPresentIllness.trim()) hpiPopulatedBefore += 1;

  const hasLegacyCC = Object.prototype.hasOwnProperty.call(gold, 'chiefComplaint');
  if (!hasLegacyCC) {
    // Already migrated — leave as-is, but still count post-state for the tally.
    skipped += 1;
    if (gold.historyOfPresentIllness && gold.historyOfPresentIllness.trim()) hpiPopulatedAfter += 1;
    continue;
  }

  const realHpi = gold.chiefComplaint; // the real charted HPI
  const additionalInformation = gold.historyOfPresentIllness; // the "Additional information" section

  gold.historyOfPresentIllness = realHpi;
  if (additionalInformation && additionalInformation.trim()) {
    gold.additionalInformation = additionalInformation;
  } else {
    delete gold.additionalInformation;
  }
  delete gold.chiefComplaint;

  // Regenerate the flat note from the SAME renderer the harvester uses.
  const renderedNote = renderNote(gold as GoldData);
  caseFile.renderedNote = renderedNote;

  writeFileSync(path, JSON.stringify(caseFile, null, 2));
  writeFileSync(join(outDir, file.replace(/\.json$/, '.txt')), renderedNote);

  migrated += 1;
  if (gold.historyOfPresentIllness && gold.historyOfPresentIllness.trim()) hpiPopulatedAfter += 1;
}

const total = caseFiles.length;
console.log(`before: HPI populated in ${hpiPopulatedBefore}/${total}`);
console.log(
  `migrated ${migrated} files, skipped ${skipped} (already migrated); HPI now populated in ${hpiPopulatedAfter}/${total}`
);
